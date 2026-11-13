import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import Review from './pages/Review.jsx';
import ConnectGmail from './components/ConnectGmail.jsx';
import SyncControl from './components/SyncControl.jsx';

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [authStatus, setAuthStatus] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    api.authStatus().then(setAuthStatus).catch(() => setAuthStatus({ connected: false }));
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refreshKey]);

  useEffect(() => {
    if (authStatus?.connected) {
      api.reviewQueue().then((rows) => setReviewCount(rows.length)).catch(() => {});
    }
  }, [authStatus, refreshKey]);

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <header className="border-b border-rule">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-2xl tracking-tight">Followthru</h1>
            <span className="text-xs text-graphite font-mono uppercase tracking-wide">operational inbox</span>
          </div>
          {authStatus?.connected && (
            <nav className="flex gap-6 text-sm">
              <button
                onClick={() => setTab('dashboard')}
                className={`pb-1 border-b-2 transition-colors ${tab === 'dashboard' ? 'border-accent text-ink' : 'border-transparent text-graphite hover:text-ink'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setTab('review')}
                className={`pb-1 border-b-2 transition-colors ${tab === 'review' ? 'border-accent text-ink' : 'border-transparent text-graphite hover:text-ink'}`}
              >
                Review queue{reviewCount > 0 && <span className="ml-1.5 text-xs font-mono text-accent">{reviewCount}</span>}
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {authStatus === null && <p className="text-graphite text-sm">Loading…</p>}

        {authStatus && !authStatus.connected && <ConnectGmail onConnected={refresh} />}

        {authStatus?.connected && (
          <>
            <SyncControl account={authStatus.account} onSynced={refresh} />
            <div className="mt-8">
              {tab === 'dashboard' ? <Dashboard refreshKey={refreshKey} onChange={refresh} /> : <Review refreshKey={refreshKey} onChange={refresh} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
