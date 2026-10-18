# How KodeKloud-style lab platforms work

This page records what we know about how KodeKloud's hands-on platform behaves, how we
investigated it, and how each piece maps onto CodeCloud's open-source implementation.

> **Scope and honesty.** KodeKloud's backend is proprietary and not documented publicly.
> Everything below is either (a) observable product behaviour, (b) reported by users on
> KodeKloud's own community and support pages, or (c) an inference from those two, and is
> labelled as such. CodeCloud copies none of KodeKloud's code, content or branding. It is
> an independent implementation of the same *kind* of product.

## 1. Observable product surface

| Feature | What a learner sees |
|---|---|
| **Courses** | Video/text lessons grouped into courses, with progress tracking. |
| **Labs** | A split screen: a question/task panel on one side, a live Linux terminal (or a VS Code-style IDE) on the other. A countdown timer limits the session. |
| **Questions** | Mixed multiple-choice questions ("how many pods are running?") and practical tasks ("create a deployment named …") with a **Check** button. Hints and solutions can be revealed. |
| **Playgrounds** | Free-form sandboxes (Ubuntu, Docker, Kubernetes, cloud CLIs, …) with no tasks, a fixed lifetime, and tools pre-installed. |
| **Environment** | Real clusters and machines rather than simulators: `kubectl`, `docker`, `systemctl` and package managers behave like the real thing. |

## 2. What users and support pages report

* **Terminal over a persistent WebSocket.** The common "Connection Closed" lab error is
  diagnosed by support with a WebSocket test, and slow networks end labs abruptly.
  This implies the browser terminal is a WebSocket stream to a backend TTY.
  ([troubleshooting labs](https://support.kodekloud.com/troubleshooting-labs))
* **On-demand provisioning.** Users report labs failing to provision after several minutes
  on busy days. This implies environments are created per session, not pre-assigned.
  ([community thread](https://kodekloud.com/community/t/issues-provisioning-and-starting-labs/480663))
* **Browser IDE plus terminal.** Users describe the Terraform labs as a VS Code-like
  interface whose terminal pane can disappear and be reopened from the editor. This
  matches an embedded web IDE such as code-server.
  ([community thread](https://kodekloud.com/community/t/issue-with-terraform-lab-on-hcl-basics-lab/26889/17))
* **Policy enforcement inside labs.** Support documents bans on crypto-mining and on
  network-scanning tools (e.g. `nmap`, `tshark`) in lab environments.
  ([troubleshooting labs](https://support.kodekloud.com/troubleshooting-labs))
* **Server-side grading.** Checks evaluate the *state of the environment* after the
  learner acts (a failing check asks you to fix and re-check), not a transcript of typed
  commands. *Inference:* a grader runs a script against the live environment.

## 3. Inferred architecture

```
Browser ──HTTPS──► Web app / API ──► Course + lab catalog
   │                     │
   │ WebSocket (TTY)     ├─► Session scheduler ──► per-learner environment
   └─────────────────────┘        │                 (container / VM / k8s cluster)
                                  ├─► Grader: runs check scripts *inside* the environment
                                  └─► Reaper: deletes the environment when the timer ends
```

1. **Catalog**: courses, lessons and lab definitions (questions, environment spec, checks).
2. **Scheduler**: creates an isolated environment per learner per lab, waits until it is
   ready (e.g. a Kubernetes node reports `Ready`), runs a setup script, then hands over.
3. **Terminal gateway**: bridges a browser terminal emulator to a TTY in the environment over
   a WebSocket.
4. **Grader**: on **Check**, runs the task's validation script in the environment. A zero
   exit code is a pass. Multiple-choice answers are compared server-side.
5. **Lifecycle**: a timer with optional extensions. On expiry or "End lab" the
   environment is destroyed. Progress is stored per user.

## 4. Investigating it yourself with REA

[REA (Reverse Engineer Anything)](https://github.com/morluto/rea) can observe a web app's
client side from a browser you control. This repository was built in a sandbox whose network
policy blocks kodekloud.com, so the observations above come from public sources. To confirm
or refine them against your own logged-in session:

```bash
npm install --global rea-agents

# 1. Start Chrome with a debugging port and open a lab you are entitled to use.
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.rea-chrome"

# 2. Find the lab tab, then capture its DOM, scripts, network and WebSocket metadata.
rea list-browser-targets --json
rea inspect-web-page --json            # options in docs/browser-observation.md

# 3. Arm an observation window, then click "Check" / start a lab in the browser.
rea observe-web-session --json

# 4. Statically analyse the downloaded bundles for API routes and endpoints.
rea analyze-web-bundle --json
```

What to look for, and what each finding means for this design:

| Observation | Confirms |
|---|---|
| WebSocket frames flowing while you type | the terminal gateway (§3.3) |
| A `POST …/check` (or similar) request followed by a pass/fail JSON answer | server-side grading (§3.4) |
| Polling or push while "Loading lab" spins | async provisioning (§3.2) |
| Session/expiry timestamps in API responses | the lifecycle timer (§3.5) |

Only analyse accounts and content you are licensed to use, and respect KodeKloud's terms
of service. REA observes passively and does not need to touch their servers beyond normal use.

## 5. Mapping to the open-source rebuild

| Concern | CodeCloud component | Open-source building block |
|---|---|---|
| Catalog | `content/` YAML + Markdown, `src/content/` | `yaml`, `zod`, `marked`, `sanitize-html` |
| Web app / API | `src/app.js`, `src/routes/api.js` | Fastify |
| Accounts | `src/auth.js` | Argon2 via `@node-rs/argon2`, `@fastify/session` |
| Scheduler | `src/labs/service.js`, `src/runtime/docker.js` | Docker Engine via `dockerode` |
| Linux labs | `ubuntu:24.04` / built images | Docker |
| Docker labs | `docker:dind` | Docker-in-Docker |
| Kubernetes labs | `rancher/k3s` | k3s, a CNCF-certified Kubernetes |
| Terminal gateway | `src/routes/terminal.js`, `public/app.js` | xterm.js, `@fastify/websocket`, `docker exec` TTY |
| Grader | `LabService.checkTask` | POSIX shell scripts run with `docker exec` |
| Lifecycle | `LabService.reap` | timer + Docker labels |
| Persistence | `src/db.js` | SQLite (`better-sqlite3`) |

See [architecture.md](architecture.md) for details and [foss-choices.md](foss-choices.md)
for why each library was chosen.
