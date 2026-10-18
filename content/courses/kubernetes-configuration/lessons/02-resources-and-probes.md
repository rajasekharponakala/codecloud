# Resources, QoS and health probes

## Requests and limits

```yaml
resources:
  requests:        # what the scheduler reserves on a node
    cpu: 100m      # 0.1 CPU
    memory: 64Mi
  limits:          # the hard ceiling
    memory: 128Mi  # exceeding it gets the container OOM-killed
```

CPU over the limit is throttled, not killed. Many teams set a memory limit but no CPU limit.

| QoS class | When |
|-----------|------|
| **Guaranteed** | every container has requests = limits for CPU and memory |
| **Burstable** | at least one request or limit set, but not Guaranteed |
| **BestEffort** | nothing set — first to be evicted under pressure |

## Probes

| Probe | Failing means |
|-------|---------------|
| **startupProbe** | still starting — hold off the other probes |
| **readinessProbe** | do not send traffic (removed from Service endpoints) |
| **livenessProbe** | the process is stuck — restart the container |

```yaml
livenessProbe:
  httpGet: { path: /, port: 80 }
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  tcpSocket: { port: 80 }
```

A liveness probe that checks dependencies (like the database) can restart every pod at once
during an outage — keep liveness checks local to the process.
