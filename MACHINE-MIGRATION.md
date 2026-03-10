# Machine Migration Guide — 4FF-HH Terminal Portfolio

How to fully remove this project from the current machine and bring it up
from scratch on a new one. Every step is exact and in order.

---

## Part 1 — Before You Delete Anything

These files are **not in git**. They live only on this machine. Copy them
somewhere safe (USB, cloud notes, password manager) before you wipe the repo.

### 1.1 — Copy your secrets

Open `functions/.env` and save these three values:

```
TELEGRAM_TOKEN=<copy the value>
TELEGRAM_CHAT_ID=<copy the value>
WEBHOOK_SECRET=<copy the value — blank is fine if you never generated one>
```

That file is gitignored and will not be on the new machine after cloning.

### 1.2 — Commit all unsaved work

Right now there are uncommitted changes in the working tree:

```
modified:   content/projects.md
modified:   content/shorter-about.md
modified:   css/style.css
modified:   functions/index.js
modified:   index.html
modified:   js/commands.js
modified:   js/contextmenu.js
modified:   js/message-panel.js
modified:   js/terminal.js
modified:   tests/index.html
modified:   tests/suite.js
deleted:    message-plan.md

untracked:  content/resume.pdf
            functions/test.js
            functions/test_logic.py
```

Run this to commit everything:

```bash
cd C:\Users\quanghuy.ha\Documents\Github\4FF-HH

git add content/projects.md content/shorter-about.md css/style.css \
        functions/index.js index.html js/commands.js js/contextmenu.js \
        js/message-panel.js js/terminal.js tests/index.html tests/suite.js \
        content/resume.pdf functions/test.js functions/test_logic.py

# message-plan.md was deleted — stage the deletion
git rm message-plan.md

git commit -m "feat: implement plan improvements — protection, UX, tests"

git push origin master
```

Verify on GitHub: https://github.com/hahahuy/4FF-HH
All files should appear there before you wipe the local copy.

### 1.3 — Verify GitHub Pages is live

After push, GitHub Actions deploys automatically.
Check: https://hahuy.site — the site should still work.

---

## Part 2 — Delete From This Machine

Once you have confirmed the push succeeded and the secrets are saved:

```bash
# Remove the entire repo folder
rmdir /s /q "C:\Users\quanghuy.ha\Documents\Github\4FF-HH"
```

