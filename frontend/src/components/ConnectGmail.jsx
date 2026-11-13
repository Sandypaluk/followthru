import { useState } from 'react';
import { api } from '../api.js';

export default function ConnectGmail() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.authGoogleUrl();
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <h2 className="font-display text-3xl mb-3">Nothing connected yet</h2>
      <p className="text-graphite text-sm leading-relaxed mb-8">
        Followthru reads only what you choose to sync, and never sends or acts on your behalf
        without your approval. Connect Gmail to get started.
      </p>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="bg-accent text-paper px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Redirecting…' : 'Connect Gmail'}
      </button>
      {error && <p className="text-overdue text-sm mt-4">{error}</p>}
    </div>
  );
}
