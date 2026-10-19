# Course catalog, edX and automation

## What is in the catalog

| Track | Courses (lab) |
|---|---|
| DevOps foundations | DevOps Foundations (Ubuntu playground) |
| Linux | Linux Foundations (`linux-files`, `linux-processes`), Linux Administration (`linux-admin`) |
| Networking | Linux Networking Essentials (`linux-networking`) |
| Git | Git Fundamentals (`git-basics`) |
| Programming | Shell Scripting with Bash (`bash-scripting`), Python for DevOps (`python-basics`) |
| Containers | Docker Fundamentals (`docker-basics`, `docker-compose`) |
| Kubernetes | Kubernetes Fundamentals (`kubernetes-pods`), Application Configuration (`k8s-config`), Storage and Networking (`k8s-storage-network`), Helm Fundamentals (`helm-basics`) |
| Security | Kubernetes Security Essentials (`k8s-rbac`) |
| Infrastructure as Code | Infrastructure as Code with OpenTofu (`opentofu-basics`) |
| Configuration management | Ansible Fundamentals (`ansible-basics`) |
| CI/CD | CI/CD Pipelines (`github-actions-workflows`) |
| Observability | Monitoring with Prometheus (`prometheus-basics`) |
| Web servers | NGINX Fundamentals (`nginx-basics`) |
| Databases | PostgreSQL Fundamentals (`postgres-basics`) |
| Cloud | Cloud Fundamentals with the AWS CLI (`aws-cli-moto`, emulated with Moto) |

Playgrounds: Ubuntu, Docker and Kubernetes (k3s + Helm).

Learning paths (`content/catalog.yaml`): **DevOps Engineer**, **Kubernetes Administrator**,
**Linux System Administrator**, and **Cloud & Infrastructure as Code**.

Every lab runs entirely on open-source software and needs no cloud account. The AWS lab talks
to [Moto](https://github.com/getmoto/moto), and Kubernetes labs run [k3s](https://k3s.io).
OpenTofu replaces Terraform.

### Shared lab images

Labs that need tooling build on shared images in `content/images/`:

| Image | Contents | Used by |
|---|---|---|
| `workstation` | Ubuntu 24.04, git, Python, networking tools, ShellCheck, actionlint, yq | Linux, Git, networking, CI/CD labs |
| `k8s-tools` | k3s + Helm | Kubernetes and Helm labs |
| `ansible` | Ubuntu + ansible-core | Ansible lab |
| `opentofu` | Alpine + OpenTofu | IaC lab |
| `aws-moto` | Python + AWS CLI + Moto | AWS lab |

A lab references one with `environment.build: ../../images/<name>`. The image is called
`codecloud-lab/<name>`. When `CODECLOUD_LAB_IMAGE_REGISTRY` is set, it is pulled as
`<registry>/<name>:latest` instead of being built on the lab host.

## edX

CodeCloud works with edX in both directions.

### Listing edX courses in the catalog

`scripts/sync-edx.js` reads the **public Open edX Course API**
(`GET /api/courses/v1/courses/`) of every instance in `content/external/edx-sources.yaml`.
That is `courses.edx.org` by default, and any Open edX site can be added. The script:

1. pages through all public courses, filtered with `active_only=true`,
2. drops hidden, invitation-only and already-ended courses,
3. assigns each course to a catalog category by whole-word keyword match (first match wins),
4. keeps the newest `max_per_category` per category and links related CodeCloud labs,
5. writes `content/external/edx.json`, but only if the list actually changed.

The catalog shows these courses with an **edX** badge. Each one links to its edX page and
suggests CodeCloud labs to practise with. The repository ships an empty `edx.json`. The
first run of the *edX catalog sync* workflow fills it.

```bash
node scripts/sync-edx.js                       # all configured instances
node scripts/sync-edx.js --base-url https://lms.example.org --out /tmp/edx.json
```

### Running CodeCloud courses on Open edX

`scripts/export-olx.js` turns every course into an **OLX** archive that Open edX Studio can
import (*Tools → Import*):

* each lesson becomes a section containing the lesson text,
* each lab becomes a graded *Hands-on lab* subsection. Its multiple-choice tasks become native
  edX problems, and the practical tasks are listed with a link that opens the lab in CodeCloud.

```bash
CODECLOUD_PUBLIC_URL=https://labs.example.org node scripts/export-olx.js --out dist/olx
```

Practical tasks are still graded by CodeCloud. Sending those grades back to edX would need an
LTI 1.3 tool integration, which is a possible next step.

## GitHub Actions: heavy content and scheduled jobs

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push, PR | content validation, unit/API tests, Docker integration tests, actionlint, platform image build |
| `labs.yml` | PR touching labs/images/runtime · **nightly 02:17 UTC** · manual | boots each affected lab (every lab nightly) in a matrix. Checks no task passes on a fresh environment, then that every reference solution passes. Opens or updates an issue when the nightly run fails |
| `lab-images.yml` | push to `content/images/**` · **weekly, Mon 04:23 UTC** · manual | builds the shared lab images for amd64 and arm64 and pushes them to `ghcr.io/<owner>/codecloud-labs/<image>`. The weekly rebuild picks up base-image security fixes |
| `edx-sync.yml` | **weekly, Sun 05:37 UTC** · manual | refreshes `content/external/edx.json` from edX and opens a pull request when it changed |
| `olx-export.yml` | push to `content/**` · release · manual | exports all courses as Open edX archives, uploads them as artifacts, and attaches them to releases |
| `video.yml` | manual · release | renders the launch video with /brag. It boots CodeCloud with real labs, records every feature, and composes and encodes the video. It uploads the artifact, opens a PR updating `docs/assets/codecloud-demo.mp4`, and attaches the video to releases |
| `dependabot.yml` | weekly | npm, GitHub Actions and Dockerfile base-image updates |

Setup notes:

* **edX sync**: enable *Settings → Actions → General → Allow GitHub Actions to create and
  approve pull requests*.
* **OLX export**: set the repository variable `CODECLOUD_PUBLIC_URL` to your CodeCloud URL so
  lab links work.
* **Lab hosts**: set `CODECLOUD_LAB_IMAGE_REGISTRY=ghcr.io/<owner>/codecloud-labs`, and make the
  packages public or `docker login ghcr.io` on the host.
* **Docker Hub rate limits**: lab hosts pull public images such as `ubuntu`, `nginx` and
  `postgres`. Configure a registry mirror in `/etc/docker/daemon.json`
  (`{"registry-mirrors": ["https://mirror.gcr.io"]}`) or log in to Docker Hub.

## Adding a course

1. Write lessons in `content/courses/<id>/lessons/*.md` and list them in `course.yaml` with a
   `category` from `catalog.yaml`.
2. Optionally add a lab in `content/labs/<id>/lab.yaml`, reusing a shared image where possible.
3. Run `npm run validate-content` and `node src/cli.js test-lab <lab> --solve`.
4. Add the course to a learning path if it belongs to one.

The pull request runs the lab smoke test for any lab you touched.
