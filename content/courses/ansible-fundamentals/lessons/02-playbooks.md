# Playbooks, variables, templates and handlers

A **playbook** maps hosts to ordered tasks.

```yaml
# site.yml
- name: Configure web servers
  hosts: web
  become: true
  vars:
    app_port: 8080
  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present
    - name: Deploy configuration
      ansible.builtin.template:
        src: templates/app.conf.j2
        dest: /etc/nginx/conf.d/app.conf
        mode: "0644"
      notify: Reload nginx
  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
```

```jinja
# templates/app.conf.j2
server {
    listen {{ app_port }};
    server_name {{ inventory_hostname }};
}
```

```bash
ansible-playbook -i inventory.ini site.yml --syntax-check
ansible-playbook -i inventory.ini site.yml --check --diff   # dry run
ansible-playbook -i inventory.ini site.yml
```

**Handlers** run once at the end of the play, only if a task that notifies them changed.

## Idempotence

Running a good playbook twice reports `changed=0` the second time. Prefer state-describing
modules over `shell`; when you must use `command`, add `creates:` or `changed_when:`.
