# Processes, pipes and text tools

Every running program is a **process** with a PID.

```bash
ps aux                 # every process
pgrep -fa nginx        # find processes by name
kill 1234              # send SIGTERM (polite stop)
kill -9 1234           # send SIGKILL (cannot be ignored)
```

## Pipes

The `|` operator connects one command's output to the next command's input — the heart of the Unix philosophy.

```bash
grep ERROR app.log | wc -l             # count error lines
grep ERROR app.log | sort | uniq -c    # group identical errors
cut -d' ' -f1 access.log | sort -u     # unique first column
```

Redirect output into files with `>` (overwrite) and `>>` (append).
