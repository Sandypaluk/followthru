import { useState } from 'react';
import { api } from '../api.js';

export default function SuggestedActionItem({ action, messageId, sourceMessageId, kind = 'action', onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: action.description || '',
    owner: action.owner || '',
    deadline: action.deadline || '',
    priority: action.priority || 'medium',
  });
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const wasEdited = form.title !== action.description || form.owner !== (action.owner || '') || form.deadline !== (action.deadline || '') || form.priority !== (action.priority || 'medium');

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await api.createAction({
        messageId,
        sourceMessageId,
        title: form.title,
        owner: form.owner || null,
        deadline: form.deadline || null,
        priority: form.priority,
        kind,
        aiGenerated: true,
        humanEdited: wasEdited,
      });
      setSaved(true);
      onSaved?.();
    } catch (e) {
      if (e.status === 409) {
        setSaved(true); // already tracked — treat as resolved from this screen's perspective
      } else {
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (saved) return <p className="text-xs text-response font-mono py-1.5">✓ saved to actions</p>;
  if (dismissed) return <p className="text-xs text-graphite font-mono py-1.5">dismissed</p>;

  return (
    <div className="border border-rule bg-paper/60 px-3 py-2.5">
      {!editing ? (
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm">
            <p>{form.title}</p>
            <p className="text-xs text-graphite font-mono mt-0.5">
              {form.owner && <span>{form.owner} · </span>}
              {form.deadline ? <span>due {form.deadline}</span> : <span>no deadline extracted</span>}
              {form.priority && <span> · {form.priority} priority</span>}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleSave} disabled={busy} className="text-xs bg-accent text-paper px-2.5 py-1 hover:opacity-90 disabled:opacity-50">Save</button>
            <button onClick={() => setEditing(true)} className="text-xs border border-rule px-2.5 py-1 hover:border-accent">Edit</button>
            <button onClick={() => setDismissed(true)} className="text-xs text-graphite px-2.5 py-1 hover:text-ink">Dismiss</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full text-sm border border-rule px-2 py-1 outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <input
              placeholder="Owner"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              className="flex-1 text-xs font-mono border border-rule px-2 py-1 outline-none focus:border-accent"
            />
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="text-xs font-mono border border-rule px-2 py-1 outline-none focus:border-accent"
            />
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="text-xs font-mono border border-rule px-2 py-1 outline-none focus:border-accent"
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={busy} className="text-xs bg-accent text-paper px-2.5 py-1 hover:opacity-90 disabled:opacity-50">Save edited</button>
            <button onClick={() => setEditing(false)} className="text-xs border border-rule px-2.5 py-1">Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-overdue mt-1.5">{error}</p>}
    </div>
  );
}
