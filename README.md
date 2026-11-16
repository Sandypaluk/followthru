# Followthru

**Turn the operational meaning of your inbox into approved, tracked actions, without copy-pasting anything into another tool.**

Followthru reads the Gmail messages you choose to sync and uses Claude to work out what each one means: an action you owe, a reply expected, a commitment you made, or something you're waiting on someone else for. The results land in a review queue. **Nothing becomes a task until you approve it.**

> **Status:** working MVP. Gmail only. Runs locally on your own machine.

## Why it exists

Useful information gets trapped in communication channels: a request with a deadline, a promise someone made, a "let's reconnect in October." Turning those into tracked work usually means manually copying them into another tool, which is one more step in the workflow.

The design rule behind Followthru: **don't create a step just to use AI.** The system pulls from the source (Gmail) instead of asking you to paste anything in. It also follows a decision hierarchy: use deterministic code where code is enough, use AI only where human language needs interpreting, and keep a human in charge where context, relationships, or consequences matter.
```

Key design decisions:

- **Approval is structural, not just a UI convention.** The sync step only writes to the `messages` and `analyses` tables, which hold what the AI thinks. A row in `actions` exists only because a person clicked Save.
- **Facts and inferences are kept separate.** Claude returns them in two different fields. A validator also flags inference-sounding language ("appears", "likely") that leaks into the facts list.
- **Conservative interpretation.** The model is instructed never to invent people, dates, meetings, or commitments. Anything unclear is returned as missing information or an ambiguity.
- **Deterministic duplicate prevention.** A database uniqueness constraint on `(source, source_id)` stops a re-synced message from being inserted twice. A SHA-256 fingerprint of the message plus normalized action text stops duplicate actions. AI is not used to judge duplicates.
- **Thread-aware.** Each new message is analyzed with up to three earlier messages from the same thread as read-only context, so "Actually, Monday is fine" overrides an earlier "Friday."
- **Source-agnostic.** Every source is converted into the same normalized message shape, so adding a source means writing a connector, not rewriting the pipeline.

## What works

**Working:** Gmail OAuth (read-only), manual sync with any Gmail search query as the filter, Claude classification and extraction, facts vs. inferences, confidence, suggested response drafts, review queue with edit/save/dismiss, action tracking with status, dashboard with overdue/due today/waiting sections, duplicate prevention.

## Design decisions (the "why", per your learning objective)

**SQLite instead of Postgres/Supabase for V1.** Zero setup — no separate server to run, no connection string to manage — and the whole database is one file you can open with `sqlite3 followthru.db` to see exactly what's stored, which matters for a tool handling your own email. The schema is plain SQL with no SQLite-specific syntax beyond `datetime('now')`, so moving to Postgres later is a `db.js` connection-layer swap, not a rewrite. Worth doing once this needs multi-device access or Supabase's auth/hosting.

**Thread context: latest message + up to 3 prior messages, not the whole thread every time.** Analyzing every message in total isolation gets the "deadline changed from Friday to Monday" test case wrong. Re-sending the entire thread on every analysis is expensive and mostly redundant once earlier messages are already resolved. The middle ground — latest message plus a capped window of prior context, with an explicit instruction that later messages override earlier ones — handles the common case cheaply. The tradeoff: a very long, meandering thread could lose nuance from message 1 by the time you're on message 8. Acceptable for V1; if it misfires in practice, the fix is either a larger window or a running thread-summary passed as context instead of raw messages.

**Facts vs. inferences enforced twice.** The system prompt instructs Claude never to put an inference in `facts`, but a prompt instruction alone isn't a guarantee — models drift. The schema validator also runs a heuristic pass (flagging words like "appears", "likely", "suggests" inside `facts`) and surfaces it as a warning rather than silently trusting the output. This is the difference between hoping the model behaves and building a system that doesn't fully depend on it behaving.

**Dedupe is deterministic, not AI-judged.** Message-level: a database uniqueness constraint on `(source, source_id)` — re-syncing physically cannot insert the same Gmail message twice. Action-level: a SHA-256 fingerprint of the source message ID plus a normalized (lowercased, punctuation-stripped) version of the action text — so "Send the revised roadmap" and "Send the revised roadmap!" collide on purpose. Using AI to judge "is this a duplicate?" would reintroduce exactly the kind of unreliable judgment this system exists to keep out of the record-keeping layer.

**Nothing writes to the `actions` table except a human-triggered POST.** The sync endpoint only ever writes to `messages` and `analyses` — tables that represent "what the AI thinks," not "what's operationally true." An `actions` row only exists because a person clicked Save (or edited then saved). This is the actual implementation of the human-in-the-loop principle, not just a UI convention — even if the frontend were bypassed entirely and someone called the API directly, `POST /api/actions` still requires an explicit call with a title.

## Setup

### 1. Google Cloud (Gmail API)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. Enable the **Gmail API** (APIs & Services → Library).
3. Configure the OAuth consent screen: External, add your own Google account as a **test user** (this keeps you out of Google's verification review — fine for personal/portfolio use, not for public distribution).
4. Create an **OAuth Client ID** (Application type: Web application). Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`.
5. Copy the Client ID and Client Secret into `backend/.env`.


