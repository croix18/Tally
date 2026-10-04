# Connecting a Claude session to GitHub — the complete recipe

How the Tally project (`github.com/croix18/Tally`) was set up and pushed from a Claude cloud session, written so
a brand-new session can repeat it without rediscovering the gotchas. Everything here was tested on 26 Sep – 3 Oct 2026.

The short version: **the human creates the repo and a token in the browser; the session keeps the token in a
git-ignored file; every push sends HTTP Basic auth up front with `http.extraheader`, because the sandbox's outbound
proxy breaks git's normal credential handshake.** Only `git push` over HTTPS works from the sandbox — GitHub's REST
API refuses writes (creating repos, releases, Pages settings), so those stay with the human.

---

## 1. Who does what

| Step | Who | Where |
|---|---|---|
| Create the empty repository | Human | github.com in a browser |
| Create a fine-grained personal access token (PAT) | Human | github.com → Settings → Developer settings |
| Paste the token into the chat once | Human | the chat |
| Store the token in a git-ignored file | Session | sandbox |
| Initialise / clone, commit, push | Session | sandbox |
| Verify the push landed | Session | `git ls-remote` |
| Turn on GitHub Pages, make releases, change repo settings | Human | browser (API writes are refused from the sandbox) |
| Rotate the token when the project's pushing is done | Human | browser |

---

## 2. The human's part (once per repository)

### 2a. Create the repository
GitHub → **New repository** → name it (e.g. `Tally`) → leave it **empty** (no README, no .gitignore, no licence —
the session will push a full history). Note the clone URL: `https://github.com/<user>/<repo>.git`.

### 2b. Create a fine-grained token
GitHub → profile menu → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
→ **Generate new token**:

- **Repository access:** *Only select repositories* → pick the one repo.
- **Permissions → Repository permissions:** **Contents: Read and write**. (Metadata read is added automatically.)
  Nothing else is needed for pushing.
- **Expiration:** short — 30 days is plenty for a build sprint. You can always make another.
- Copy the token (it starts with `github_pat_`). It is shown once.

### 2c. Hand it to the session
Paste the token into the chat and say which repo it is for. That is the only time it should ever appear in the
conversation. Once the work is done, **rotate or delete the token** — it has been in a chat transcript.

---

## 3. The session's part

### 3a. Store the token out of git's reach
In the repository directory (`/home/claude/<repo>` in the Tally session):

```sh
cd /home/claude/Tally
printf '%s' 'github_pat_XXXXXXXXXXXXXXXX' > .github-token     # the token the human pasted
chmod 600 .github-token
grep -qx '.github-token' .gitignore 2>/dev/null || echo '.github-token' >> .gitignore
git check-ignore .github-token && echo "ignored — good"
```

Rules the session must keep:
- **Never** put the token in the remote URL (`https://TOKEN@github.com/…` leaks it into `.git/config` and into
  every error message).
- **Never** commit it, echo it, or include it in a tool result or a message. Reading the file with `cat` counts as
  echoing it — use `tr -d '[:space:]' < .github-token` inside a variable assignment only.
- Keep it `chmod 600`; keep it git-ignored; check `git status` before every commit so it never shows as untracked.

### 3b. Point the repo at GitHub
A plain URL, no credentials in it:

```sh
git remote add origin https://github.com/croix18/Tally.git      # or: git remote set-url origin …
git remote -v
```

If the project started from a bundle or an existing checkout, clone/unbundle first, then set the remote.

