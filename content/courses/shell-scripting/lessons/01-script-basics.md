# Scripts, variables and arguments

A shell script is a text file of commands with a **shebang** line that names its interpreter:

```bash
#!/usr/bin/env bash
echo "Hello from $(hostname)"
```

```bash
chmod +x hello.sh && ./hello.sh
```

## Variables and quoting

```bash
name="world"            # no spaces around =
echo "Hello, $name"     # double quotes expand variables
echo 'Hello, $name'     # single quotes do not
files=$(ls /etc | wc -l) # command substitution
```

**Always quote variables** (`"$file"`) — unquoted values are split on spaces and expanded as globs.

## Arguments

| Variable | Meaning |
|----------|---------|
| `$0` | script name |
| `$1` … `$9` | positional arguments |
| `$#` | number of arguments |
| `$@` | all arguments, each separately quoted when written `"$@"` |
| `$?` | exit status of the last command |

```bash
if [ $# -lt 1 ]; then
  echo "usage: $0 NAME" >&2   # errors go to stderr
  exit 1                      # non-zero means failure
fi
```

## Exit codes

Every command returns 0 for success and 1–255 for failure. Scripts should do the same: callers
(cron, CI systems, other scripts) rely on it.
