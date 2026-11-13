import { useState } from 'react';
import { api } from '../api.js';
import ConfidenceBadge from './ConfidenceBadge.jsx';
import SuggestedActionItem from './SuggestedActionItem.jsx';
import SuggestedResponseItem from './SuggestedResponseItem.jsx';

const CLASSIFICATION_LABEL = {
  ACTION_REQUIRED: 'Action required',
  RESPONSE_REQUIRED: 'Response required',
  COMMITMENT: 'Commitment',
  FOLLOW_UP: 'Follow-up',
  WAITING_FOR_ME: 'Waiting on me',
  WAITING_FOR_OTHERS: 'Waiting on others',
  DECISION_REQUIRED: 'Decision required',
  INFORMATION_ONLY: 'Information only',
  DEADLINE: 'Deadline',
  OTHER: 'Other',
};

export default function MessageReviewCard({ message, onChange }) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDismissAll() {
    setBusy(true);
    try {
      await api.dismissMessage(message.id);
      setDismissed(true);
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  if (dismissed) return null;

  const hasSuggestions = message.raw_actions?.length > 0;
  const hasResponse = message.response_required && message.suggested_response;
  const hasWaiting = message.waiting_state?.waiting;
  const hasFollowUp = message.follow_up?.required;

  return (
    <div className="border border-rule bg-white/50 mb-4">
      <div className="px-5 py-4 border-b border-rule">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{message.sender_name || message.sender_email}</p>
            <p className="text-xs text-graphite font-mono mt-0.5">{message.subject || '(no subject)'} · {message.timestamp?.slice(0, 16)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ConfidenceBadge confidence={message.confidence} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {message.classification?.map((c) => (
            <span key={c} className="text-xs font-mono border border-rule px-1.5 py-0.5 text-graphite">
              {CLASSIFICATION_LABEL[c] || c}
            </span>
          ))}
          {message.thread_context_used && (
            <span className="text-xs font-mono px-1.5 py-0.5 text-info" title="This analysis used earlier messages in the thread">
              thread-aware
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {message.summary && <p className="text-sm text-ink">{message.summary}</p>}

        {message.facts?.length > 0 && (
          <div>
            <p className="text-xs font-mono uppercase tracking-wide text-graphite mb-1">Facts</p>
            <ul className="text-sm space-y-0.5">
              {message.facts.map((f, i) => <li key={i} className="text-ink">· {f}</li>)}
            </ul>
          </div>
        )}

        {message.ai_inferences?.length > 0 && (
          <div>
            <p className="text-xs font-mono uppercase tracking-wide text-graphite mb-1">AI inference</p>
            <ul className="text-sm space-y-0.5">
              {message.ai_inferences.map((f, i) => <li key={i} className="italic text-graphite">· {f}</li>)}
            </ul>
          </div>
        )}

        {(message.missing_information?.length > 0 || message.ambiguities?.length > 0) && (
          <div className="text-xs text-today font-mono">
            {message.missing_information?.length > 0 && <p>Missing: {message.missing_information.join('; ')}</p>}
            {message.ambiguities?.length > 0 && <p>Ambiguous: {message.ambiguities.join('; ')}</p>}
          </div>
        )}

        {hasWaiting && (
          <p className="text-sm text-waiting font-mono">Waiting on: {message.waiting_state.waiting_for} {message.waiting_state.reason && `— ${message.waiting_state.reason}`}</p>
        )}
        {hasFollowUp && (
          <p className="text-sm text-today font-mono">Follow-up: {message.follow_up.date || 'no date given'} {message.follow_up.reason && `— ${message.follow_up.reason}`}</p>
        )}

        {hasSuggestions && (
          <div>
            <p className="text-xs font-mono uppercase tracking-wide text-graphite mb-2">AI found {message.raw_actions.length} suggested action{message.raw_actions.length > 1 ? 's' : ''}</p>
            <div className="space-y-2">
              {message.raw_actions.map((a, i) => (
                <SuggestedActionItem
                  key={i}
                  action={a}
                  messageId={message.id}
                  sourceMessageId={message.source_id}
                  kind={hasWaiting ? 'waiting_for_others' : hasFollowUp ? 'follow_up' : 'action'}
                  onSaved={onChange}
                />
              ))}
            </div>
          </div>
        )}

        {hasResponse && <SuggestedResponseItem draft={message.suggested_response} />}

        {!hasSuggestions && !hasResponse && (
          <p className="text-sm text-graphite italic">No action or response suggested — informational.</p>
        )}
      </div>

      <div className="px-5 py-3 border-t border-rule flex justify-end">
        <button
          onClick={handleDismissAll}
          disabled={busy}
          className="text-xs text-graphite hover:text-ink disabled:opacity-50"
        >
          Nothing to track here — dismiss message
        </button>
      </div>
    </div>
  );
}
