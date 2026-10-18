# Conditions, loops and robust scripts

## Tests

```bash
[ -f "$path" ]   # regular file exists      [ -d "$path" ]  directory exists
[ -z "$s" ]      # string is empty          [ "$a" = "$b" ] strings equal
[ "$n" -gt 5 ]   # numeric comparison: -eq -ne -lt -le -gt -ge
```

```bash
if [ -d "$dir" ]; then
  echo "found"
elif [ -e "$dir" ]; then
  echo "exists but is not a directory"
else
  echo "missing" >&2; exit 2
fi
```

## Loops

```bash
for f in /var/log/*.log; do echo "$f"; done
for i in $(seq 1 5); do echo "$i"; done

while read -r host status; do          # read a file line by line
  [ "$status" = down ] && echo "$host"
done < hosts.txt
```

## Functions

```bash
log() { echo "[$(date +%T)] $*" >&2; }
log "starting backup"
```

## Writing scripts that fail safely

```bash
set -euo pipefail
```

* `-e` exit when a command fails, `-u` treat unset variables as errors,
  `-o pipefail` make a pipeline fail if any part fails.

Run **ShellCheck** on everything you write — it catches quoting bugs and portability problems
before they bite: `shellcheck script.sh`.
