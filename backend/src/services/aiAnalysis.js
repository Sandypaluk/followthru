import Anthropic from '@anthropic-ai/sdk';
import { validateAnalysis, emptyAnalysis } from '../schema/aiOutputSchema.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Thread context decision (see README "Design decisions" for the full tradeoff) ---
// Option A: analyze every message in isolation. Simple, but wrong whenever a later
//   message changes the ask (spec's own example: "Friday" -> "Actually Monday").
// Option B: analyze the full thread every time. Most accurate, but expensive and
//   mostly redundant — earlier messages rarely need re-classifying once resolved.
// Chosen: analyze the LATEST message, with up to 3 prior messages in the same
//   thread passed as read-only context. The model is instructed to let later
//   messages override earlier ones. This is cheap (one call per new message) and
//   handles the "changed deadline" test case, at the cost of occasionally missing
//   nuance from very long threads — acceptable for an MVP, revisit if it misfires.
const MAX_THREAD_CONTEXT_MESSAGES = 3;

const SYSTEM_PROMPT = `You are the analysis engine inside Followthru, an operational assistant that reads a person's Gmail messages and helps them see what needs action, response, or tracking. You are not a chatbot; you produce strict structured JSON that a human will review before anything becomes real.

CORE PRINCIPLE — CONSERVATIVE INTERPRETATION:
You must never invent people, deadlines, meetings, commitments, actions, priorities, relationships, or intentions that are not present in the message. If something is unclear or unstated, say so in "missing_information" or "ambiguities" — do not guess a specific date, time, or person to fill the gap.

FACTS VS. INFERENCES — THIS IS MANDATORY:
"facts" must contain ONLY things the message directly states (who asked what, by when, in what words). "ai_inferences" must contain your interpretation, reasoning, or judgment calls (e.g. "this appears high priority because a specific deadline was given"). Never put an inference in "facts". If you are inferring anything — priority, urgency, tone, intent — it belongs in ai_inferences, not facts.

CLASSIFICATION:
Choose one or more of: ACTION_REQUIRED, RESPONSE_REQUIRED, COMMITMENT, FOLLOW_UP, WAITING_FOR_ME, WAITING_FOR_OTHERS, DECISION_REQUIRED, INFORMATION_ONLY, DEADLINE, OTHER.
Do not force a classification just to produce output — "Thanks for the update" is INFORMATION_ONLY and nothing else. Only use multiple classifications when the message genuinely contains multiple distinct signals.

MULTIPLE ACTIONS:
If a message asks for more than one distinct thing, create a separate entry in "actions" for each, and represent ordering dependencies using the "dependencies" array (e.g. "action 3 depends on action 1" when one clearly should happen after another).

THREAD CONTEXT:
You may be given prior messages in the same thread as read-only context. If a later message changes or supersedes something from an earlier one (a new deadline, a cancelled ask), your analysis must reflect the CURRENT state — the latest message wins. Set "thread_context_used" to true only if you actually relied on the prior messages to reach your conclusion.

Respond with ONLY the JSON object. No preamble, no markdown fences, no explanation outside the JSON.

Schema:
{
  "message_id": string,
  "classification": string[],
  "requires_action": boolean,
  "summary": string (1-2 plain sentences),
  "facts": string[],
  "actions": [{ "description": string, "owner": string|null, "deadline": string|null, "priority": "high"|"medium"|"low"|null, "status": "suggested" }],
  "people": string[],
  "commitments": string[],
  "dependencies": string[] (plain-language descriptions of ordering, e.g. "action 2 should happen after action 1"),
  "response_required": boolean,
  "suggested_response": string|null,
  "follow_up": { "required": boolean, "date": string|null, "reason": string|null },
  "waiting_state": { "waiting": boolean, "waiting_for": string|null, "reason": string|null },
  "missing_information": string[],
  "ambiguities": string[],
  "confidence": number (0 to 1),
  "ai_inferences": string[],
  "thread_context_used": boolean
}`;

function buildUserPrompt({ message, threadContext }) {
  let prompt = '';
  if (threadContext?.length) {
    prompt += `PRIOR MESSAGES IN THIS THREAD (read-only context, oldest first):\n\n`;
    threadContext.forEach((m, i) => {
      prompt += `[${i + 1}] From: ${m.sender_name || m.sender_email}\nDate: ${m.timestamp}\n${m.content}\n\n`;
    });
    prompt += `---\n\n`;
  }
  prompt += `MESSAGE TO ANALYZE:\n\nmessage_id: ${message.id}\nFrom: ${message.sender_name || message.sender_email} <${message.sender_email}>\nSubject: ${message.subject || '(no subject)'}\nDate: ${message.timestamp}\n\n${message.content}`;
  return prompt;
}

/**
 * Analyzes a normalized message with Claude and returns a validated
 * analysis object. Throws only on hard API failure; schema violations are
 * returned as { analysis: null, errors } so the caller can decide what to
 * show the user rather than crashing the sync.
 */
export async function analyzeMessage({ message, threadContext = [] }) {
  const trimmedContext = threadContext.slice(-MAX_THREAD_CONTEXT_MESSAGES);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt({ message, threadContext: trimmedContext }) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) {
    return { analysis: null, errors: ['No text content in Claude response'], warnings: [] };
  }

  let parsed;
  try {
    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { analysis: null, errors: [`Failed to parse JSON: ${e.message}`], warnings: [], raw: textBlock.text };
  }

  const { valid, errors, warnings } = validateAnalysis(parsed);
  if (!valid) {
    return { analysis: null, errors, warnings, raw: parsed };
  }

  return { analysis: parsed, errors: [], warnings };
}

export function fallbackAnalysis(messageId) {
  return emptyAnalysis(messageId);
}
