# PromQL, recording rules and alerts

## Queries

```promql
up                                          # 1 if the last scrape succeeded
up{job="node"} == 0                         # targets that are down
rate(http_requests_total[5m])               # per-second rate over 5 minutes
sum by (status) (rate(http_requests_total[5m]))
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
```

Explore in the web UI on port 9090 or via the HTTP API:
`curl 'http://localhost:9090/api/v1/query?query=up'`.

## Recording rules

Pre-compute expensive or frequently used expressions:

```yaml
groups:
  - name: availability
    rules:
      - record: job:up:sum
        expr: sum by (job) (up)
```

Naming convention: `level:metric:operations`.

## Alerting rules

```yaml
      - alert: TargetDown
        expr: up == 0
        for: 5m
        labels: { severity: page }
        annotations:
          summary: "{{ $labels.instance }} is down"
```

Prometheus evaluates rules and sends firing alerts to **Alertmanager**, which groups, silences
and routes them (email, chat, on-call). Validate with `promtool check rules rules.yml`, and
alert on symptoms users feel (errors, latency) rather than every possible cause.
