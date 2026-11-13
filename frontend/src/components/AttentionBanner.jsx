const ITEMS = [
  { key: 'overdue', label: 'overdue', color: 'text-overdue' },
  { key: 'dueToday', label: 'due today', color: 'text-today' },
  { key: 'waitingForOthers', label: 'waiting on others', color: 'text-waiting' },
  { key: 'waitingForMe', label: 'flagged as waiting', color: 'text-waiting' },
  { key: 'suggestedResponses', label: 'responses suggested', color: 'text-response' },
];

export default function AttentionBanner({ summary }) {
  if (!summary) return null;
  const total = ITEMS.reduce((sum, i) => sum + (summary[i.key] || 0), 0);

  return (
    <div className="border border-rule bg-white/60 px-5 py-4 mb-6">
      <p className="text-xs font-mono uppercase tracking-wide text-graphite mb-3">Your attention</p>
      {total === 0 ? (
        <p className="text-sm text-graphite">Nothing outstanding right now.</p>
      ) : (
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {ITEMS.filter((i) => summary[i.key] > 0).map((i) => (
            <span key={i.key} className="text-sm">
              <span className={`font-mono font-medium ${i.color}`}>{summary[i.key]}</span>{' '}
              <span className="text-graphite">{i.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
