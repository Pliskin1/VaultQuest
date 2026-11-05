import 'dotenv/config';
import express from 'express';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mentor, review, hasKey } from './ai.js';
import { mentorFallback, reviewFallback } from './fallback.js';
import { mountReviews } from './reviews.js';
import { clean, save, board, flush } from './board.js';

const app = express();
const PORT = process.env.PORT || 8787;
app.use(express.json({ limit: '32kb' }));

// Per-IP sliding-window rate limiter.
function limiter(limit, windowMs) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [ip, a] of hits) if (!a.some(t => now - t < windowMs)) hits.delete(ip); }, windowMs).unref();
  return ip => {
    const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
    if (arr.length >= limit) { hits.set(ip, arr); return false; }
    arr.push(now); hits.set(ip, arr); return true;
  };
}
// AI: 30 requests / 10 min per IP; over the limit → fallback (never an error to the UI).
const allowed = limiter(30, 10 * 60 * 1000);
// Leaderboard: 120 score saves / 10 min per IP; over the limit the score isn't saved but the board is still returned.
const boardAllowed = limiter(120, 10 * 60 * 1000);

// Identical request bodies are answered from memory.
const memo = new Map(), MEMO_MAX = 500;
const keyOf = (route, b) => createHash('sha1').update(route + JSON.stringify(b)).digest('hex');
const remember = (k, v) => { if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value); memo.set(k, v); };

function route(path, run, fallback) {
  app.post(path, async (req, res) => {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    if (!hasKey()) return res.json(fallback(b));
    const k = keyOf(path, b);
    if (memo.has(k)) return res.json(memo.get(k));
    if (!allowed(req.ip)) return res.json(fallback(b));
    try { const out = { ...(await run(b)), source: 'ai' }; remember(k, out); res.json(out); }
    catch (e) { console.warn(`[ai] ${path} failed:`, e?.status || '', e?.message); res.json(fallback(b)); }
  });
}

route('/api/mentor', async b => ({ text: await mentor(b) }), mentorFallback);
route('/api/review', review, reviewFallback);
mountReviews(app);
app.get('/api/health', (_, res) => res.json({ ok: true, ai: hasKey() }));

// Saves the caller's score (valid handle + numeric xp) and returns the rankings: { total, all, week }.
// Over the write limit the score isn't stored, but the caller is still ranked with it.
app.post('/api/leaderboard', (req, res) => {
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const e = clean(b), stored = !!e && boardAllowed(req.ip);
  if (stored) save(e);
  res.json(board(typeof b.name === 'string' ? b.name : null, e && !stored ? b : null));
});

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(dist)) { app.use(express.static(dist)); app.get(/^\/(?!api\/).*/, (_, res) => res.sendFile(join(dist, 'index.html'))); }

// Malformed or oversized JSON → short JSON error (Express's default page shows a stack trace in dev).
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status < 500 ? 'bad request' : 'server error' });
});

// Write pending leaderboard changes before exiting.
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });

app.listen(PORT, () => console.log(`VaultQuest API on :${PORT} · AI ${hasKey() ? 'on' : 'off (fallback mode)'}`));
