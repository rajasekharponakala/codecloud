# Python essentials for operators

Python is the most common language for infrastructure automation: Ansible modules, cloud SDKs
and countless internal tools are written in it.

```python
servers = ["web01", "web02", "db01"]          # list
ports = {"http": 80, "https": 443}            # dict
for name in servers:
    if name.startswith("web"):
        print(f"{name} serves port {ports['http']}")
```

## Functions and modules

```python
def is_healthy(service: dict) -> bool:
    return service["healthy"] >= service["replicas"]
```

Batteries included: `os`, `pathlib`, `json`, `csv`, `subprocess`, `argparse`, `logging`,
`urllib.request`, `collections`, `datetime`.

## Comprehensions

```python
unhealthy = [s["name"] for s in services if not is_healthy(s)]
by_name = {s["name"]: s for s in services}
```

## Virtual environments

Install third-party packages per project, never into the system Python:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install requests
pip freeze > requirements.txt
```
