# What DevOps is (and is not)

For decades, *development* teams were rewarded for shipping change and *operations* teams for
keeping systems stable. Those goals collide: every release is a risk, so releases became rare,
large and even riskier. **DevOps** is the set of cultural practices and tools that removes that
conflict by making change small, frequent, automated and observable.

## Three ideas that matter

1. **Flow** — make work visible, reduce batch size and remove hand-offs so a change moves from
   commit to production quickly. Automation (CI/CD, infrastructure as code) is how flow scales.
2. **Feedback** — find problems as early as possible: automated tests on every commit, monitoring
   and alerting in production, blameless post-incident reviews.
3. **Continual learning** — treat failures as information, run experiments, and invest in
   improving the system of work itself.

## What DevOps is *not*

* **A job title or a team that sits between dev and ops.** A "DevOps team" can help with tooling,
  but the goal is shared ownership.
* **A tool.** Kubernetes, Terraform or Jenkins do not make an organisation DevOps; they make
  certain practices cheaper.
* **"No ops".** Operations work still exists — it is automated, version-controlled and shared.

## Related movements

| Term | Emphasis |
|------|----------|
| **SRE** (Site Reliability Engineering) | Reliability as an engineering problem: SLOs, error budgets, toil reduction |
| **Platform engineering** | Internal platforms that give product teams self-service, paved roads |
| **DevSecOps** | Security checks built into the same automated pipeline |
| **GitOps** | Git as the single source of truth for desired infrastructure and app state |

> Throughout this catalog every concept is paired with a hands-on lab, because these skills are
> learned with your hands on a keyboard.
