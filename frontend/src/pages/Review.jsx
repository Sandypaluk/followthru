import { useEffect, useState } from 'react';
import { api } from '../api.js';
import MessageReviewCard from '../components/MessageReviewCard.jsx';

export default function Review({ refreshKey, onChange }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.reviewQueue().then(setMessages).finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <p className="text-graphite text-sm">Loading…</p>;

  if (messages.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-graphite text-sm">Review queue is empty. Sync Gmail to pull in new messages.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-wide text-graphite mb-4">{messages.length} awaiting review</p>
      {messages.map((m) => (
        <MessageReviewCard key={m.id} message={m} onChange={onChange} />
      ))}
    </div>
  );
}
