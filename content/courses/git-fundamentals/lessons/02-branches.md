# Branches, merges and tags

A **branch** is a movable pointer to a commit. Creating one is instant, so use one per piece of
work.

```bash
git switch -c feature/health   # create and switch
# ...edit, add, commit...
git switch main
git merge --no-ff feature/health   # always create a merge commit
git branch -d feature/health       # delete the merged branch
```

## Fast-forward vs merge commit

If `main` has not moved since you branched, Git can simply move the pointer
(**fast-forward**). `--no-ff` forces a merge commit, which keeps a visible record that a
feature was integrated.

## Conflicts

When both sides changed the same lines, Git stops and marks the file:

```
<<<<<<< HEAD
port = 8080
=======
port = 9090
>>>>>>> feature/port
```

Edit to the correct result, `git add` the file and `git commit` to finish the merge.

## Tags mark releases

```bash
git tag -a v1.0.0 -m "First release"   # annotated: has author, date and message
git tag                                # list
git show v1.0.0
```

Use [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
