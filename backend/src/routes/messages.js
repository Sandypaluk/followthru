import { Router } from 'express';
import db from '../db/db.js';

const router = Router();

function parseJsonFields(row, fields) {
  const out = { ...row };
  for (const f of fields) {
    try { out[f] = row[f] ? JSON.parse(row[f]) : (Array.isArray(row[f]) ? [] : null); } catch { out[f] = row[f]; }
  }
  return out;
}

const ANALYSIS_JSON_FIELDS = ['classification', 'facts', 'ai_inferences', 'people', 'commitments', 'dependencies', 'follow_up', 'waiting_state', 'missing_information', 'ambiguities', 'raw_actions'];

// GET /api/messages?status=needs_review|all
// The review queue: every analyzed message, with its analysis, that doesn't
// yet have an approved action tied to it (i.e. still awaiting a human decision).
router.get('/', (req, res) => {
  const { status = 'needs_review' } = req.query;

  const rows = db.prepare(`
    SELECT m.*, a.id AS analysis_id, a.classification, a.requires_action, a.summary, a.facts,
           a.ai_inferences, a.people, a.commitments, a.dependencies, a.response_required,
           a.suggested_response, a.follow_up, a.waiting_state, a.missing_information,
           a.ambiguities, a.confidence, a.thread_context_used, a.raw_actions
    FROM messages m
    JOIN analyses a ON a.message_id = m.id
    ORDER BY m.timestamp DESC
  `).all();

  const withActionCounts = rows.map((row) => {
    const actionCount = db.prepare('SELECT COUNT(*) AS c FROM actions WHERE message_id = ?').get(row.id).c;
    return { ...parseJsonFields(row, ANALYSIS_JSON_FIELDS), reviewed: actionCount > 0 || !!row.dismissed_at };
  });

  const filtered = status === 'needs_review' ? withActionCounts.filter((r) => !r.reviewed) : withActionCounts;
  res.json(filtered);
});

// POST /api/messages/:id/dismiss -> human reviewed it and decided nothing needs tracking.
router.post('/:id/dismiss', (req, res) => {
  const info = db.prepare('UPDATE messages SET dismissed_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Message not found' });
  res.json({ ok: true });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT m.*, a.id AS analysis_id, a.classification, a.requires_action, a.summary, a.facts,
           a.ai_inferences, a.people, a.commitments, a.dependencies, a.response_required,
           a.suggested_response, a.follow_up, a.waiting_state, a.missing_information,
           a.ambiguities, a.confidence, a.thread_context_used, a.raw_actions
    FROM messages m LEFT JOIN analyses a ON a.message_id = m.id
    WHERE m.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Message not found' });
  res.json(parseJsonFields(row, ANALYSIS_JSON_FIELDS));
});

export default router;
