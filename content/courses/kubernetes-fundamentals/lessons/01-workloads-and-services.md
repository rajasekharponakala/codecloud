# Kubernetes workloads and services

Kubernetes runs containers across a cluster and keeps the **desired state** you declare.

- **Pod** — the smallest unit: one or more containers sharing a network namespace.
- **Deployment** — keeps N identical pods running and rolls out new versions.
- **Service** — a stable virtual IP and DNS name in front of a set of pods, chosen by **labels**.

```bash
kubectl run nginx-pod --image=nginx:alpine
kubectl create deployment frontend --image=nginx:alpine --replicas=3
kubectl scale deployment frontend --replicas=5
kubectl expose deployment frontend --name=frontend-svc --port=80
kubectl get pods,deploy,svc -o wide
```

The lab gives you a real single-node cluster (k3s), not a simulator.
