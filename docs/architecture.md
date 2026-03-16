# 4FF-HH — System Architecture

> Full system map for the terminal portfolio at **hahuy.site**.
> Zero npm dependencies on the frontend. Firebase Spark free tier.

---

## 1 · Overall System Architecture

```mermaid
graph TD
    subgraph Browser["🌐 Browser — hahuy.site (GitHub Pages)"]
        direction TB
        FS[filesystem.js<br/>FS tree + path helpers]
        AC[autocomplete.js<br/>Tab completion]
        CMD[commands.js<br/>Command registry]
        IP[init-panels.js<br/>Portfolio overview]
        MP[message-panel.js<br/>Visitor messaging]
        AUTH[auth.js<br/>Owner 2FA]
        NE[note-editor.js<br/>Split-pane editor]
        TERM[terminal.js<br/>Input/Output engine]
        DRG[draggable.js]
        CTX[contextmenu.js]

        FS --> TERM
        AC --> TERM
        CMD --> TERM
        IP --> TERM
        MP --> TERM
        AUTH --> TERM
        NE --> TERM
    end

    subgraph Firebase["🔥 Firebase (asia-southeast1)"]
        RTDB[(Realtime Database<br/>RTDB)]
        CF[Cloud Functions<br/>Node 20]
    end

    subgraph External["📡 External Services"]
        TG[Telegram Bot API]
        GH[GitHub REST API v3]
        GHA[GitHub Actions<br/>auto-deploy]
    end

    subgraph Storage["🗄️ RTDB Paths"]
        direction TB
        S1["/sessions/{name}/messages"]
        S2["/single_messages"]
        S3["/notes/{filename}"]
        S4["/auth_config/passphrase_hash"]
        S5["/auth_otp/{code}"]
        S6["/owner_sessions/{token}"]
        S7["/rate_limits/auth/{ipHash}"]
    end

    MP -- "visitor writes" --> S1
    MP -- "visitor writes" --> S2
    CF -- "Admin SDK" --> S3
    CF -- "Admin SDK" --> S4
    CF -- "Admin SDK" --> S5
    CF -- "Admin SDK" --> S6
    CF -- "Admin SDK" --> S7

    S1 -- "onCreate trigger" --> CF
    S2 -- "onCreate trigger" --> CF
    CF -- "sendMessage" --> TG
    TG -- "POST webhook reply" --> CF
    CF -- "push owner reply" --> S1

    AUTH -- "POST /authRequest<br/>/validateOTP<br/>/verifySession" --> CF
    NE -- "POST /notesList<br/>/notesRead<br/>/notesWrite" --> CF
    NE -- "PUT contents/{file}" --> GH
    GH -- "commit triggers" --> GHA
    GHA -- "deploy to gh-pages" --> Browser
```

---

## 2 · Visitor Message Flow

```mermaid
sequenceDiagram
    actor V as Visitor
    participant T as Terminal (browser)
    participant MP as MessagePanel
    participant RTDB as Firebase RTDB
    participant CF as Cloud Function
    participant TG as Telegram

    V->>T: message Hello!
    T->>MP: confirmSend("Hello!")
    MP->>T: Show captcha (7 + 4 = ?)
    V->>T: 11
    T->>MP: resolvePendingCaptcha("11")
    MP->>T: Show Y/N confirm
    V->>T: y
    T->>MP: resolvePendingConfirm("y")
    MP->>RTDB: push /single_messages/{id}
    RTDB-->>CF: onCreate trigger
    CF->>TG: sendMessage "📩 New message: Hello!"
    CF-->>T: ✓ Message sent!
```

---

## 3 · Live Chat Flow

```mermaid
sequenceDiagram
    actor V as Visitor
    actor O as Owner (Telegram)
    participant T as Terminal
    participant MP as MessagePanel
    participant RTDB as Firebase RTDB
    participant CF as Cloud Function
    participant TG as Telegram Bot

    V->>T: message --name ner
    T->>MP: startChat("ner")
    MP->>RTDB: set /sessions/ner {status:active}
    MP->>RTDB: on("value") listen /sessions/ner/messages
    T-->>V: ✓ Chat panel opens

    V->>T: (types in chat box) Hello owner!
    T->>RTDB: push /sessions/ner/messages {sender:visitor}
    RTDB-->>CF: onCreate trigger
    CF->>TG: sendMessage "💬 [ner] Hello owner!"
    CF->>RTDB: update message with telegramMsgId

    O->>TG: Reply to the forwarded message
    TG->>CF: POST /telegramWebhook
    CF->>RTDB: push /sessions/ner/messages {sender:owner}
    RTDB-->>MP: onValue fires → renderMessage()
    MP-->>V: Owner reply appears in chat panel
```

