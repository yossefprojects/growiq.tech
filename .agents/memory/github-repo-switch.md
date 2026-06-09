---
name: Switching the connected GitHub repo on Replit
description: How to repoint a Replit project to a different GitHub repo/account when the main-agent shell can't do git writes.
---

# Switching the GitHub repo on Replit

The main agent **cannot** run git write commands from the shell — `git remote set-url`,
`git remote add`, `git push`, `git commit` are blocked ("Destructive git operations are
not allowed in the main agent", config.lock). Read-only is fine with `--no-optional-locks`
(`git remote -v`, `git branch -vv`, `git ls-remote <url>`).

**So all repo switching / pushing must be done by the user in the Replit Git UI**, not by me.

UI flow (non-technical user):
- Git pane → gear (Settings) → **Remote** field holds the repo URL. Paste the new URL and
  click **"Create Remote"** to repoint origin.
- **Connections → GitHub** shows the authenticated account (with a **Delete** button to
  unlink). Replit pushes **as that account** — so it must have *write* access to the target repo.
- Git pane (not settings) → **Push** / **Sync Changes N↑** to upload.

**Why pushes fail:**
- Shell push fails with "Password authentication is not supported" — there's no usable token
  in the shell; auth lives in the Replit UI connection only.
- UI push fails with "Authentication failed" / "Unknown Git Error" when the connected GitHub
  account lacks write access to the target repo.
- "Remote ref of current branch is missing, publish your branch" = the target repo is **empty**
  (no `main` branch yet); the first Push must create it.

**How to apply — two ways to grant write access to a different-owner repo:**
1. Keep the existing connection, and **invite that account as a collaborator** on the new repo
   (the invite must be **accepted** from that account before Push works). Simplest if the
   connected account differs from the repo owner.
2. Or **Delete** the GitHub connection and reconnect, logged into the repo-owner account on
   github.com first (browser must be signed in as the right account, or it re-links the old one).

**Verify success without UI:** `git ls-remote <repo-url>` — if `refs/heads/main` matches the
local HEAD commit, the push landed. GitHub account renames redirect old URLs, so an outdated
origin URL can still work via redirect, but repoint it for cleanliness.
