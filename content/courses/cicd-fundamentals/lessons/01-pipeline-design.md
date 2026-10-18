# Designing a pipeline

A pipeline turns a commit into a deployable (or deployed) artefact, failing as early and as
cheaply as possible.

```
commit → lint & unit tests → build artefact → integration tests → security scans
       → publish (registry) → deploy to staging → smoke tests → deploy to production
```

## Principles

* **Fast feedback first** — cheap checks (formatting, lint, unit tests) run before slow ones.
* **Build once, deploy many** — the exact artefact tested in staging is promoted to production;
  never rebuild per environment.
* **Pipelines as code** — the pipeline definition lives in the repository and is reviewed.
* **Hermetic and reproducible** — pin tool and dependency versions; cache, but never depend on
  cache contents.
* **Secrets are injected**, scoped to the jobs that need them, and never printed.
* **Everything that can be automated is**, including scheduled jobs: nightly full test suites,
  dependency updates, image rebuilds for security patches.

## Deployment strategies

| Strategy | Idea |
|----------|------|
| Rolling | replace instances a few at a time |
| Blue/green | run the new version alongside, switch traffic at once |
| Canary | send a small share of traffic to the new version, watch metrics, widen |
| Feature flags | deploy dark, release by configuration |
