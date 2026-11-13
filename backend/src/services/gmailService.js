import { google } from 'googleapis';

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces refresh_token to be returned even on repeat consent
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
  });
}

export async function exchangeCodeForTokens(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

function gmailClient(account) {
  const client = getOAuthClient();
  client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.token_expiry,
  });
  return google.gmail({ version: 'v1', auth: client });
}

/**
 * Lists message IDs matching a Gmail search query.
 * `query` uses native Gmail search operators, e.g.:
 *   "is:unread newer_than:7d"
 *   "label:clients"
 *   "from:someone@example.com"
 * This is the "ingestion preference" control from the product spec — the
 * user decides what gets analyzed by writing (or picking) the query, not by
 * the system silently reading everything.
 */
export async function listMessageIds(account, { query = 'is:unread', maxResults = 25 } = {}) {
  const gmail = gmailClient(account);
  const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
  return (res.data.messages || []).map((m) => m.id);
}

export async function getMessage(account, messageId) {
  const gmail = gmailClient(account);
  const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  return res.data;
}

/**
 * Fetches the messages preceding `messageId` within the same thread, oldest
 * first, for use as read-only AI context (see aiAnalysis.js thread-context
 * decision). Returns [] for single-message threads.
 */
export async function getPriorThreadMessages(account, threadId, currentMessageId) {
  const gmail = gmailClient(account);
  const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
  const messages = res.data.messages || [];
  const idx = messages.findIndex((m) => m.id === currentMessageId);
  return idx > 0 ? messages.slice(0, idx) : [];
}

export async function getUserEmail(account) {
  const client = getOAuthClient();
  client.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email;
}
