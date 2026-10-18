# sudo, packages and scheduled jobs

## Least privilege with sudo

Rather than sharing the root password, grant specific commands with `sudo`. Never edit
`/etc/sudoers` directly — put rules in drop-in files and validate them:

```bash
echo '%developers ALL=(root) NOPASSWD: /usr/bin/apt-get' > /etc/sudoers.d/developers
chmod 0440 /etc/sudoers.d/developers
visudo -cf /etc/sudoers.d/developers    # syntax check — a broken file can lock you out
sudo -l -U alice                        # what may alice run?
```

The rule format is `who host=(as-user) [NOPASSWD:] commands`; `%name` means a group.

## Packages with APT

```bash
apt-get update                 # refresh package indexes
apt-get install -y nginx       # install
apt-cache policy nginx         # which version, from where
dpkg -L nginx | head           # files a package installed
apt-get remove --purge nginx   # remove including configuration
```

## Scheduling with cron

A crontab line is `minute hour day-of-month month day-of-week command`. System files in
`/etc/cron.d/` add a **user** column before the command:

```
# /etc/cron.d/cleanup
30 2 * * *  root  /usr/local/bin/cleanup.sh       # 02:30 every day
*/15 * * * * www-data /usr/local/bin/warm-cache   # every 15 minutes
0 6 * * 1-5 root  /usr/local/bin/report           # 06:00 on weekdays
```

Per-user schedules live in `crontab -e`. On systemd hosts, **timers** (`systemctl list-timers`)
are a modern alternative with logging and dependency handling built in.
