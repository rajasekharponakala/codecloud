# Files, JSON, subprocesses and exit codes

## Reading files and JSON

```python
import json
from pathlib import Path

services = json.loads(Path("/srv/data/services.json").read_text())

with open("/var/log/app.log") as f:
    for line in f:              # streams line by line, memory-friendly
        if "ERROR" in line:
            print(line.rstrip())
```

## Counting things

```python
from collections import Counter
counts = Counter(line.split()[0] for line in open("access.log"))
print(counts.most_common(3))
```

## Arguments and exit codes

```python
import sys

if len(sys.argv) < 2:
    print("usage: check.py THRESHOLD", file=sys.stderr)
    sys.exit(2)
```

For anything bigger use `argparse`, which generates `--help` for you.

## Running commands

```python
import subprocess

result = subprocess.run(["df", "-P", "/"], capture_output=True, text=True, check=True)
usage = int(result.stdout.splitlines()[1].split()[4].rstrip("%"))
```

* pass a **list** of arguments, not a shell string, to avoid injection bugs;
* `check=True` raises if the command fails;
* return a non-zero exit code from your script when a check fails so CI and cron notice.
