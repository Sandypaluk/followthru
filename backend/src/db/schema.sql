-- Followthru database schema
-- Using SQLite for the MVP: zero setup, single file, easy to inspect (`sqlite3 followthru.db`).
-- Swapping to Postgres/Supabase later only touches db.js (see README "Swapping to Postgres").

-- One row per Gmail account the user has connected. Tokens are the only Gmail
-- credential we ever hold; we never see or store the user's Google password.
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT 'gmail',
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, email)
);

-- Normalized source messages (the "common information model" from the spec).
-- source_id + source together are the deterministic de-dupe key: re-syncing
-- the same Gmail message must never create a second row here.
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,               -- 'gmail' | 'linkedin' (future)
  source_id TEXT NOT NULL,            -- Gmail message id
  thread_id TEXT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  timestamp TEXT,
  sender_name TEXT,
  sender_email TEXT,
  recipients TEXT,                    -- JSON array
  subject TEXT,
  content TEXT,                       -- trimmed/plain-text body actually analyzed (see README on retention)
  metadata TEXT,                      -- JSON blob (labels, snippet, etc.)
  analyzed_at TEXT,
  dismissed_at TEXT,                  -- set when a human reviews and decides "nothing to track here"
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, source_id)
);

-- Raw AI output for a message, kept separate from the human-approved action
-- records so we always know what the model said vs. what the human accepted.
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id),
  classification TEXT NOT NULL,       -- JSON array
  requires_action INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  facts TEXT,                         -- JSON array
  ai_inferences TEXT,                 -- JSON array
  people TEXT,                        -- JSON array
  commitments TEXT,                   -- JSON array
  dependencies TEXT,                  -- JSON array
  response_required INTEGER NOT NULL DEFAULT 0,
  suggested_response TEXT,
  follow_up TEXT,                     -- JSON object {required,date,reason}
  waiting_state TEXT,                 -- JSON object {waiting,waiting_for,reason}
  missing_information TEXT,           -- JSON array
  ambiguities TEXT,                   -- JSON array
  confidence REAL,
  thread_context_used INTEGER NOT NULL DEFAULT 0,
  raw_actions TEXT,                   -- JSON array of AI-suggested actions, pre-review
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Human-approved operational records. A row here only exists because a human
-- clicked "Save action" (or edited then saved). Nothing here is auto-created.
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER REFERENCES messages(id),
  title TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  deadline TEXT,
  priority TEXT,                      -- 'high' | 'medium' | 'low'
  status TEXT NOT NULL DEFAULT 'pending', -- suggested|pending|in_progress|waiting|completed|cancelled
  kind TEXT NOT NULL DEFAULT 'action',    -- action|response|follow_up|waiting_for_others
  source TEXT,
  source_message_id TEXT,
  people TEXT,                        -- JSON array
  dependencies TEXT,                  -- JSON array of other action ids
  fingerprint TEXT,                   -- deterministic dedupe key, see dedupe.js
  ai_generated INTEGER NOT NULL DEFAULT 1,
  human_edited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_fingerprint ON actions(fingerprint);
