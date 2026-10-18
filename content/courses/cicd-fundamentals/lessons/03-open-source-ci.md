# Self-hosted, open-source CI/CD

Hosted CI is convenient, but many teams need to run pipelines on their own infrastructure.
Mature open-source options:

| Tool | Notes |
|------|-------|
| **Forgejo Actions** / **Gitea Actions** | GitHub-Actions-compatible workflows on a self-hosted forge |
| **GitLab CE** | integrated forge + CI (`.gitlab-ci.yml`), self-hostable runners |
| **Jenkins** | the veteran: huge plugin ecosystem, `Jenkinsfile` pipelines |
| **Woodpecker CI** | lightweight, container-native pipelines |
| **Tekton** | Kubernetes-native pipeline building blocks |
| **Argo CD** / **Flux** | GitOps continuous *delivery*: the cluster pulls desired state from Git |

## GitOps in one paragraph

Instead of a pipeline pushing `kubectl apply` into the cluster, a controller *in* the cluster
watches a Git repository and continuously reconciles the cluster to match it. Deployments become
pull requests; rollbacks become `git revert`; drift is detected automatically.

## Choosing

Prefer the CI that lives next to your code (fewer integrations to maintain), run untrusted
pull-request code on isolated, ephemeral runners, and keep pipeline logic in scripts you can also
run locally (`make test`) so the CI definition stays thin.