---

## 4 · Owner Auth Flow (2FA)

```mermaid
sequenceDiagram
    actor O as Owner (terminal)
    participant T as Terminal
    participant A as Auth.js
    participant CF as Cloud Functions
    participant RTDB as Firebase RTDB
    participant TG as Telegram

    O->>T: auth mypassphrase
    T->>A: startAuth("mypassphrase")
    A->>CF: POST /authRequest {passphrase}
    CF->>RTDB: read /auth_config/passphrase_hash
    CF->>CF: sha256(passphrase) == storedHash?

    alt Wrong passphrase
        CF-->>A: 403 {error: "invalid passphrase"}
        A-->>T: ✗ invalid passphrase
    else Correct
        CF->>RTDB: set /auth_otp/XXXXXX {expires, used:false}
        CF->>TG: sendMessage "🔐 Your OTP: XXXXXX"
        CF-->>A: 200 {ok: true}
        A-->>T: ✓ OTP sent. Enter 6-digit code:
    end

    O->>T: 123456
    T->>A: resolveOTP("123456")
    A->>CF: POST /validateOTP {otp}
    CF->>RTDB: read /auth_otp/123456

    alt Invalid / expired / used
        CF-->>A: 403 {error}
        A-->>T: ✗ invalid or expired OTP
    else Valid
        CF->>RTDB: update otp {used:true}
        CF->>RTDB: set /owner_sessions/{token} {expires:+4h}
        CF->>RTDB: delete /auth_otp/123456
        CF-->>A: 200 {token, expires}
        A->>A: store token in localStorage
        A-->>T: ✓ Authenticated. Session valid 240 min.
    end
```

---

## 5 · Notes CRUD Flow

```mermaid
sequenceDiagram
    actor O as Owner
    participant T as Terminal
    participant NE as NoteEditor.js
    participant CF as Cloud Functions
    participant RTDB as Firebase RTDB

    Note over O,RTDB: Requires valid session token from Auth flow

    O->>T: note add ideas.md
    T->>NE: open("ideas.md", "", ctx)
    NE-->>O: Split-pane editor opens (empty)

    O->>NE: types Markdown content
    NE->>NE: live preview updates (300ms debounce)

    O->>NE: Ctrl+S (or :w)
    NE->>CF: POST /notesWrite {token, action:create, filename, content}
    CF->>CF: validateSessionToken(token)
    CF->>RTDB: set /notes/ideas.md {content, createdAt, updatedAt}
    CF-->>NE: 200 {ok:true}
    NE-->>O: status → "saved ✓"

    O->>T: note ls
    T->>CF: POST /notesList {token}
    CF->>RTDB: read /notes (all)
    CF-->>T: [{filename, updatedAt, preview}]
    T-->>O: list with dates + previews

    O->>T: note rm ideas.md
    T->>NE: confirmDelete("ideas.md", ctx)
    NE-->>O: Delete ideas.md? y/n
    O->>T: y
    T->>NE: resolveDelete("y")
    NE->>CF: POST /notesWrite {token, action:delete, filename}
    CF->>RTDB: remove /notes/ideas.md
    CF-->>NE: 200 {ok:true}
    NE-->>O: ✓ Deleted ideas.md
```

---

## 6 · GitHub Deploy Flow

