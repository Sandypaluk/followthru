import { Router } from 'express';
import db from '../db/db.js';
import { listMessageIds, getMessage, getPriorThreadMessages } from '../services/gmailService.js';
import { normalizeGmailMessage } from '../services/normalize.js';
import { analyzeMessage } from '../services/aiAnalysis.js';

const router = Router();

function insertMessage(normalized) {
  try {
    const stmt = db.prepare(`
      INSERT INTO messages (source, source_id, thread_id, account_id, timestamp, sender_name, sender_email, recipients, subject, content, metadata)
      VALUES (@source, @source_id, @thread_id, @account_id, @timestamp, @sender_name, @sender_email, @recipients, @subject, @content, @metadata)
    `);
    const info = stmt.run({
      ...normalized,
      recipients: JSON.stringify(normalized.recipients),
      metadata: JSON.stringify(normalized.metadata),
    });
    return { id: info.lastInsertRowid, isNew: true };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      const existing = db.prepare('SELECT id FROM messages WHERE source = ? AND source_id = ?').get(normalized.source, normalized.source_id);
      return { id: existing.id, isNew: false };
    }
    throw err;
  }
}

function storeAnalysis(messageId, analysis) {
  db.prepare(`
    INSERT INTO analyses (
      message_id, classification, requires_action, summary, facts, ai_inferences, people,
      commitments, dependencies, response_required, suggested_response, follow_up,
      waiting_state, missing_information, ambiguities, confidence, thread_context_used, raw_actions
    ) VALUES (
      @message_id, @classification, @requires_action, @summary, @facts, @ai_inferences, @people,
      @commitments, @dependencies, @response_required, @suggested_response, @follow_up,
      @waiting_state, @missing_information, @ambiguities, @confidence, @thread_context_used, @raw_actions
    )
  `).run({
    message_id: messageId,
    classification: JSON.stringify(analysis.classification),
    requires_action: analysis.requires_action ? 1 : 0,
    summary: analysis.summary,
    facts: JSON.stringify(analysis.facts),
    ai_inferences: JSON.stringify(analysis.ai_inferences),
    people: JSON.stringify(analysis.people),
    commitments: JSON.stringify(analysis.commitments),
    dependencies: JSON.stringify(analysis.dependencies),
    response_required: analysis.response_required ? 1 : 0,
    suggested_response: analysis.suggested_response,
    follow_up: JSON.stringify(analysis.follow_up),
    waiting_state: JSON.stringify(analysis.waiting_state),
    missing_information: JSON.stringify(analysis.missing_information),
    ambiguities: JSON.stringify(analysis.ambiguities),
    confidence: analysis.confidence,
    thread_context_used: analysis.thread_context_used ? 1 : 0,
    raw_actions: JSON.stringify(analysis.actions),
  });
  db.prepare('UPDATE messages SET analyzed_at = datetime(\'now\') WHERE id = ?').run(messageId);
}

// POST /api/sync  { query: "is:unread newer_than:7d", maxResults: 25 }
// This is the manual [SYNC GMAIL] button from the spec — no background
// polling in V1, so behavior stays predictable and easy to debug.
router.post('/', async (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE provider = ? ORDER BY id DESC LIMIT 1').get('gmail');
  if (!account) return res.status(400).json({ error: 'No Gmail account connected. Connect Gmail first.' });

  const { query = 'is:unread', maxResults = 25 } = req.body || {};

  const result = { fetched: 0, newMessages: 0, alreadySeen: 0, analyzed: 0, analysisErrors: [] };

  try {
    const ids = await listMessageIds(account, { query, maxResults });
    result.fetched = ids.length;

    for (const gmailId of ids) {
      const raw = await getMessage(account, gmailId);
      const normalized = normalizeGmailMessage(raw, account.id);
      const { id: messageId, isNew } = insertMessage(normalized);

      if (!isNew) {
        result.alreadySeen++;
        continue; // deterministic dedupe — never re-analyze a message we already have
      }
      result.newMessages++;

      let threadContext = [];
      try {
        const priorRaw = await getPriorThreadMessages(account, normalized.thread_id, gmailId);
        threadContext = priorRaw.map((m) => normalizeGmailMessage(m, account.id));
      } catch (e) {
        // Thread context is an enhancement, not a requirement — proceed without it.
        console.warn(`Could not fetch thread context for ${gmailId}:`, e.message);
      }

      const { analysis, errors, warnings } = await analyzeMessage({
        message: { ...normalized, id: messageId },
        threadContext,
      });

      if (!analysis) {
        result.analysisErrors.push({ messageId, gmailId, errors });
        continue;
      }
      if (warnings.length) {
        console.warn(`Analysis warnings for message ${messageId}:`, warnings);
      }

      storeAnalysis(messageId, analysis);
      result.analyzed++;
    }

    res.json(result);
  } catch (err) {
    console.error('Sync failed:', err);
    res.status(500).json({ error: err.message, partial: result });
  }
});

export default router;
