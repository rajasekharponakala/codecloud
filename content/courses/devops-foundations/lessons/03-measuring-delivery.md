# Measuring delivery with DORA metrics

The DORA research programme found four metrics that predict both delivery performance and
organisational outcomes:

| Metric | Question it answers |
|--------|---------------------|
| **Deployment frequency** | How often do we release to production? |
| **Lead time for changes** | How long from commit to running in production? |
| **Change failure rate** | What share of releases cause a failure needing remediation? |
| **Time to restore service** | How quickly do we recover from a failure? |

The first two measure **throughput**, the last two **stability** — and high performers are good
at *both*. Speed and stability are not a trade-off when changes are small and automated.

## Using metrics well

* Measure teams' systems, not individuals.
* Look at trends rather than absolute numbers.
* Pair metrics with the practices that move them: trunk-based development, test automation,
  deployment automation, monitoring and loosely coupled architecture.

## Service levels

Operations teams also agree targets with users:

* **SLI** (indicator) — a measurement, e.g. the share of requests served in under 300 ms.
* **SLO** (objective) — the target for an SLI, e.g. 99.5% over 28 days.
* **Error budget** — the 0.5% you are allowed to miss; spend it on shipping features, and slow
  down when it runs out.
