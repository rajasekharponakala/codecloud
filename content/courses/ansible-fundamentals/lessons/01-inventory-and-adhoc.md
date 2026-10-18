# Inventories, modules and ad-hoc commands

Ansible connects to machines over SSH (no agent to install), copies small **modules** across and
runs them. Modules describe a desired state and report whether they **changed** anything.

## Inventory

```ini
# inventory.ini
[web]
web01.example.org
web02.example.org ansible_user=deploy

[db]
db01.example.org

[prod:children]
web
db
```

```bash
ansible-inventory -i inventory.ini --graph
ansible -i inventory.ini all -m ping                  # connectivity check
ansible -i inventory.ini web -m ansible.builtin.package -a "name=nginx state=present" --become
ansible -i inventory.ini db -a "uptime"               # the default module is command
```

`ansible_connection=local` targets the control node itself — handy for labs.

## Useful built-in modules

`package`/`apt`, `service`, `user`, `group`, `file`, `copy`, `template`, `lineinfile`,
`command`/`shell` (last resort: not idempotent), `uri`, `get_url`, `cron`.

Look up any module with `ansible-doc ansible.builtin.user`.
