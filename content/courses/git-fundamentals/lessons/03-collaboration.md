# Remotes and pull requests

A **remote** is another copy of the repository, usually on a server such as Forgejo, GitLab or
GitHub.

```bash
git clone https://git.example.org/team/app.git
git remote -v
git fetch            # download new commits, do not change your branches
git pull --rebase    # fetch and replay your local commits on top
git push -u origin feature/login
```

## The pull-request workflow

1. Branch from an up-to-date `main`.
2. Commit small, focused changes with clear messages.
3. Push the branch and open a **pull/merge request**.
4. CI runs automatically; reviewers comment.
5. Address feedback with new commits, then merge.

## Trunk-based development

High-performing teams keep branches short-lived (hours to a day or two) and merge to `main`
often, hiding unfinished work behind feature flags. Long-lived branches cause painful merges and
delay feedback.

## Good commit messages

```
Add health endpoint for load balancer checks

The load balancer needs a cheap endpoint that does not touch the
database. Returns 200 with {"status": "ok"}.
```

A short imperative subject line, a blank line, then *why* the change was made.
