# Roles, collections and good practice

## Roles

A **role** packages tasks, handlers, templates, defaults and files for one concern:

```
roles/nginx/
  defaults/main.yml     # lowest-precedence variables
  tasks/main.yml
  handlers/main.yml
  templates/app.conf.j2
```

```yaml
- hosts: web
  roles:
    - role: nginx
      vars: { app_port: 8080 }
```

Scaffold one with `ansible-galaxy role init nginx`.

## Collections

Modules outside `ansible.builtin` ship in **collections** (`community.general`,
`community.postgresql`, `kubernetes.core`, …):

```yaml
# requirements.yml
collections:
  - name: community.postgresql
    version: ">=3.0.0"
```

```bash
ansible-galaxy collection install -r requirements.yml
```

## Good practice

* keep secrets in **Ansible Vault** (`ansible-vault encrypt_string`) or an external secret store;
* lint with `ansible-lint` in CI;
* test roles with **Molecule** against throwaway containers;
* use fully qualified module names (`ansible.builtin.copy`).
