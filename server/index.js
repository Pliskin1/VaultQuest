import 'dotenv/config';
import express from 'express';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mentor, review, hasKey } from './ai.js';
import { mentorFallback, reviewFallback } from './fallback.js';
import { mountReviews } from './reviews.js';

const app = express();
const PORT = process.env.PORT || 8787;
app.use(express.json({ limit: '32kb' }));

// 30 requests / 10 min per IP; over the limit → fallback (never an error to the UI).
const WINDOW = 10 * 60 * 1000, LIMIT = 30, hits = new Map();
function allowed(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (arr.length >= LIMIT) { hits.set(ip, arr); return false; }
  arr.push(now); hits.set(ip, arr); return true;
}
setInterval(() => { const now = Date.now(); for (const [ip, a] of hits) if (!a.some(t => now - t < WINDOW)) hits.delete(ip); }, WINDOW).unref();

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

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(dist)) { app.use(express.static(dist)); app.get(/^\/(?!api\/).*/, (_, res) => res.sendFile(join(dist, 'index.html'))); }

app.listen(PORT, () => console.log(`VaultQuest API on :${PORT} · AI ${hasKey() ? 'on' : 'off (fallback mode)'}`));