Or in File Explorer: navigate to `Documents\Github\`, right-click `4FF-HH` → Delete.

That is all. Nothing else on this machine belongs to the project.
Firebase and the deployed Cloud Functions live in Google's cloud — they
are unaffected by deleting the local folder.

---

## Part 3 — Set Up on the New Machine

Work through these sections top to bottom. Each section depends on the
previous one being done.

---

### 3.1 — Install required tools

You need three things. Check if each is already installed first.

**Node.js 20**
```bash
node --version   # should print v20.x.x
```
If missing: https://nodejs.org → download the LTS installer (v20).

**Firebase CLI**
```bash
firebase --version   # should print 13.x or higher
```
If missing:
```bash
npm install -g firebase-tools
```

**Git**
```bash
git --version
```
If missing: https://git-scm.com/download/win

---

### 3.2 — Clone the repo

```bash
cd Documents\Github          # or wherever you keep projects
git clone https://github.com/hahahuy/4FF-HH.git
cd 4FF-HH
```

---

### 3.3 — Restore the secrets file

Create `functions/.env` with the values you saved in step 1.1:

```bash
# In the repo root:
notepad functions\.env
```

Paste exactly this (filling in your values):

```
TELEGRAM_TOKEN=8743610828:AAFvTt61wD3VeagoIVoJVw7NLW4WzLBXkxQ
TELEGRAM_CHAT_ID=1244949484
WEBHOOK_SECRET=<your value, or leave blank>
```

Save and close. Verify it looks right:

```bash
type functions\.env
```

**Do not commit this file.** It is already in `.gitignore`.

---

### 3.4 — Install Cloud Function dependencies

```bash
cd functions
npm install
cd ..
```

This recreates `functions/node_modules/` which is also gitignored.

---

### 3.5 — Log in to Firebase

```bash
firebase login
```

A browser window will open. Sign in with the Google account that owns
the `hahuy-portfolio` Firebase project (the one with the Telegram token).

After login, verify the CLI can see your project:

```bash
firebase projects:list
# Should show: hahuy-portfolio
```

---

### 3.6 — Verify the Firebase project link

```bash
cat .firebaserc
# Should print:
# { "projects": { "default": "hahuy-portfolio" } }
```

If it shows a different project, run:

```bash
firebase use hahuy-portfolio
```

---

### 3.7 — Deploy Cloud Functions

```bash
firebase deploy --only functions
```

Expected output: 4 functions deployed successfully:
- `onNewSingleMessage`
- `onNewSessionMessage`
- `telegramWebhook`
- `cleanupStaleSessions`

If you see a billing error for `cleanupStaleSessions` (the scheduler):

```bash
gcloud services enable cloudscheduler.googleapis.com --project hahuy-portfolio
firebase deploy --only functions
```

---

### 3.8 — Register the Telegram webhook (only if WEBHOOK_SECRET changed)

If you kept the same `WEBHOOK_SECRET` from the old machine, and the
Cloud Function URL didn't change, the webhook is already registered and
you can skip this step.

If you generated a new secret, run this to re-register it with Telegram:

```bash
curl "https://api.telegram.org/bot8743610828:AAFvTt61wD3VeagoIVoJVw7NLW4WzLBXkxQ/setWebhook?url=https://asia-southeast1-hahuy-portfolio.cloudfunctions.net/telegramWebhook&secret_token=YOUR_WEBHOOK_SECRET"
```

Expected response: `{"ok":true,"description":"Webhook was set"}`

---

### 3.9 — Smoke test everything

**Frontend** — open `index.html` directly in a browser:
```
file:///C:/Users/<you>/Documents/Github/4FF-HH/index.html
```
- Type `help` → all commands listed
- Type `theme dracula` → colours change
- Type `neofetch` → system info shown
- Type `ls` → files appear, clickable

**Backend logic tests** (no Firebase connection needed):
```bash
python functions\test_logic.py
# Expected: 41/41 passed
```

**Browser test suite** — needs a local server because `fetch()` doesn't
work on `file://`:
```bash
# From repo root:
python -m http.server 8080
# Then open in browser:
# http://localhost:8080/tests/index.html
```
All tests should show green.

**Live message test** — from the terminal on the site:
```
message hello from new machine
```
Solve the captcha → confirm with `y` → check Telegram for the notification.

---

## Quick-reference checklist

```
BEFORE deleting old machine:
[ ] Copy TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, WEBHOOK_SECRET from functions/.env
[ ] Commit and push all modified/untracked files listed in Part 1.2
[ ] Confirm push on github.com/hahahuy/4FF-HH
[ ] Confirm hahuy.site still loads after push

Delete old machine:
[ ] rmdir /s /q "C:\Users\quanghuy.ha\Documents\Github\4FF-HH"

Set up new machine:
[ ] Node.js 20 installed
[ ] Firebase CLI installed  (npm install -g firebase-tools)
[ ] git clone https://github.com/hahahuy/4FF-HH.git
[ ] Recreate functions/.env with all 3 keys
[ ] npm install  (inside functions/)
[ ] firebase login
[ ] firebase deploy --only functions
[ ] Re-register Telegram webhook IF secret changed
[ ] Open tests/index.html via http-server — all green
[ ] Send a test message — arrives in Telegram
```

---

## What lives where (so you know what you're responsible for)

| Thing | Where it lives | Survives machine wipe? |
|---|---|---|
| Frontend code | GitHub repo | ✅ Yes |
| Deployed site | GitHub Pages (gh-pages branch) | ✅ Yes |
| Cloud Functions code | GitHub repo | ✅ Yes |
| Deployed Cloud Functions | Google Cloud / Firebase | ✅ Yes |
| Firebase Realtime Database | Google Cloud | ✅ Yes |
| Telegram bot + chat history | Telegram servers | ✅ Yes |
| `functions/.env` secrets | **Local machine only** | ❌ NO — you must copy these |
| `functions/node_modules/` | Local machine only | Recreated by `npm install` |
| Browser localStorage (history, theme, cwd) | Visitor's browser | N/A — per-visitor |
