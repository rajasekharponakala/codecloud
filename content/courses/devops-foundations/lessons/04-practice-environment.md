# Your practice environment: a first look

Every lab in CodeCloud gives you a **fresh, disposable machine** reachable from your browser:

* the **task panel** on the left lists what to do; **Check** verifies your work by inspecting the
  real state of the machine — it does not care *how* you did it, only that the result is right;
* the **terminal** on the right is a root shell in your private environment;
* the **timer** shows how long the environment lives. You can extend it a couple of times, and
  **End lab** deletes it immediately.

Nothing you do can affect anybody else, so experiment freely — if you break something, end the
lab and start again with a clean machine.

## Try it

Open the Ubuntu playground and run a few commands:

```bash
whoami            # you are root
cat /etc/os-release
uname -r          # the kernel is shared with the host: this is a container
df -h /           # your own filesystem
```

Playgrounds have no tasks; labs do. When you are ready, continue with **Linux Foundations**.