## Why not just use Claude's Gmail connector?

For asking questions about your inbox ("what needs a reply this week?"), the connector is easier and needs no setup. Followthru covers a different layer: **persistent, deduplicated, human-approved records** with statuses and an overdue/waiting dashboard, which a chat conversation doesn't keep between sessions. It's also a worked example of the design pattern (structured extraction, facts vs. inferences, human-in-the-loop) that you can adapt to other sources.

## Setup

**Prerequisites:** Node.js 20 or newer (tested on Node 24), a Google account, and an Anthropic API key. If `npm install` fails while building `better-sqlite3`, switch to a current LTS version of Node.

### 1. Google Cloud (free; no billing required for personal use)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. **APIs & Services → Library:** search for "Gmail API" and click **Enable**.
3. **Google Auth Platform → Branding:** fill in an app name and your email.
4. **Google Auth Platform → Audience:** choose **External**, and under **Test users** add the Gmail address you'll connect. Leave publishing status as **Testing**.
5. **Google Auth Platform → Clients → Create OAuth client:** type **Web application**. Add this authorized redirect URI exactly: `http://localhost:3001/api/auth/google/callback`
6. Copy the **Client ID** and **Client Secret**. Google shows the full secret only when it is created, so copy it right away (you can reset it later if you lose it).

### 2. Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com/settings/keys). Usage is pay-as-you-go. Analyzing one email typically costs a cent or two, so a small test costs pennies. The model is set in `backend/src/services/aiAnalysis.js` if you want to switch to a cheaper one while experimenting.

### 3. Configure

```bash
cd backend
cp .env.example .env        # on Windows PowerShell: copy .env.example .env
```

Open `backend/.env` and fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ANTHROPIC_API_KEY`. Use plain values with no quotes and no spaces around `=`.

**Never commit `.env`.** It is listed in `.gitignore`, and you can verify that with `git check-ignore -v backend/.env`. If a key is ever exposed, rotate it immediately.

### 4. Run

```bash
# terminal 1
cd backend
npm install
npm run dev        # http://localhost:3001

# terminal 2
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Open `http://localhost:5173` in your browser, click **Connect Gmail**, approve access, then run a small first sync such as `is:unread newer_than:1d`. Review the results in the **Review queue** tab.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Google error "Missing required parameter: client_id" | `.env` is missing, misnamed (for example `.env.txt`), or has blank values. Fix it and restart the backend. |
| "Access blocked" / `403 access_denied` | The account you signed in with isn't listed under **Test users** in Google Auth Platform → Audience. |
| `EADDRINUSE` on port 3001 | An old backend process is still running. Close extra terminals and start again. |
| Frontend shows "Request failed: 500" | Check the backend terminal for the actual error. |

## Privacy and data

- Gmail access is **read-only** (`gmail.readonly`). Followthru never sends, deletes, or modifies email.
- Only what matches your sync query is processed.
- Stored locally in `backend/followthru.db`: a trimmed plain-text copy of each synced message (up to about 4,000 characters, no attachments), the AI analysis, and the actions you approve.
- **Message text is sent to the Anthropic API for analysis.** If that isn't acceptable for a given mailbox, don't sync it.
- To delete everything, stop the backend and delete `followthru.db`. You can inspect what is stored at any time with `sqlite3 followthru.db`.
- Secrets live in environment variables and are never exposed to the frontend.

## Tests

```bash
cd backend
node --test "src/tests/*.test.js"
```

The automated tests cover the pure logic: schema validation and deterministic duplicate detection. Whether the model classifies a given email correctly is verified by running real syncs, since no unit test can substitute for that. Spec scenarios exercised so far:

| Scenario | How it was checked |
|---|---|
| "Thanks for the update" is information only, with no invented action | Unit test, and live sync |
| Vague "catch up sometime soon" gets a response draft and no invented date | Live sync |
| Request with a Friday deadline is classified as an action | Live sync |
| Multiple actions with a dependency | Schema unit test (model behavior not yet checked live) |
| Same message synced twice produces one record | Unit test, and live API check |

## Project structure

```
followthru/
  backend/
    src/
      db/          schema.sql, db.js
      services/    gmailService, normalize, aiAnalysis, dedupe, linkedinConnector (stub)
      schema/      aiOutputSchema.js
      routes/      auth, sync, messages, actions
      tests/
      server.js
    .env.example
  frontend/
    src/
      pages/       Dashboard, Review
      components/  review cards, action rows, sync control, etc.
```

## Roadmap

Scheduled sync, calendar integration, a daily briefing, more sources (Slack, Notion), and LinkedIn if official message access ever becomes available.

## License

MIT. See [LICENSE](LICENSE).