### 3c. Commit identity
GitHub's **email privacy** setting rejects pushes whose commits carry the account's real email ("GH007: Your push
would publish a private email address"). Use the account's no-reply address instead. For Croix it is
`268190892+croix18@users.noreply.github.com` (the number is the GitHub user id — find it under
Settings → Emails, "Keep my email addresses private").

Pass it per command rather than setting it globally, so nothing in the sandbox outlives the session by accident:

```sh
git -c user.name="Croix Shaffer" -c user.email="268190892+croix18@users.noreply.github.com" commit -q -F - <<'EOF'
Short imperative title

Body explaining what changed and why.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_XXXXXXXXXXXXXXXXXXXXXXXXXX
EOF
```

The two trailers are the convention used in the Tally repo: the model that co-authored, and the session URL so a
future reader can find the conversation that produced the commit.

### 3d. Push — the part that is different in the sandbox
Outbound HTTPS from the session goes through an agent proxy. That proxy answers git's **first, unauthenticated**
request with `403`, so git never reaches the point where it would offer credentials — a plain `git push` fails even
with a credential helper configured, and the error looks like a permissions problem when it isn't.

The fix is to attach HTTP Basic auth to **every** request from the start, per command, with `http.extraheader`:

```sh
cd /home/claude/Tally
T=$(tr -d '[:space:]' < .github-token)
B=$(printf 'x-access-token:%s' "$T" | base64 -w0)
git -c "http.https://github.com/.extraheader=Authorization: Basic $B" push -u origin main
```

Notes on that command:
- `x-access-token` is the username GitHub expects with a PAT over HTTPS; the token is the password.
- `base64 -w0` keeps the header on one line (GNU coreutils; on macOS it would be `base64 | tr -d '\n'`).
- `-c http.https://github.com/.extraheader=…` applies only to github.com and only to this one git invocation. Nothing
  is written to `.git/config`. Repeat the three lines for every push; a small shell function is fine:

```sh
ghpush() { local T B; T=$(tr -d '[:space:]' < .github-token); B=$(printf 'x-access-token:%s' "$T" | base64 -w0); git -c "http.https://github.com/.extraheader=Authorization: Basic $B" "$@"; }
ghpush push origin main
ghpush ls-remote origin main
```

### 3e. Verify — trust the hash, not the push output
Push output through the proxy has occasionally been truncated or empty while the push still succeeded (and the
reverse is conceivable). Always confirm with `ls-remote` and compare to the local HEAD:

```sh
git -c "http.https://github.com/.extraheader=Authorization: Basic $B" ls-remote origin main | cut -f1
git rev-parse HEAD
```

The two hashes must match. The Tally session printed both after every push.

### 3f. When a push fails
Check whether the token can still write, independent of git:

```sh
T=$(tr -d '[:space:]' < .github-token)
curl -s -o /dev/null -w "%{http_code}\n" -u "x-access-token:$T" \
  "https://github.com/croix18/Tally.git/info/refs?service=git-receive-pack"
```

- `200` → the token is fine; the problem is elsewhere (network blip — retry once; or a non-fast-forward — pull first).
- `401` → the token expired or was revoked; ask the human for a new one and overwrite `.github-token`.
- `403` with a proxy-shaped body → the sandbox proxy is refusing; `curl -sS "$HTTPS_PROXY/__agentproxy/status"`
  explains what the session lacks. Do **not** disable TLS verification or unset `HTTPS_PROXY`.

### 3g. Things that do not work from the sandbox (leave them to the human)
- `gh repo create`, releases, enabling GitHub Pages, branch protection, any **write** to the REST API — all refused.
  In the Tally session, enabling Pages (Settings → Pages → Deploy from branch → `main`, root) stayed on the human's
  to-do list.
- The classic GitHub CLI is not installed. Some sessions have a built-in `gh api` that proxies **reads** to
  github.com with the session's own credential; if `gh api repos/croix18/Tally` returns JSON in your session you
  can use it for reads, but pushing still needs the method in 3d.

---

## 4. Habits that kept the repo clean

- **Build before committing.** Tally has a test build (`python3 build.py --test`) that keeps a debug handle and a
  shipped build (`python3 build.py`) that strips it. The shipped build is what gets committed; the test runner
  restores it, but a manual test run must be followed by a plain build. Grep the output file for the debug symbol
  before committing (`grep -c "window.__tally" Tally.html` must print `0`).
- **Tests never write into the tree.** Suites write to a temp directory; a stray fixture or screenshot in the tree
  once got committed by accident. `git status --short` before `git add -A`.
- **Never commit real student data.** Fixtures are scrubbed or synthetic. A `.gitignore` entry for raw exports and a
  habit of checking `git status` are the guards.
- **Document for the next session.** `NOTES.md` in the repo root is read first by any new session: setup, decisions
  and reversals, the weekly routine, open items, and this push recipe. Review rounds live in `ROUND<n>_FINDINGS.md`
  with the raw reports under `review/`.
- **Deliver the file as well as pushing.** The human works from a phone/tablet; after each push the built single
  file was also copied to `/mnt/user-data/outputs/` and sent into the chat so it was one tap away.

---

## 5. Copy-paste block for a new session

Replace the three placeholders and run top to bottom.

```sh
# --- one-time setup ---
cd /home/claude/<REPO>
printf '%s' '<github_pat_…>' > .github-token && chmod 600 .github-token
grep -qx '.github-token' .gitignore 2>/dev/null || echo '.github-token' >> .gitignore
git remote add origin https://github.com/<USER>/<REPO>.git 2>/dev/null || git remote set-url origin https://github.com/<USER>/<REPO>.git

# --- every commit + push ---
git add -A && git status --short
git -c user.name="<Name>" -c user.email="<id>+<USER>@users.noreply.github.com" commit -q -m "Message

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: <session url>"
T=$(tr -d '[:space:]' < .github-token); B=$(printf 'x-access-token:%s' "$T" | base64 -w0)
git -c "http.https://github.com/.extraheader=Authorization: Basic $B" push -u origin main
git -c "http.https://github.com/.extraheader=Authorization: Basic $B" ls-remote origin main | cut -f1
git rev-parse HEAD      # must equal the line above
```

---

## 6. Why each gotcha happens (for the curious)

- **403 before credentials:** git's smart-HTTP protocol makes an anonymous `GET …/info/refs` first and only sends
  credentials after a `401 WWW-Authenticate` challenge. The sandbox proxy replies `403` to that first anonymous
  request, so the challenge never arrives. Pre-authenticating with `extraheader` skips the dance.
- **Email privacy rejection:** with "Block command line pushes that expose my email" on, GitHub refuses any commit
  whose author/committer email is a verified private address. The `<id>+<user>@users.noreply.github.com` address is
  the sanctioned substitute and still links commits to the account.
- **API writes refused:** the session's egress policy allows git traffic but not authenticated REST writes, so
  anything that isn't a push is a browser job.
- **Token in a file, not an env var:** each tool call is a fresh shell, so an exported variable would not persist;
  a `chmod 600`, git-ignored file does, and reading it inside a variable assignment keeps it out of tool output.