```mermaid
sequenceDiagram
    actor O as Owner
    participant T as Terminal
    participant NE as NoteEditor
    participant CF as Cloud Functions
    participant GH as GitHub API
    participant GHA as GitHub Actions
    participant Site as hahuy.site

    O->>T: deploy content/blog/my-post.md
    T->>NE: startDeploy filepath
    NE-->>O: Prompt - Enter GitHub PAT, not stored

    O->>T: ghp_xxxxxxxxxxxx
    NE->>NE: store PAT in memory only
    NE-->>O: Confirm deploy to GitHub? y/n

    O->>T: y

    NE->>CF: POST /notesRead with session token
    CF-->>NE: Returns note markdown content

    NE->>GH: GET repo file to check if it exists
    GH-->>NE: Returns SHA if exists, 404 if new file

    NE->>GH: PUT repo file with base64 content
    NE->>NE: PAT cleared from memory immediately

    GH-->>NE: 200 with commit URL
    NE-->>O: Pushed - commit URL shown

    GH->>GHA: push event triggers deploy workflow
    GHA->>Site: publishes to gh-pages branch
    Site-->>O: hahuy.site updated live
```

---

## 7 · Firebase RTDB Data Structure

```mermaid
graph LR
    ROOT["/"] --> SESS[sessions/]
    ROOT --> SINGLE[single_messages/]
    ROOT --> NOTES[notes/]
    ROOT --> AUTHCFG[auth_config/]
    ROOT --> AUTHOTP[auth_otp/]
    ROOT --> OWNSESS[owner_sessions/]
    ROOT --> RATELIM[rate_limits/]

    SESS --> SESSNAME["{name}/"]
    SESSNAME --> SESSSTATUS["status: active|closed"]
    SESSNAME --> SESSCREATED["createdAt: timestamp"]
    SESSNAME --> SESSMSG["messages/{id}/"]
    SESSMSG --> MSGCONTENT["content: string"]
    SESSMSG --> MSGSENDER["sender: visitor|owner|auto"]
    SESSMSG --> MSGTIMESTAMP["timestamp: number"]
    SESSMSG --> MSGTGID["telegramMsgId?: number"]

    SINGLE --> SINGLEID["{id}/"]
    SINGLEID --> SC["content: string"]
    SINGLEID --> ST["timestamp: number"]

    NOTES --> NOTEFILE["{filename.md}/"]
    NOTEFILE --> NC["content: string"]
    NOTEFILE --> NCA["createdAt: timestamp"]
    NOTEFILE --> NUA["updatedAt: timestamp"]

    AUTHCFG --> PHASH["passphrase_hash: sha256hex"]

    AUTHOTP --> OTPCODE["{6-digit-code}/"]
    OTPCODE --> OE["expires: timestamp"]
    OTPCODE --> OU["used: boolean"]

    OWNSESS --> TOKEN["{64-char-hex}/"]
    TOKEN --> TE["expires: timestamp"]

    RATELIM --> RLAUTH["auth/{ipHash}/"]
    RLAUTH --> RLC["count: number"]
    RLAUTH --> RLW["window_start: timestamp"]

    style NOTES fill:#1f4e2b,color:#7ee787
    style AUTHCFG fill:#3d2b00,color:#f0883e
    style AUTHOTP fill:#3d2b00,color:#f0883e
    style OWNSESS fill:#3d2b00,color:#f0883e
    style RATELIM fill:#2d1b1b,color:#ff7b72
```

> **RTDB Rules summary:**
> - `sessions`, `single_messages` — visitor-writable (with validate rules)
> - `notes`, `auth_config`, `auth_otp`, `owner_sessions`, `rate_limits` — **`.read: false, .write: false`** (Admin SDK only)

---

## 8 · Why Source Code Exposure Doesn't Expose Your Data

> This repo is public. Anyone can read every line of JS. Here is exactly what they can see and why it still protects your notes.

### What an attacker sees in the source code

```mermaid
graph TD
    subgraph Public["👁 Visible in public source code"]
        FC["Firebase config\napiKey, databaseURL, projectId..."]
        CF_URL["Cloud Function URLs\nhttps://asia-southeast1-...cloudfunctions.net/..."]
        AUTH_LOGIC["Auth flow logic\ncode structure of auth.js"]
        GH_OWNER["GitHub owner + repo name\nhahahuy / 4FF-HH"]
    end

    subgraph Private["🔒 NOT in source code — attacker cannot see"]
        HASH["Passphrase hash\nstored only in Firebase RTDB /auth_config"]
        TELEGRAM["Telegram account\nattacker has no access to your phone"]
        TG_TOKEN["TELEGRAM_TOKEN + TELEGRAM_CHAT_ID\nin functions/.env — never committed"]
        SESSION["Session tokens\ngenerated at runtime, never in code"]
        NOTE_DATA["Note content\nstored in RTDB, locked by rules"]
    end

    FC -->|"cannot read /notes\nrules: .read false"| NOTE_DATA
    CF_URL -->|"needs valid session token\nto call notesList/notesRead"| NOTE_DATA
    AUTH_LOGIC -->|"passphrase hash not in code\nneed Telegram OTP too"| SESSION
```

