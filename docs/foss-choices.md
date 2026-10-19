# Open-source building blocks

CodeCloud follows the [FOSS Mind](https://gitlab.com/ranjithraj/foss-agent-skills/-/blob/main/foss-mind.md)
rule: **search before you ship**. Every capability is delegated to a maintained open-source
project. Custom code is limited to glue and to the parts that are genuinely specific to this
product: the lab lifecycle and the grading contract.

## What each need maps to

| Need | Chosen project | License | Why it fits | Alternatives considered |
|---|---|---|---|---|
| Disposable lab machines | Docker Engine + [dockerode](https://github.com/apocas/dockerode) | Apache-2.0 | De-facto container API with full exec/TTY/resize support | `docker` CLI via child processes (fragile parsing), Podman (API-compatible: point `DOCKER_SOCKET` at its socket) |
| Kubernetes in a lab | [k3s](https://k3s.io) | Apache-2.0 | Certified Kubernetes in a single container that boots in about 10 s | kind (needs a Docker daemon), minikube (VM-oriented) |
| Docker in a lab | `docker:dind` | Apache-2.0 | Official Docker-in-Docker image | Sysbox-hosted dockerd |
| Browser terminal | [xterm.js](https://xtermjs.org) | MIT | The terminal behind VS Code, JupyterLab and others | ttyd/gotty (would need a sidecar per lab plus a proxy) |
| HTTP + WebSocket server | [Fastify](https://fastify.dev), `@fastify/websocket`, `@fastify/static`, `@fastify/session`, `@fastify/cookie` | MIT | Fast, schema-validated, first-party plugins for every need | Express (no built-in schema validation) |
| Password hashing | [`@node-rs/argon2`](https://github.com/napi-rs/node-rs) | MIT | Argon2id, the current OWASP recommendation, with prebuilt binaries | `bcrypt` |
| Database | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | MIT | Zero-ops, transactional, ideal for one host | PostgreSQL (the natural upgrade for multi-host) |
| Content format | [yaml](https://github.com/eemeli/yaml), [zod](https://zod.dev) | ISC, MIT | Human-authored labs with precise validation errors | JSON Schema + ajv |
| Lessons | [marked](https://marked.js.org) + [sanitize-html](https://github.com/apostrophecms/sanitize-html) | MIT | Markdown to safe HTML | markdown-it + DOMPurify |
| Kubernetes packaging | [Helm](https://helm.sh) | Apache-2.0 | The standard Kubernetes package manager | Kustomize (taught alongside, not packaged) |
| Infrastructure as Code | [OpenTofu](https://opentofu.org) | MPL-2.0 | Linux Foundation fork of Terraform, compatible configuration | Terraform (now BUSL, not open source) |
| Configuration management | [ansible-core](https://github.com/ansible/ansible) | GPL-3.0 | Agentless, the most widely used | Salt, Puppet |
| AWS practice without an account | [Moto](https://github.com/getmoto/moto) | Apache-2.0 | Emulates S3, DynamoDB, IAM and more in one process | LocalStack (broader coverage; check its current licence terms) |
| Monitoring | [Prometheus](https://prometheus.io) | Apache-2.0 | CNCF-graduated metrics standard, `promtool` validates config | VictoriaMetrics |
| Linting in labs | [ShellCheck](https://www.shellcheck.net), [actionlint](https://github.com/rhysd/actionlint), [yq](https://github.com/mikefarah/yq) | GPL-3.0, MIT, MIT | Precise, scriptable checks for learners' scripts and workflows | hand-written grep checks |
| Course catalog from edX | Open edX Course API | AGPL-3.0 platform, public API | Public, unauthenticated listing on every Open edX instance | scraping edx.org (fragile), Discovery API (needs credentials) |
| Course export to Open edX | OLX + [tar](https://github.com/isaacs/node-tar) | ISC | OLX is Open edX's native import format | SCORM packages (lossy for problems) |
| Scheduled and heavy jobs | GitHub Actions, [create-pull-request](https://github.com/peter-evans/create-pull-request), Docker build-push actions | MIT | Runs next to the code. Matrix builds, cron schedules and GHCR are built in | self-hosted Forgejo Actions (same workflow syntax) |
| Launch video | [/brag](https://github.com/latent-spaces/brag) workflow, [Playwright](https://playwright.dev), [FFmpeg](https://ffmpeg.org), Inter + JetBrains Mono via [Fontsource](https://fontsource.org) | MIT, Apache-2.0, LGPL/GPL, OFL-1.1 | brag gives the story and creative rules. Playwright records and renders real UI frame by frame, and FFmpeg encodes and mixes | screen-recording by hand (not reproducible), Hyperframes (the full /brag path) |
| Tests | [Vitest](https://vitest.dev), [ws](https://github.com/websockets/ws) | MIT | Fast ESM-native runner and a WebSocket client | node:test |

All dependencies are actively maintained, widely adopted, permissively licensed and had no
known vulnerabilities (`npm audit`) when added. CodeCloud itself is licensed
**AGPL-3.0-or-later**. FOSS Mind prefers copyleft, and the AGPL keeps hosted forks open.

## Thin wrappers, and why they exist

The FOSS Mind wrapper pattern asks that each gap be filled minimally, documented, and
revisited:

| Wrapper | Gap it fills | Revisit when |
|---|---|---|
| `SqliteSessionStore` (`src/db.js`, ~50 lines) | `@fastify/session` ships only an in-memory store, which loses logins on restart | a maintained SQLite store for `@fastify/session` appears, or we move to PostgreSQL / Redis stores |
| `DockerRuntime` (`src/runtime/docker.js`) | adapts dockerode to the six operations the lab service needs, adding timeouts and demuxing | adding a Kubernetes runtime, since this interface is the seam |
| Terminal bridge (`src/routes/terminal.js`) | ~50 lines connecting an xterm.js WebSocket to a `docker exec` stream, with origin and ownership checks | — |

## Upstream opportunities

* A SQLite session store package for `@fastify/session` would remove our adapter and help
  other Fastify users.
* The lab format (environment + quiz + shell checks) is product-agnostic. It could be published
  as a spec so that labs are shareable between open-source platforms.
