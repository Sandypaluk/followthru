export default function ConfidenceBadge({ confidence }) {
  const pct = Math.round((confidence ?? 0) * 100);
  const label = pct >= 75 ? 'High' : pct >= 45 ? 'Medium' : 'Low';
  const color = pct >= 75 ? 'text-response' : pct >= 45 ? 'text-today' : 'text-overdue';
  return (
    <span className={`text-xs font-mono ${color}`} title={`${pct}% confidence`}>
      {label} confidence
    </span>
  );
}
