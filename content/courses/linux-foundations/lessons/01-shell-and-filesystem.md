# The shell and the filesystem

Linux organises everything in a single tree rooted at `/`. A few directories you will meet constantly:

| Path | What lives there |
|------|------------------|
| `/etc` | System configuration |
| `/home`, `/root` | User home directories |
| `/var/log` | Log files |
| `/opt` | Add-on applications |

## Moving around

```bash
pwd            # where am I?
ls -la         # list everything, including hidden files, with details
cd /var/log    # change directory
cd ~           # back home
```

## Creating and copying

```bash
mkdir -p a/b/c          # create nested directories
echo "hi" > file.txt    # write (overwrite) a file
cp file.txt copy.txt    # copy
mv copy.txt moved.txt   # move / rename
```

## Permissions

`ls -l` shows a mode such as `-rw-r-----`: three triplets for **owner**, **group** and **others**.
Each of read (`4`), write (`2`) and execute (`1`) adds up to an octal digit, so `rw-r-----` is `640`.

```bash
chmod 640 report.txt         # set the mode
chown -R deploy /opt/app     # change the owner recursively
```

When you are ready, start the lab and practise each of these.
