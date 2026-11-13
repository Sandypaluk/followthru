# Followthru — Phase 1

Turns operationally meaningful Gmail messages into a reviewable queue of actions, responses, and follow-ups. Nothing becomes a real task until you approve it.

This is Phase 1 of the build plan: Gmail OAuth → manual sync → normalization → Claude classification → human review → tracked actions → dashboard. LinkedIn is deliberately not implemented (see "LinkedIn" below) — the connector interface exists so it can be added later without touching anything else.

---

## Setup

### 1. Google Cloud (Gmail API)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. Enable the **Gmail API** (APIs & Services → Library).
3. Configure the OAuth consent screen: External, add your own Google account as a **test user** (this keeps you out of Google's verification review — fine for personal/portfolio use, not for public distribution).
4. Create an **OAuth Client ID** (Application type: Web application). Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`.
5. Copy the Client ID and Client Secret into `backend/.env`.

### 2. Anthropic API key

Get a key from [console.anthropic.com](https://console.anthropic.com/settings/keys) and add it to `backend/.env`.

### 3. Install and run

```bash
# Backend
cd backend
cp .env.example .env   # fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY
npm install
npm run dev             # http://localhost:3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Open `http://localhost:5173`, click **Connect Gmail**, authorize, then **Sync Gmail**.

### 4. Run the tests

```bash
cd backend
npm test
```

12 tests covering schema validation and deterministic dedupe, including the exact test cases from the product spec (see "Test cases" below).

---

## What's working (Phase 1 scope)

- Gmail OAuth (read-only scope), token storage, reconnect-safe
- Manual sync with a Gmail search query as the ingestion filter (presets: unread / last 7 days / both; free-text for anything else Gmail search supports — labels, senders, etc.)
- Message normalization into the common source schema (same shape a future LinkedIn connector would produce)
- Claude classification against the full structured schema: classification, facts vs. inferences, actions, people, commitments, dependencies, response detection, follow-up detection, waiting-state detection, missing information, ambiguities, confidence
- Thread-context-aware analysis (see "Design decisions" below)
- Schema validation on every AI response, including a heuristic check that flags inference-sounding language if it leaks into "facts"
- Deterministic duplicate prevention at two levels: DB constraint on re-synced messages, fingerprint on near-duplicate actions
- Full human-in-the-loop review queue: facts/inferences shown separately, suggested actions and responses are editable before saving, nothing is created without an explicit click
- Dashboard: attention banner (overdue / due today / waiting / responses suggested) and sectioned action lists, with inline status updates
- Basic privacy posture: only a trimmed plain-text body is stored (~4000 chars, not full MIME/attachments), OAuth only (no passwords), secrets in `.env`, dismissible/deletable records

## What remains (deferred, matches your "later" list)

- Scheduled/background sync (manual button is correct for V1 — predictable, debuggable)
- Any automated sending — suggested responses are copy-to-clipboard only
- LinkedIn (see below)
- Overdue/waiting *notifications* (the dashboard shows them; nothing pushes yet)
- A "why did it suggest this" trace UI beyond facts/inferences/confidence (the data is there — `thread_context_used`, confidence — a dedicated explain view is a Phase 2 nice-to-have)
- Data-deletion UI (deletion is possible directly against SQLite today; a UI button is Phase 3 per your original scope)

---

## LinkedIn

Not implemented, on purpose. Verified against LinkedIn's official developer documentation: self-serve API access covers only reading your *own* profile (Sign In with LinkedIn) and posting as yourself (Share on LinkedIn). There is no self-serve path to another member's messages or your own inbox — that sits behind partner programs LinkedIn doesn't grant to individual or portfolio applications. `backend/src/services/linkedinConnector.js` documents the connector shape and exactly what would need to change (partner approval + different OAuth scopes) to activate it — nothing else in the codebase would need to change, since Gmail and LinkedIn both feed the same normalized schema.

---

## Design decisions (the "why", per your learning objective)

**SQLite instead of Postgres/Supabase for V1.** Zero setup — no separate server to run, no connection string to manage — and the whole database is one file you can open with `sqlite3 followthru.db` to see exactly what's stored, which matters for a tool handling your own email. The schema is plain SQL with no SQLite-specific syntax beyond `datetime('now')`, so moving to Postgres later is a `db.js` connection-layer swap, not a rewrite. Worth doing once this needs multi-device access or Supabase's auth/hosting.

**Thread context: latest message + up to 3 prior messages, not the whole thread every time.** Analyzing every message in total isolation gets the "deadline changed from Friday to Monday" test case wrong. Re-sending the entire thread on every analysis is expensive and mostly redundant once earlier messages are already resolved. The middle ground — latest message plus a capped window of prior context, with an explicit instruction that later messages override earlier ones — handles the common case cheaply. The tradeoff: a very long, meandering thread could lose nuance from message 1 by the time you're on message 8. Acceptable for V1; if it misfires in practice, the fix is either a larger window or a running thread-summary passed as context instead of raw messages.

**Facts vs. inferences enforced twice.** The system prompt instructs Claude never to put an inference in `facts`, but a prompt instruction alone isn't a guarantee — models drift. The schema validator also runs a heuristic pass (flagging words like "appears", "likely", "suggests" inside `facts`) and surfaces it as a warning rather than silently trusting the output. This is the difference between hoping the model behaves and building a system that doesn't fully depend on it behaving.

**Dedupe is deterministic, not AI-judged.** Message-level: a database uniqueness constraint on `(source, source_id)` — re-syncing physically cannot insert the same Gmail message twice. Action-level: a SHA-256 fingerprint of the source message ID plus a normalized (lowercased, punctuation-stripped) version of the action text — so "Send the revised roadmap" and "Send the revised roadmap!" collide on purpose. Using AI to judge "is this a duplicate?" would reintroduce exactly the kind of unreliable judgment this system exists to keep out of the record-keeping layer.

**Nothing writes to the `actions` table except a human-triggered POST.** The sync endpoint only ever writes to `messages` and `analyses` — tables that represent "what the AI thinks," not "what's operationally true." An `actions` row only exists because a person clicked Save (or edited then saved). This is the actual implementation of the human-in-the-loop principle, not just a UI convention — even if the frontend were bypassed entirely and someone called the API directly, `POST /api/actions` still requires an explicit call with a title.

---

## Test cases (from the product spec)

All eight scenarios from your spec are represented, split between automated unit tests (the ones that are pure logic) and cases the AI call itself must satisfy (which need a live Anthropic key to verify — no golden dataset can substitute for actually running the prompt):

| # | Case | Verified |
|---|------|----------|
| 1 | "Send me the roadmap by Friday" → `ACTION_REQUIRED` | Schema allows it; prompt instructs it — needs live run to confirm model behavior |
| 2 | "Thanks for the update" → `INFORMATION_ONLY`, no invented action | **Unit tested** — `aiSchema.test.js` |
| 3 | "Would love to catch up next week" → response/follow-up | Schema allows it — needs live run |
| 4 | "Let's discuss sometime soon" → follow-up candidate, no invented date | Prompt explicitly instructs this (see "conservative interpretation") — needs live run |
| 5 | Multi-action email → 3 actions with a dependency | **Unit tested** — `aiSchema.test.js` |
| 6 | "Sent to legal, will follow up" → `WAITING_FOR_OTHERS` | Schema allows it — needs live run |
| 7 | Deadline changes mid-thread → latest wins | Architecture implements this (thread context + prompt instruction) — needs live run against a real thread |
| 8 | Same message synced twice → one record, not two | **Unit tested** — `dedupe.test.js`, and confirmed live against the running server (409 on the near-duplicate submission) |

The three "needs live run" rows aren't gaps in the build — they're genuinely untestable without your Anthropic key and real Gmail messages, since they're about model behavior, not code logic. Once you connect both, the fastest way to check them is: sync a small `is:unread` batch, and look at the review queue's classification badges and facts/inferences against what you know the emails actually say.

---

## Project structure

```
followthru/
  backend/
    src/
      db/            schema.sql, db.js
      services/       gmailService, normalize, aiAnalysis, dedupe, linkedinConnector (stub)
      schema/          aiOutputSchema.js (validation)
      routes/          auth, sync, messages, actions
      tests/           aiSchema.test.js, dedupe.test.js
      server.js
    .env.example
  frontend/
    src/
      pages/           Dashboard.jsx, Review.jsx
      components/      ConnectGmail, SyncControl, AttentionBanner, ActionRow,
                        MessageReviewCard, SuggestedActionItem, SuggestedResponseItem,
                        ConfidenceBadge
      api.js
```
