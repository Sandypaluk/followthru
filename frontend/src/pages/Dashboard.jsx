import { useEffect, useState } from 'react';
import { api } from '../api.js';
import AttentionBanner from '../components/AttentionBanner.jsx';
import ActionRow from '../components/ActionRow.jsx';

function Section({ title, actions, onChange, emptyText }) {
  if (actions.length === 0) return null;
  return (
    <div className="mb-6">
      <p className="text-xs font-mono uppercase tracking-wide text-graphite mb-2">{title} · {actions.length}</p>
      <div className="space-y-px">
        {actions.map((a) => <ActionRow key={a.id} action={a} onChange={onChange} />)}
      </div>
    </div>
  );
}

export default function Dashboard({ refreshKey, onChange }) {
  const [summary, setSummary] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.summary(), api.actions()])
      .then(([s, a]) => { setSummary(s); setActions(a); })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <p className="text-graphite text-sm">Loading…</p>;

  const today = new Date().toISOString().slice(0, 10);
  const active = actions.filter((a) => !['completed', 'cancelled'].includes(a.status));
  const overdue = active.filter((a) => a.deadline && a.deadline < today);
  const dueToday = active.filter((a) => a.deadline === today);
  const waiting = active.filter((a) => a.status === 'waiting' || a.kind === 'waiting_for_others');
  const upcoming = active.filter((a) => a.deadline && a.deadline > today && !waiting.includes(a));
  const noDeadline = active.filter((a) => !a.deadline && !waiting.includes(a));

  const handleChange = () => onChange?.();

  return (
    <div>
      <AttentionBanner summary={summary} />
      <Section title="Overdue" actions={overdue} onChange={handleChange} />
      <Section title="Due today" actions={dueToday} onChange={handleChange} />
      <Section title="Waiting" actions={waiting} onChange={handleChange} />
      <Section title="Upcoming" actions={upcoming} onChange={handleChange} />
      <Section title="No deadline set" actions={noDeadline} onChange={handleChange} />
      {active.length === 0 && (
        <p className="text-sm text-graphite mt-4">No tracked actions yet. Sync Gmail and check the review queue.</p>
      )}
    </div>
  );
}
