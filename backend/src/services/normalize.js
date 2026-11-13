// Converts a raw Gmail API message resource into the normalized schema shared
// across all sources. A future LinkedIn connector must produce the same
// shape (with fields it can't fill left null) — see linkedinConnector.js.

function decodeBase64Url(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractPlainText(payload) {
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts?.length) {
    // Prefer text/plain; fall back to stripping tags from text/html if that's all we get.
    const plain = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);

    for (const part of payload.parts) {
      const nested = extractPlainText(part);
      if (nested) return nested;
    }

    const html = payload.parts.find((p) => p.mimeType === 'text/html');
    if (html?.body?.data) {
      return decodeBase64Url(html.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return '';
}

function getHeader(headers, name) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || null;
}

function parseAddress(raw) {
  if (!raw) return { name: null, email: null };
  const match = raw.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { name: match[1].replace(/"/g, '').trim() || null, email: match[2].trim() };
  return { name: null, email: raw.trim() };
}

// Retention note (see README "Privacy"): we store a trimmed plain-text body,
// capped at ~4000 chars, which is enough for Claude to classify accurately
// without keeping full raw MIME/attachments indefinitely in the database.
const MAX_CONTENT_CHARS = 4000;

export function normalizeGmailMessage(raw, accountId) {
  const headers = raw.payload?.headers || [];
  const { name: senderName, email: senderEmail } = parseAddress(getHeader(headers, 'From'));
  const toRaw = getHeader(headers, 'To') || '';
  const recipients = toRaw.split(',').map((r) => parseAddress(r.trim())).filter((r) => r.email);

  const body = extractPlainText(raw.payload).slice(0, MAX_CONTENT_CHARS);

  return {
    source: 'gmail',
    source_id: raw.id,
    thread_id: raw.threadId,
    account_id: accountId,
    timestamp: getHeader(headers, 'Date') || new Date(Number(raw.internalDate)).toISOString(),
    sender_name: senderName,
    sender_email: senderEmail,
    recipients,
    subject: getHeader(headers, 'Subject'),
    content: body || raw.snippet || '',
    metadata: {
      labelIds: raw.labelIds || [],
      snippet: raw.snippet || '',
    },
  };
}
