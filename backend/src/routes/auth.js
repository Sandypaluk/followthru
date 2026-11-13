import { Router } from 'express';
import db from '../db/db.js';
import { getAuthUrl, exchangeCodeForTokens, getUserEmail } from '../services/gmailService.js';

const router = Router();

// GET /api/auth/google -> returns the URL the frontend should redirect the user to.
router.get('/google', (req, res) => {
  res.json({ url: getAuthUrl() });
});

// GET /api/auth/google/callback -> Google redirects here after consent.
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code');

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await getUserEmail({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });

    db.prepare(
      `INSERT INTO accounts (provider, email, access_token, refresh_token, token_expiry)
       VALUES ('gmail', ?, ?, ?, ?)
       ON CONFLICT(provider, email) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, accounts.refresh_token),
         token_expiry = excluded.token_expiry`
    ).run(email, tokens.access_token, tokens.refresh_token || null, tokens.expiry_date || null);

    // Redirect back to the frontend, connected.
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?connected=1`);
  } catch (err) {
    console.error('OAuth callback failed:', err.message);
    res.status(500).send('Google authorization failed. Check server logs.');
  }
});

// GET /api/auth/status -> is a Gmail account connected?
router.get('/status', (req, res) => {
  const account = db.prepare('SELECT id, email, created_at FROM accounts WHERE provider = ? ORDER BY id DESC LIMIT 1').get('gmail');
  res.json({ connected: !!account, account: account || null });
});

export default router;
