# The pod network and NetworkPolicies

Kubernetes networking rules:

1. every pod gets its own IP;
2. every pod can reach every other pod without NAT;
3. **Services** give a stable virtual IP and DNS name (`svc.namespace.svc.cluster.local`) in
   front of the pods matching a label selector.

Rule 2 means that, by default, **everything can talk to everything**. NetworkPolicies restrict it
(enforced by the CNI plugin — k3s ships a policy controller).

## Default deny, then allow

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny-ingress, namespace: shop }
spec:
  podSelector: {}          # every pod in the namespace
  policyTypes: [Ingress]   # and no ingress rules: nothing is allowed in
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-frontend-to-api, namespace: shop }
spec:
  podSelector: { matchLabels: { app: api } }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector: { matchLabels: { role: frontend } }
      ports:
        - { protocol: TCP, port: 80 }
```

Policies are **additive**: traffic is allowed if any policy allows it. Remember to allow DNS
(UDP/TCP 53 to kube-dns) when you also restrict **egress**.

Use `namespaceSelector` to allow traffic from other namespaces, and `ipBlock` for external CIDRs.
