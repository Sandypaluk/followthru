import { useState } from 'react';

// Note: "Use draft" copies the text to clipboard rather than sending anything.
// Per the product spec, automated sending is explicitly out of scope for V1 —
// the human always sends manually (or approves a send action once that's
// officially supported later).
export default function SuggestedResponseItem({ draft }) {
  const [text, setText] = useState(draft);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return <p className="text-xs text-graphite font-mono py-1.5">dismissed</p>;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — fall back silently, text is still visible/selectable
    }
  }

  return (
    <div className="border border-rule bg-paper/60 px-3 py-2.5">
      <p className="text-xs font-mono uppercase tracking-wide text-response mb-1.5">Suggested response</p>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full text-sm border border-rule px-2 py-1.5 outline-none focus:border-accent"
        />
      ) : (
        <p className="text-sm italic text-ink/90">"{text}"</p>
      )}
      <div className="flex gap-2 mt-2">
        <button onClick={handleCopy} className="text-xs bg-response text-paper px-2.5 py-1 hover:opacity-90">
          {copied ? 'Copied' : 'Use draft (copy)'}
        </button>
        <button onClick={() => setEditing((v) => !v)} className="text-xs border border-rule px-2.5 py-1 hover:border-accent">
          {editing ? 'Done editing' : 'Edit'}
        </button>
        <button onClick={() => setDismissed(true)} className="text-xs text-graphite px-2.5 py-1 hover:text-ink">Dismiss</button>
      </div>
    </div>
  );
}
