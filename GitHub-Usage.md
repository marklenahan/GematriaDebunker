# How We Used GitHub on This Project

A summary of the GitHub workflow used during the Gematria Debunker project.

---

## Repository

**URL:** https://github.com/marklenahan/GematriaDebunker

The repository was created on GitHub by Mark Lenahan, then connected to the local project folder on Mac. All code lives on the `main` branch.

---

## The Basic Workflow

Every change followed the same three-step pattern:

```bash
git add <files>
git commit -m "Description of change"
git push
```

1. **`git add`** — stages the changed files, telling Git which ones to include in the next commit
2. **`git commit`** — saves a snapshot of those changes with a description
3. **`git push`** — sends the commit to GitHub

Once pushed, Render (the hosting service) detects the change automatically and redeploys the live app at https://gematria-debunker.onrender.com.

---

## Useful Commands We Used

### Check what has changed
```bash
git status
```
Shows which files have been modified, added, or deleted since the last commit.

### See what changed in the files
```bash
git diff
```
Shows the actual line-by-line changes not yet committed.

### See the commit history
```bash
git log --oneline
```
Lists all commits, most recent first, with a short description each.

### Get the latest from GitHub
```bash
git pull
```
Downloads and merges any changes from GitHub into your local copy. Use this if you edited files directly on GitHub (e.g. README).

### See what's on GitHub but not local
```bash
git fetch
git diff --name-only HEAD origin/main
```
`git fetch` checks what's on GitHub without changing local files. The `diff` then lists any files that differ.

---

## Connecting a Local Folder to GitHub

When the project folder already existed locally and the GitHub repo was newly created:

```bash
git init
git remote add origin https://github.com/marklenahan/GematriaDebunker.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

The `-u origin main` on the first push sets up tracking so future pushes just need `git push`.

---

## When GitHub and Local Got Out of Sync

At one point changes were made directly on GitHub (auto-created README), causing the push to be rejected. The fix:

```bash
git pull --rebase
git push
```

`--rebase` replays your local commits on top of the remote ones, keeping the history clean.

---

## Renaming a File in Git

To rename a file so Git tracks the rename (rather than seeing a delete + new file):

```bash
git mv OldName.md NewName.md
git commit -m "Rename OldName to NewName"
git push
```

Using `git mv` instead of a plain filesystem rename keeps the file history intact.

---

## What GitHub Gives You

- **Version history** — every commit is a saved snapshot; you can see exactly what changed and when
- **Backup** — code is safe on GitHub even if the local machine is lost
- **Automatic deployment** — Render watches the GitHub repo and redeploys on every push to `main`
- **Rendered Markdown** — `.md` files (like `Gematria.md` and this file) display with full formatting on the GitHub website
- **Public URL** — anyone can view the code at the repository URL

---

## Files Added to GitHub Over the Course of the Project

| Commit | What was added or changed |
|---|---|
| Initial commit | `wordscore.js`, `wordfind.js`, `lib.js`, `server.js`, `public/index.html`, `20k.txt`, `encodings.json`, `package.json` |
| README | `README.md` (created on GitHub, then pulled locally) |
| UI mockups | `simulator UX.jpg`, `simulator UX.pptx` |
| Documentation | `Gematria.md` (renamed from README.md) |
| Lexicon update | `google-10000-english.txt`, `shortwords.txt` |

---

## `.gitignore`

A `.gitignore` file tells Git which files to never commit — typically things like `node_modules/` (installed packages) and `.DS_Store` (Mac folder metadata). These don't need to be on GitHub because they're either auto-generated or machine-specific.
