import { Router } from 'express';
import db from '../db/db.js';
import { actionFingerprint, findExistingActionByFingerprint } from '../services/dedupe.js';

const router = Router();

function parseAction(row) {
  return {
    ...row,
    people: row.people ? JSON.parse(row.people) : [],
    dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
    ai_generated: !!row.ai_generated,
    human_edited: !!row.human_edited,
  };
}

// GET /api/actions?status=pending&kind=action
// Powers the dashboard: attention / overdue / waiting / responses sections
// are just different filters over this one table.
router.get('/', (req, res) => {
  const { status, kind } = req.query;
  let sql = 'SELECT * FROM actions WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (kind) { sql += ' AND kind = ?'; params.push(kind); }
  sql += ' ORDER BY (deadline IS NULL), deadline ASC, created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(parseAction));
});

// POST /api/actions
// This is the ONLY way a suggested item becomes a real operational record —
// it always requires an explicit human call (the frontend only reaches this
// endpoint from a "Save action" / "Use draft" button). Nothing here fires
// automatically from a sync.
//
// Body: { messageId, sourceMessageId, title, description, owner, deadline,
//          priority, kind, people, dependencies, aiGenerated, humanEdited }
router.post('/', (req, res) => {
  const {
    messageId, sourceMessageId, title, description, owner, deadline,
    priority, kind = 'action', people = [], dependencies = [],
    aiGenerated = true, humanEdited = false,
  } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

  const fingerprint = actionFingerprint({ sourceMessageId: sourceMessageId || messageId, description: title });
  const existing = findExistingActionByFingerprint(db, fingerprint);
  if (existing) {
    return res.status(409).json({ error: 'This action is already tracked.', existing: parseAction(existing) });
  }

  const info = db.prepare(`
    INSERT INTO actions (message_id, title, description, owner, deadline, priority, status, kind, source, source_message_id, people, dependencies, fingerprint, ai_generated, human_edited)
    VALUES (@message_id, @title, @description, @owner, @deadline, @priority, 'pending', @kind, 'gmail', @source_message_id, @people, @dependencies, @fingerprint, @ai_generated, @human_edited)
  `).run({
    message_id: messageId || null,
    title,
    description: description || null,
    owner: owner || null,
    deadline: deadline || null,
    priority: priority || 'medium',
    kind,
    source_message_id: sourceMessageId || null,
    people: JSON.stringify(people),
    dependencies: JSON.stringify(dependencies),
    fingerprint,
    ai_generated: aiGenerated ? 1 : 0,
    human_edited: humanEdited ? 1 : 0,
  });

  const row = db.prepare('SELECT * FROM actions WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(parseAction(row));
});

// PATCH /api/actions/:id  -> edit fields and/or change status
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM actions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Action not found' });

  const allowed = ['title', 'description', 'owner', 'deadline', 'priority', 'status', 'people', 'dependencies'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = ['people', 'dependencies'].includes(key) ? JSON.stringify(req.body[key]) : req.body[key];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  updates.human_edited = 1;
  updates.updated_at = new Date().toISOString();

  const setClause = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE actions SET ${setClause} WHERE id = @id`).run({ ...updates, id: req.params.id });

  const row = db.prepare('SELECT * FROM actions WHERE id = ?').get(req.params.id);
  res.json(parseAction(row));
});

// DELETE /api/actions/:id -> "Dismiss" for an already-saved action
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM actions WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Action not found' });
  res.status(204).end();
});

// GET /api/actions/summary -> counts for the dashboard's attention banner
router.get('/meta/summary', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = db.prepare(`SELECT COUNT(*) c FROM actions WHERE status NOT IN ('completed','cancelled') AND deadline IS NOT NULL AND deadline < ?`).get(today).c;
  const dueToday = db.prepare(`SELECT COUNT(*) c FROM actions WHERE status NOT IN ('completed','cancelled') AND deadline = ?`).get(today).c;
  const waitingForOthers = db.prepare(`SELECT COUNT(*) c FROM actions WHERE status NOT IN ('completed','cancelled') AND kind = 'waiting_for_others'`).get().c;
  const waitingForMe = db.prepare(`SELECT COUNT(*) c FROM actions WHERE status = 'waiting'`).get().c;
  const suggestedResponses = db.prepare(`SELECT COUNT(*) c FROM analyses WHERE response_required = 1 AND message_id NOT IN (SELECT message_id FROM actions WHERE message_id IS NOT NULL)`).get().c;
  res.json({ overdue, dueToday, waitingForOthers, waitingForMe, suggestedResponses });
});

export default router;
