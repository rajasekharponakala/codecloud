# Repositories, the staging area and commits

Git records **snapshots** of your project. Each commit stores the whole tree (efficiently),
its parent commit(s), an author and a message, and is named by a hash.

```bash
git config --global user.name  "Ada Lovelace"
git config --global user.email ada@example.org
git init -b main          # new repository with a main branch
```

## Three places your changes live

```
working tree  --git add-->  staging area (index)  --git commit-->  history
```

```bash
git status                # what changed, what is staged
git add app.py            # stage a file (or: git add -p to stage hunks)
git commit -m "Add app"   # record the staged snapshot
git diff                  # unstaged changes; git diff --staged for staged ones
git log --oneline --graph # history
```

## Undoing things

| Situation | Command |
|-----------|---------|
| Discard unstaged edits to a file | `git restore file` |
| Unstage a file | `git restore --staged file` |
| Fix the last commit's message or content | `git commit --amend` (only if not pushed) |
| Undo a pushed commit safely | `git revert <commit>` (adds an inverse commit) |

Ignore build output and secrets with a `.gitignore` file.
