import { useState } from 'react';
import { api } from '../api.js';

const RAIL_COLOR = {
  action: 'border-l-accent',
  response: 'border-l-response',
  follow_up: 'border-l-today',
  waiting_for_others: 'border-l-waiting',
};

const STATUS_OPTIONS = ['pending', 'in_progress', 'waiting', 'completed', 'cancelled'];

function isOverdue(deadline, status) {
  if (!deadline || ['completed', 'cancelled'].includes(status)) return false;
  return deadline < new Date().toISOString().slice(0, 10);
}

export default function ActionRow({ action, onChange }) {
  const [busy, setBusy] = useState(false);
  const overdue = isOverdue(action.deadline, action.status);

  async function setStatus(status) {
    setBusy(true);
    try {
      await api.updateAction(action.id, { status });
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rail ${RAIL_COLOR[action.kind] || 'border-l-graphite'} bg-white/60 border-y border-r border-rule px-4 py-3 flex items-center justify-between gap-4`}>
      <div className="min-w-0">
        <p className="text-sm text-ink truncate">{action.title}</p>
        <p className="text-xs text-graphite font-mono mt-0.5">
          {action.owner && <span>{action.owner} · </span>}
          {action.deadline && <span className={overdue ? 'text-overdue font-medium' : ''}>{overdue ? 'overdue · ' : 'due '}{action.deadline}</span>}
          {!action.deadline && <span>no deadline</span>}
          {action.human_edited && <span className="ml-2 text-graphite">· edited</span>}
        </p>
      </div>
      <select
        value={action.status}
        disabled={busy}
        onChange={(e) => setStatus(e.target.value)}
        className="text-xs font-mono border border-rule bg-white px-1.5 py-1 shrink-0 outline-none focus:border-accent"
      >
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}
