# GitHub Actions workflows

Workflows are YAML files in `.github/workflows/`.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
```

* **Triggers** (`on:`): `push`, `pull_request`, `workflow_dispatch` (manual button), `schedule`
  (cron, in UTC), `release`, and more.
* **Jobs** run in parallel on fresh runners unless linked with `needs:`.
* **Steps** either `run:` a shell command or `uses:` a reusable action — pin actions to a version
  or commit SHA.
* **Matrix** builds fan a job out across versions or platforms.

## Scheduled jobs

```yaml
on:
  schedule:
    - cron: "15 3 * * *"   # 03:15 UTC daily
  workflow_dispatch:
```

Use schedules for heavy work that should not slow down every pull request: full end-to-end
suites, rebuilding images, syncing external data. Lint workflows with **actionlint**.

## Secrets and permissions

Reference secrets as `${{ secrets.NAME }}` and grant the `GITHUB_TOKEN` only what a workflow needs:

```yaml
permissions:
  contents: read
```
