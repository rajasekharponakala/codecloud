# Security contexts and Pod Security Standards

Containers share the host kernel, so limit what they can do.

```yaml
spec:
  securityContext:              # pod level
    runAsUser: 1000
    runAsNonRoot: true
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: app
      image: busybox:1.37
      securityContext:          # container level
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities: { drop: [ALL] }
```

| Setting | Protects against |
|---------|------------------|
| `runAsNonRoot` | images that silently run as root |
| `readOnlyRootFilesystem` | attackers dropping tools or modifying binaries |
| `allowPrivilegeEscalation: false` | setuid binaries gaining privileges |
| dropping capabilities | raw sockets, mounting, changing file ownership… |

Mount an `emptyDir` at paths the app must write to (e.g. `/tmp`) when the root filesystem is read-only.

## Pod Security Standards

Namespaces can enforce three built-in profiles — **privileged**, **baseline**, **restricted** — with
a label:

```bash
kubectl label namespace dev pod-security.kubernetes.io/enforce=restricted
```

Pods that violate the profile are rejected at admission. For custom rules use a policy engine
such as Kyverno or OPA Gatekeeper.
