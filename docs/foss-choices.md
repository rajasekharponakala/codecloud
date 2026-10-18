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
