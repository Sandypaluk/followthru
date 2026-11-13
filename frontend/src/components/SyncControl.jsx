import { useState } from 'react';
import { api } from '../api.js';

const PRESETS = [
  { label: 'Unread', query: 'is:unread' },
  { label: 'Last 7 days', query: 'newer_than:7d' },
  { label: 'Unread, last 7 days', query: 'is:unread newer_than:7d' },
];

export default function SyncControl({ account, onSynced }) {
  const [query, setQuery] = useState('is:unread newer_than:7d');
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await api.sync(query, 25);
      setLastResult(result);
      onSynced?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="border border-rule bg-white/40 px-5 py-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <span className="text-xs font-mono text-graphite uppercase tracking-wide shrink-0">{account?.email}</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border border-rule bg-white px-2.5 py-1.5 text-sm font-mono focus:border-accent outline-none"
            placeholder="Gmail search query, e.g. is:unread newer_than:7d"
          />
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-accent text-paper px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          {syncing ? 'Syncing…' : 'Sync Gmail'}
        </button>
      </div>

      <div className="flex gap-2 mt-2.5">
        {PRESETS.map((p) => (
          <button
            key={p.query}
            onClick={() => setQuery(p.query)}
            className="text-xs text-graphite border border-rule px-2 py-1 hover:border-accent hover:text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>

      {lastResult && (
        <p className="text-xs text-graphite font-mono mt-3">
          fetched {lastResult.fetched} · {lastResult.newMessages} new · {lastResult.alreadySeen} already seen · {lastResult.analyzed} analyzed
          {lastResult.analysisErrors?.length > 0 && <span className="text-overdue"> · {lastResult.analysisErrors.length} analysis errors</span>}
        </p>
      )}
      {error && <p className="text-xs text-overdue mt-3">{error}</p>}
    </div>
  );
}
