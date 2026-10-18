# ConfigMaps and Secrets

Images should be the same in every environment; **configuration** varies. Kubernetes stores it
in two object types.

```bash
kubectl create configmap app-config --from-literal=APP_MODE=production --from-file=app.ini
kubectl create secret generic db-credentials --from-literal=password='S3cure-pass'
kubectl get secret db-credentials -o jsonpath='{.data.password}' | base64 -d
```

## Consuming them in a pod

```yaml
spec:
  containers:
    - name: api
      image: nginx:alpine
      envFrom:                       # every key becomes an env var
        - configMapRef:
            name: app-config
      env:
        - name: DB_PASSWORD          # one key, renamed
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
      volumeMounts:                  # or mount as files
        - name: config
          mountPath: /etc/app
  volumes:
    - name: config
      configMap:
        name: app-config
```

Environment variables are read once at start-up; **mounted files update** when the ConfigMap
changes (after a short delay).

## Secrets are not encrypted by default

Values are only base64-encoded. Protect them with RBAC, enable encryption at rest, and consider
external secret managers (e.g. OpenBao with the External Secrets Operator) for production.
