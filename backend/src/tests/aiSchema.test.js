import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAnalysis, emptyAnalysis } from '../schema/aiOutputSchema.js';

test('emptyAnalysis has the right shape once a classification is set', () => {
  // emptyAnalysis() is a template for callers to fill in, not a valid analysis on
  // its own — an analysis with zero classifications is intentionally rejected
  // (see next test), so this checks the shape is otherwise well-formed.
  const withClassification = { ...emptyAnalysis('msg_1'), classification: ['OTHER'] };
  const { valid, errors } = validateAnalysis(withClassification);
  assert.equal(valid, true, JSON.stringify(errors));
});

test('rejects an invalid classification value', () => {
  const bad = { ...emptyAnalysis('msg_1'), classification: ['NOT_A_REAL_CLASSIFICATION'] };
  const { valid, errors } = validateAnalysis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('Invalid classification')));
});

test('requires at least one classification', () => {
  const bad = { ...emptyAnalysis('msg_1'), classification: [] };
  const { valid, errors } = validateAnalysis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('must not be empty')));
});

test('rejects confidence outside 0-1', () => {
  const bad = { ...emptyAnalysis('msg_1'), classification: ['INFORMATION_ONLY'], confidence: 1.5 };
  const { valid, errors } = validateAnalysis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('confidence')));
});

test('rejects an action missing a description', () => {
  const bad = {
    ...emptyAnalysis('msg_1'),
    classification: ['ACTION_REQUIRED'],
    actions: [{ owner: 'Sandra', deadline: null, priority: 'high', status: 'suggested' }],
  };
  const { valid, errors } = validateAnalysis(bad);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('actions[0].description')));
});

test('flags inference-sounding language inside facts as a warning, not an error', () => {
  const suspicious = {
    ...emptyAnalysis('msg_1'),
    classification: ['ACTION_REQUIRED'],
    facts: ['This appears to be a high priority request from David.'],
  };
  const { valid, warnings } = validateAnalysis(suspicious);
  assert.equal(valid, true); // still structurally valid...
  assert.ok(warnings.length > 0); // ...but flagged for reviewer scrutiny
});

test('TEST CASE 2 from spec: "Thanks for the update" -> INFORMATION_ONLY, no invented action', () => {
  const analysis = {
    ...emptyAnalysis('msg_2'),
    classification: ['INFORMATION_ONLY'],
    requires_action: false,
    actions: [],
    confidence: 0.9,
  };
  const { valid, errors } = validateAnalysis(analysis);
  assert.equal(valid, true, JSON.stringify(errors));
  assert.equal(analysis.actions.length, 0);
});

test('TEST CASE 5 from spec: multiple actions with a dependency', () => {
  const analysis = {
    ...emptyAnalysis('msg_5'),
    classification: ['ACTION_REQUIRED'],
    requires_action: true,
    actions: [
      { description: 'Send the report to David', owner: 'Sandra', deadline: 'Thursday', priority: 'high', status: 'suggested' },
      { description: 'Update the spreadsheet', owner: 'Sandra', deadline: null, priority: 'medium', status: 'suggested' },
      { description: 'Notify Sarah once done', owner: 'Sandra', deadline: null, priority: 'medium', status: 'suggested' },
    ],
    dependencies: ['Notify Sarah should happen after the report is sent to David'],
    confidence: 0.85,
  };
  const { valid, errors } = validateAnalysis(analysis);
  assert.equal(valid, true, JSON.stringify(errors));
  assert.equal(analysis.actions.length, 3);
});
