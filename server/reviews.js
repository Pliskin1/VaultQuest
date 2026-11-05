// User reviews: JSON file store (server/data/reviews.json), one review per handle (re-submitting edits it).
// No accounts → handles are not verified. Fine for the demo, not for production.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SEED } from '../src/content/reviews.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const FILE = join(DIR, 'reviews.json');
const MAX_STORED = 500, MAX_SERVED = 24, TEXT_MIN = 10, TEXT_MAX = 300;


let list = [];
try { list = JSON.parse(readFileSync(FILE, 'utf8')); if (!Array.isArray(list)) list = []; } catch { list = []; }

function persist() {
  try { mkdirSync(DIR, { recursive: true }); writeFileSync(FILE + '.tmp', JSON.stringify(list)); renameSync(FILE + '.tmp', FILE); }
  catch (e) { console.warn('[reviews] save failed:', e.message); }
}

const clean = s => String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

function validate(b) {
  const name = clean(b.name), text = clean(b.text), stars = Number(b.stars);
  if (!/^[A-Za-z0-9_\-]{2,16}$/.test(name)) return { err: 'Invalid name' };
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { err: 'Rating must be 1–5 stars' };
  if (text.length < TEXT_MIN || text.length > TEXT_MAX) return { err: `Review must be ${TEXT_MIN}–${TEXT_MAX} characters` };
  const lvl = Math.min(99, Math.max(1, Math.floor(Number(b.lvl)) || 1));
  const lang = b.lang === 'js' ? 'js' : 'py';
  return { review: { name, stars, text, lvl, lang, at: Date.now() } };
}

const hits = new Map(), WINDOW = 10 * 60 * 1000, LIMIT = 5;
function allowed(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (arr.length >= LIMIT) return false;
  arr.push(now); hits.set(ip, arr); return true;
}

export function mountReviews(app) {
  app.get('/api/reviews', (_, res) => {
    const real = [...list].sort((a, b) => b.at - a.at).slice(0, MAX_SERVED);
    const seen = new Set(real.map(r => r.name.toLowerCase()));
    const out = real.length >= 8 ? real : [...real, ...SEED.filter(s => !seen.has(s.name.toLowerCase()))];
    res.json({ reviews: out });
  });

  app.post('/api/reviews', (req, res) => {
    if (!allowed(req.ip)) return res.status(429).json({ error: 'Too many requests, try again later' });
    const { review, err } = validate(req.body || {});
    if (err) return res.status(400).json({ error: err });
    list = list.filter(r => r.name.toLowerCase() !== review.name.toLowerCase());
    list.push(review);
    if (list.length > MAX_STORED) list = list.sort((a, b) => b.at - a.at).slice(0, MAX_STORED);
    persist();
    res.json({ ok: true, review });
  });
}