### Layer-by-layer breakdown

```mermaid
graph LR
    ATK[Attacker]

    ATK -->|"1 - tries Firebase SDK directly\nwith public apiKey"| R1["RTDB rules\n.read false on /notes\n→ PERMISSION_DENIED"]

    ATK -->|"2 - calls POST /notesList\ndirectly in curl"| R2["CF validates token\nrandom 64-char hex\nnot guessable → 403"]

    ATK -->|"3 - calls POST /authRequest\nwith guessed passphrase"| R3["Rate limit: 5 tries per 10 min\nSHA-256 comparison\n→ 403 wrong passphrase"]

    ATK -->|"4 - brute-forces passphrase\noffline SHA-256"| R4["Hash is in RTDB\n.read false\nattacker cannot read it to compare"]

    ATK -->|"5 - gets correct passphrase\nsomehow"| R5["Still needs Telegram OTP\nOTP lives 5 minutes\nonly you receive it"]

    ATK -->|"6 - intercepts OTP"| R6["OTP marked used:true\nbefore response is sent\nreplay is impossible"]
```

### Firebase API key — why it is safe to be public

The Firebase `apiKey` in `message-panel.js` is **not a secret**. It is a project identifier, not a password.

| What `apiKey` controls | What actually controls access |
|---|---|
| Identifies which Firebase project to talk to | Firebase RTDB security rules |
| Allows calling the Firebase SDK | `.read` / `.write` rules on each path |
| Required to be public for web apps | Admin SDK (Cloud Functions) bypasses client rules |

Anyone with the `apiKey` can attempt reads and writes. The RTDB rules are what block them:

```
/notes → .read: false, .write: false
         → blocked for ALL clients regardless of apiKey
         → only Cloud Functions (Admin SDK) can access
```

### The GitHub "drive" data flow — where data actually lives

```mermaid
graph LR
    subgraph Repo["GitHub Repo (public code)"]
        JS["js/note-editor.js\nLogic only, no data"]
        MD["content/blog/post.md\nDeployed content only"]
    end

    subgraph RTDB_Private["Firebase RTDB (private data)"]
        NOTES_NODE["/notes/my-note.md\ncontent, timestamps\n🔒 .read false"]
    end

    subgraph YourBrowser["Your Browser session"]
        SESSION_TOKEN["Session token\nin localStorage\n4-hour expiry"]
    end

    SESSION_TOKEN -->|"authenticate each CF call"| NOTES_NODE
    NOTES_NODE -->|"deploy command\nreads content, base64 encodes"| MD
    MD -->|"GitHub Actions\nauto-deploy"| LIVE["hahuy.site\nlive site"]

    style NOTES_NODE fill:#1f4e2b,color:#7ee787
    style SESSION_TOKEN fill:#3d2b00,color:#f0883e
```

**Key insight:** The repo contains *logic*. The data lives in Firebase RTDB behind server-side rules that no amount of source code reading can bypass. The `deploy` command is a one-way export — it takes private note content and publishes it to the repo only when *you* explicitly trigger it with a PAT that you type, use once, and is immediately cleared from memory.

### What GitHub PAT protects

The PAT is never stored anywhere — not in code, not in Firebase, not in localStorage:

```
deploy command triggers
  → you type PAT into terminal input
  → PAT held in JS variable _githubPAT (memory only)
  → one PUT request to GitHub API
  → _githubPAT = null  (same function, next line)
  → Ctrl+L clears terminal output (PAT never visible in DOM after clear)
```

The only person who can deploy a note to the repo is someone who:
1. Knows your passphrase (not in source code)
2. Has access to your Telegram (physical device)
3. Has a GitHub PAT with `repo` scope (generated by you in GitHub settings)

