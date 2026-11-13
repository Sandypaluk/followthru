import crypto from 'node:crypto';

// Per the product spec (§14): duplicate detection must be deterministic,
// not left to the AI. Two layers:
//
// 1. Message-level: enforced at the DB layer via UNIQUE(source, source_id)
//    in schema.sql. A re-synced Gmail message simply fails the insert and
//    we skip re-analyzing it (see routes/sync.js).
//
// 2. Action-level: a message can be re-analyzed deliberately (e.g. the user
//    asks for a re-check after correcting something upstream), and the AI's
//    phrasing of "the same" action can vary slightly between runs. We guard
//    against duplicate *actions* with a fingerprint: source message id +
//    a normalized version of the action description. Same message, same
//    underlying ask -> same fingerprint -> the review UI shows "already
//    tracked" instead of letting a second copy through.

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function actionFingerprint({ sourceMessageId, description }) {
  const norm = normalizeText(description);
  return crypto.createHash('sha256').update(`${sourceMessageId}::${norm}`).digest('hex');
}

/**
 * Given a db handle and a fingerprint, returns the existing action row if
 * one already exists, or null.
 */
export function findExistingActionByFingerprint(db, fingerprint) {
  return db.prepare('SELECT * FROM actions WHERE fingerprint = ?').get(fingerprint) || null;
}
