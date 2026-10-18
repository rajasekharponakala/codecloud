# Observability and the Prometheus model

Three signals let you understand a running system:

| Signal | Answers | Open-source tools |
|--------|---------|-------------------|
| **Metrics** | how much / how fast, over time | Prometheus, VictoriaMetrics |
| **Logs** | what happened, in detail | Loki, OpenSearch |
| **Traces** | where time went across services | Jaeger, Tempo, OpenTelemetry |

## How Prometheus works

Prometheus **pulls** (scrapes) metrics over HTTP from targets' `/metrics` endpoints at a fixed
interval and stores them as time series.

```
http_requests_total{method="GET", status="200", instance="web01:8080", job="web"}  1027
```

A series = metric name + labels. Every distinct label combination is a new series, so never put
unbounded values (user IDs, URLs with IDs) in labels.

## Metric types

* **Counter** — only goes up (requests, errors). Use `rate()` on it.
* **Gauge** — goes up and down (memory in use, queue length).
* **Histogram** — bucketed observations (latency); compute percentiles with `histogram_quantile`.

## Configuration

```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: node
    static_configs:
      - targets: ["web01:9100", "web02:9100"]
```

Exporters expose metrics for systems that do not: `node_exporter` (Linux hosts),
`postgres_exporter`, `blackbox_exporter` (probes). Validate configuration with
`promtool check config prometheus.yml`.
