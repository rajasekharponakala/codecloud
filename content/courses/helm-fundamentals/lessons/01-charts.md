# Charts, templates and values

A **chart** is a directory of templated Kubernetes manifests plus default configuration.

```
webapp/
  Chart.yaml          # name, version (of the chart), appVersion (of the app)
  values.yaml         # default configuration
  templates/          # Go templates rendered into manifests
    deployment.yaml
    service.yaml
    _helpers.tpl      # reusable named templates
```

```yaml
# templates/deployment.yaml (excerpt)
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
```

```bash
helm create webapp            # scaffold a working chart
helm lint webapp              # static checks
helm template shop webapp     # render locally without installing
helm template shop webapp --set replicaCount=3 | grep replicas
```

Values are merged in order: chart `values.yaml` → `-f my-values.yaml` files → `--set` flags
(last wins).

Charts can be shared through repositories or OCI registries:
`helm install db oci://registry.example.org/charts/postgresql --version 1.2.3`.
