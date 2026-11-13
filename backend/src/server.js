import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import messagesRoutes from './routes/messages.js';
import actionsRoutes from './routes/actions.js';

const requiredEnv = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'ANTHROPIC_API_KEY'];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(`\n⚠  Missing environment variables: ${missing.join(', ')}`);
  console.warn('   Copy .env.example to .env and fill these in before connecting Gmail or syncing.\n');
}

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/actions', actionsRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Followthru backend running on http://localhost:${PORT}`));
