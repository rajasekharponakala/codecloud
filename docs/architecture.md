# Architecture

```
public/ (browser)                     src/ (Node.js, Fastify)                       Docker Engine
┌──────────────────────┐   HTTPS   ┌──────────────────────────────┐  Engine API  ┌────────────────────────┐
│ catalog / lessons    │──────────►│ routes/api.js                │─────────────►│ codecloud-<session>    │
│ lab: task panel      │           │   └─ labs/service.js         │  dockerode   │  (ubuntu / dind / k3s) │
│      xterm.js ◄──────┼─WebSocket─┼─ routes/terminal.js ─────────┼── exec TTY ─►│  /bin/bash -l          │
└──────────────────────┘           │ content/loader.js  db.js     │              │  check scripts (exec)  │
                                   └──────────────────────────────┘              └────────────────────────┘
                                         content/*.yaml     data/codecloud.db
```

## Request flows

**Start a lab.** `POST /api/labs/:id/sessions` returns `202` with a `provisioning` session
(or the learner's existing session for that lab). In the background `LabService.provision`:

1. pulls (or builds, for `environment.build`) the image,
2. creates a container labelled `io.codecloud.managed=true` with memory, CPU and PID limits,
3. polls `ready_check` until it exits 0 (e.g. the k3s node is `Ready`),
4. runs the `setup` script, then flips the session to `running`.

The browser polls `GET /api/lab-sessions/:id` and opens the terminal once it is running.

**Terminal.** `GET /api/lab-sessions/:id/terminal` upgrades to a WebSocket after checking the
session cookie, the session's owner and the `Origin` header. The server starts a TTY
`docker exec` login shell and pipes bytes both ways. Keystrokes and resizes travel as JSON text
frames, and output comes back as binary frames.

**Check.** `POST /api/lab-sessions/:id/tasks/:task/check` grades the task:
* `quiz` tasks compare the chosen option index server-side. Answers never reach the browser.
* `task` tasks run the `check` script inside the container (`/bin/sh -c`, 30 s timeout).
  Exit code 0 is a pass, and anything the script prints is shown to the learner as feedback.

A pass is sticky: a later failing attempt does not erase it. It is also recorded in
`lab_progress`, which outlives the session.

**Catalog.** `GET /api/catalog` returns categories and learning paths (`content/catalog.yaml`),
native courses, and external courses synced from edX (`content/external/*.json`, see
[catalog.md](catalog.md)).

**Lifecycle.** Sessions expire after `duration_minutes` and can be extended
`CODECLOUD_MAX_EXTENSIONS` times. Every 30 s a reaper expires overdue sessions and deletes any
managed container without an active session, for example one left by a crash. On restart,
sessions caught mid-provisioning are marked failed.

## Data model (SQLite)

| Table | Purpose |
|---|---|
| `users` | accounts (Argon2id password hashes) |
| `http_sessions` | login sessions for `@fastify/session` |
| `lab_sessions` | one row per lab environment: owner, container, status, expiry, extensions |
| `task_results` | per-session pass state and attempt counts |
| `lab_progress`, `lesson_progress` | durable per-user progress |

## Authoring labs

A lab is a directory under `content/labs/<id>/` with a `lab.yaml`:

```yaml
id: my-lab
kind: lab                 # or "playground" (no tasks)
title: My lab
duration_minutes: 30
environment:
  image: ubuntu:24.04     # or `build: ../../images/workstation` (shared Dockerfile directory)
  # entrypoint: [...]     # override the image ENTRYPOINT
  # command:  omit → idle with `sleep infinity`; [] → image's own CMD; or an explicit argv
  privileged: false       # needed for Docker-in-Docker and k3s
  memory_mb: 512
  cpus: 1
  setup: |                # runs once, before the learner gets the terminal
    mkdir -p /srv/app
  ready_check: test -f /srv/app/ready   # optional, polled until exit 0
tasks:
  - id: q1
    type: quiz
    prompt: Markdown question
    options: [a, b, c]
    answer: 1
  - id: t1
    type: task
    prompt: Create `/srv/app/config.yaml`
    hint: optional
    check: |
      test -f /srv/app/config.yaml || { echo "config.yaml is missing"; exit 1; }
    solution: touch /srv/app/config.yaml
```

Validate content with `npm run validate-content`. Smoke-test a lab against Docker with
`node src/cli.js test-lab <id> --solve`. The test checks that no check passes before the
learner acts, and that every check passes after its `solution` runs.

## Isolation

Lab containers run learner-controlled code. CodeCloud applies memory, CPU and PID limits and
`no-new-privileges` to unprivileged labs. That is container isolation, which is not a security
boundary against a determined attacker. Privileged labs (Docker-in-Docker, k3s) are effectively
root on the host. For anything beyond a trusted classroom:

* run lab containers under a sandboxing runtime: `CODECLOUD_LAB_RUNTIME=sysbox-runc`
  ([Sysbox](https://github.com/nestybox/sysbox) also runs Docker and k3s *without*
  `--privileged`) or `runsc` ([gVisor](https://gvisor.dev)) for unprivileged labs,
* run the platform on a dedicated lab host, since the Docker socket is root-equivalent,
* consider `CODECLOUD_LAB_NETWORK=none` for labs that need no internet access.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT`, `HOST` | `8080`, `0.0.0.0` | listen address |
| `CODECLOUD_SESSION_SECRET` | random per boot | cookie signing secret (≥ 32 chars). Set it, or logins reset on restart |
| `CODECLOUD_COOKIE_SECURE` | `false` | set `true` behind HTTPS |
| `CODECLOUD_ALLOW_REGISTRATION` | `true` | allow self sign-up |
| `CODECLOUD_DATA_DIR` | `./data` | SQLite location |
| `CODECLOUD_CONTENT_DIR` | `./content` | courses and labs |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker Engine socket |
| `CODECLOUD_LAB_RUNTIME` | – | OCI runtime for labs (`sysbox-runc`, `runsc`) |
| `CODECLOUD_LAB_NETWORK` | `bridge` | Docker network for labs |
| `CODECLOUD_LAB_CA_BUNDLE` | – | PEM bundle mounted as the labs' CA store (TLS-intercepting proxies) |
| `CODECLOUD_LAB_IMAGE_REGISTRY` | – | registry with pre-built shared lab images, e.g. `ghcr.io/acme/codecloud-labs` |
| `CODECLOUD_MAX_LABS_PER_USER` | `2` | concurrent labs per learner |
| `CODECLOUD_MAX_EXTENSIONS` / `CODECLOUD_EXTENSION_MINUTES` | `2` / `30` | timer extensions |
| `CODECLOUD_CHECK_TIMEOUT_MS` | `30000` | grading script timeout |

## Scaling beyond one host

The runtime is a small interface (`createContainer`, `waitUntilReady`, `exec`, `openShell`,
`remove`, `listManaged`). A Kubernetes runtime that creates one pod per session, uses
`@kubernetes/client-node` exec for terminals and checks, and runs Sysbox or Kata as the
`runtimeClassName` can replace `DockerRuntime` without touching the service, the routes or
the content.
