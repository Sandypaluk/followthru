// The structured shape every Claude analysis must conform to.
// This is the schema from the product spec, with one addition:
// `thread_context_used` — records whether the model saw only the latest
// message or the full thread, so a reviewer (and the dashboard's "why did
// it suggest this" view) can tell which context the classification came from.
//
// Facts vs. inferences is enforced structurally (two separate arrays) AND
// by prompt instruction (see services/aiAnalysis.js) — the schema alone
// can't guarantee an inference doesn't leak into `facts`, so validation
// here also does a light heuristic check and flags it for the reviewer
// rather than silently trusting the model.

export const VALID_CLASSIFICATIONS = [
  'ACTION_REQUIRED',
  'RESPONSE_REQUIRED',
  'COMMITMENT',
  'FOLLOW_UP',
  'WAITING_FOR_ME',
  'WAITING_FOR_OTHERS',
  'DECISION_REQUIRED',
  'INFORMATION_ONLY',
  'DEADLINE',
  'OTHER',
];

export function emptyAnalysis(messageId) {
  return {
    message_id: messageId,
    classification: [],
    requires_action: false,
    summary: '',
    facts: [],
    actions: [],
    people: [],
    commitments: [],
    dependencies: [],
    response_required: false,
    suggested_response: null,
    follow_up: { required: false, date: null, reason: null },
    waiting_state: { waiting: false, waiting_for: null, reason: null },
    missing_information: [],
    ambiguities: [],
    confidence: 0,
    ai_inferences: [],
    thread_context_used: false,
  };
}

/**
 * Validates the shape of a Claude analysis response.
 * Returns { valid, errors, warnings }. `warnings` are non-fatal issues
 * (e.g. a suspicious fact that reads like an inference) — the analysis is
 * still stored, but flagged for extra scrutiny at review time rather than
 * silently accepted.
 */
export function validateAnalysis(obj) {
  const errors = [];
  const warnings = [];

  if (typeof obj !== 'object' || obj === null) {
    return { valid: false, errors: ['Response is not an object'], warnings };
  }

  const requiredArrays = ['classification', 'facts', 'actions', 'people', 'commitments', 'dependencies', 'missing_information', 'ambiguities', 'ai_inferences'];
  for (const field of requiredArrays) {
    if (!Array.isArray(obj[field])) {
      errors.push(`Field "${field}" must be an array`);
    }
  }

  if (Array.isArray(obj.classification)) {
    for (const c of obj.classification) {
      if (!VALID_CLASSIFICATIONS.includes(c)) {
        errors.push(`Invalid classification value: "${c}"`);
      }
    }
    if (obj.classification.length === 0) {
      errors.push('classification array must not be empty (use ["OTHER"] if truly uncertain)');
    }
  }

  if (typeof obj.requires_action !== 'boolean') errors.push('requires_action must be a boolean');
  if (typeof obj.response_required !== 'boolean') errors.push('response_required must be a boolean');
  if (typeof obj.summary !== 'string') errors.push('summary must be a string');

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
    errors.push('confidence must be a number between 0 and 1');
  }

  if (!obj.follow_up || typeof obj.follow_up !== 'object') {
    errors.push('follow_up must be an object');
  } else if (typeof obj.follow_up.required !== 'boolean') {
    errors.push('follow_up.required must be a boolean');
  }

  if (!obj.waiting_state || typeof obj.waiting_state !== 'object') {
    errors.push('waiting_state must be an object');
  } else if (typeof obj.waiting_state.waiting !== 'boolean') {
    errors.push('waiting_state.waiting must be a boolean');
  }

  if (Array.isArray(obj.actions)) {
    obj.actions.forEach((a, i) => {
      if (typeof a.description !== 'string' || !a.description.trim()) {
        errors.push(`actions[${i}].description is required`);
      }
      if (a.priority && !['high', 'medium', 'low'].includes(a.priority)) {
        errors.push(`actions[${i}].priority must be high|medium|low`);
      }
    });
  }

  // Heuristic guard against inference language leaking into "facts".
  // Not a substitute for the prompt-level instruction — a second line of defense.
  const inferenceMarkers = /\b(appears|likely|probably|seems|suggests|implies|i infer|i assume|might be|could mean)\b/i;
  if (Array.isArray(obj.facts)) {
    obj.facts.forEach((f, i) => {
      if (typeof f === 'string' && inferenceMarkers.test(f)) {
        warnings.push(`facts[${i}] reads like an inference, not an extracted fact: "${f}"`);
      }
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
