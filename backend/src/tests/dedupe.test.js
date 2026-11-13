import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionFingerprint } from '../services/dedupe.js';

test('same message + same description -> same fingerprint', () => {
  const a = actionFingerprint({ sourceMessageId: 'gmail_123', description: 'Send the revised roadmap' });
  const b = actionFingerprint({ sourceMessageId: 'gmail_123', description: 'Send the revised roadmap' });
  assert.equal(a, b);
});

test('fingerprint is resilient to trivial rephrasing/punctuation/case', () => {
  const a = actionFingerprint({ sourceMessageId: 'gmail_123', description: 'Send the revised roadmap!' });
  const b = actionFingerprint({ sourceMessageId: 'gmail_123', description: 'send the revised roadmap' });
  assert.equal(a, b);
});

test('different messages produce different fingerprints even with identical text', () => {
  const a = actionFingerprint({ sourceMessageId: 'gmail_123', description: 'Send the roadmap' });
  const b = actionFingerprint({ sourceMessageId: 'gmail_999', description: 'Send the roadmap' });
  assert.notEqual(a, b);
});

test('TEST CASE 8 from spec: same Gmail message synced twice -> one fingerprint, not two', () => {
  // Simulates re-analysis producing near-identical action descriptions after a second sync.
  const first = actionFingerprint({ sourceMessageId: 'gmail_abc', description: 'Send revised programme roadmap to David' });
  const second = actionFingerprint({ sourceMessageId: 'gmail_abc', description: 'Send revised programme roadmap to David.' });
  assert.equal(first, second, 'A second sync of the same message should collide on fingerprint, preventing a duplicate action.');
});
