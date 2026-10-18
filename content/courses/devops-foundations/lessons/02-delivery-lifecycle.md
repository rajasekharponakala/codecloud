# The software delivery lifecycle and its toolchain

A change travels through the same stages in almost every organisation. Each stage has a
mainstream open-source tool you will practise in this catalog.

| Stage | What happens | Open-source tools |
|-------|--------------|-------------------|
| **Plan & code** | Work is tracked; code is written and reviewed | Git, Gitea/Forgejo, GitLab CE |
| **Build** | Source becomes an artefact (binary, package, container image) | Make, Docker/Buildah |
| **Test** | Unit, integration and security tests run automatically | pytest, ShellCheck, Trivy |
| **Release** | Artefacts are versioned and stored | Harbor, a container registry |
| **Provision** | Infrastructure is created from code | OpenTofu, Ansible |
| **Deploy** | The release reaches an environment | Kubernetes, Helm, Argo CD |
| **Operate** | The system runs and scales | Linux, NGINX, PostgreSQL |
| **Monitor** | Metrics, logs and traces close the loop | Prometheus, Grafana, Loki |

## Continuous integration, delivery and deployment

* **Continuous integration (CI)** — everybody merges to a shared mainline frequently; each merge
  is built and tested automatically.
* **Continuous delivery** — every change that passes the pipeline *could* be released at the push
  of a button.
* **Continuous deployment** — every change that passes the pipeline *is* released automatically.

## Environments

Changes usually flow through **dev → staging → production**. The more alike these environments
are, the fewer surprises — which is why containers and infrastructure as code matter: they make
environments reproducible from files in Git.
