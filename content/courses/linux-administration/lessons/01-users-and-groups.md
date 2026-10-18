# Users, groups and shared directories

Every process runs as a **user** (UID) with a primary **group** (GID) and optional
supplementary groups. Access to files is decided from these IDs.

| File | Contents |
|------|----------|
| `/etc/passwd` | accounts: name, UID, GID, home, shell |
| `/etc/shadow` | password hashes and ageing (root-only) |
| `/etc/group` | groups and their members |

```bash
useradd -m -s /bin/bash -G developers alice   # home dir, shell, supplementary group
passwd alice                                  # set a password
usermod -aG docker alice                      # *append* a group (-a matters!)
id alice                                      # uid, gid and groups
groupadd developers
userdel -r bob                                # remove the user and their home
```

System accounts (`useradd --system`) have low UIDs and usually no login shell — services run as
these to limit damage if compromised.

## Collaborating in a shared directory

Special permission bits help teams share files:

| Bit | Octal | On a directory |
|-----|-------|----------------|
| setgid | `2000` | new files inherit the directory's group |
| sticky | `1000` | only a file's owner may delete it (like `/tmp`) |

```bash
chgrp developers /srv/shared
chmod 2770 /srv/shared    # rwx for owner and group, nothing for others, setgid
ls -ld /srv/shared        # drwxrws---
```
