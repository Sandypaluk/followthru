const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  authStatus: () => request('/auth/status'),
  authGoogleUrl: () => request('/auth/google'),

  sync: (query, maxResults) => request('/sync', { method: 'POST', body: JSON.stringify({ query, maxResults }) }),

  reviewQueue: () => request('/messages?status=needs_review'),
  allMessages: () => request('/messages?status=all'),
  dismissMessage: (id) => request(`/messages/${id}/dismiss`, { method: 'POST' }),

  actions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/actions${qs ? `?${qs}` : ''}`);
  },
  createAction: (payload) => request('/actions', { method: 'POST', body: JSON.stringify(payload) }),
  updateAction: (id, payload) => request(`/actions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteAction: (id) => request(`/actions/${id}`, { method: 'DELETE' }),
  summary: () => request('/actions/meta/summary'),
};
