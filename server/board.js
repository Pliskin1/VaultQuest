// Shared leaderboard, one entry per handle, kept in server/data/leaderboard.json.
// Profiles are local-only (no accounts), so each client reports its own score and the server trusts it.
// That's fine for the hackathon demo; real accounts would be needed to stop someone posting fake scores.
import { readFileSync, writeFileSync, mkdirSync, renameSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBoard, weekKey } from '../src/core/rank.js';

// LEADERBOARD_FILE overrides the location (tests use a throwaway file).
const FILE = process.env.LEADERBOARD_FILE || join(dirname(fileURLToPath(import.meta.url)), 'data', 'leaderboard.json');
const MAX_PLAYERS = 5000, HANDLE = /^[A-Za-z0-9_\-]{2,16}$/;
const players = new Map();
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));

// A clean entry from untrusted input, or null. Needs a valid handle and a numeric xp, so a bare
// { name } can't reset someone's score to 0. Weekly XP never exceeds total XP.
export function clean(b, week = weekKey(), at = Date.now()) {
  if (!b || typeof b.name !== 'string' || !HANDLE.test(b.name) || typeof b.xp !== 'number' || !Number.isFinite(b.xp)) return null;
  const xp = int(b.xp, 1e6);
  return { name: b.name, xp, wk: Math.min(int(b.wk, 1e6), xp), week: typeof week === 'string' ? week : '', pro: b.pro === true, vaults: int(b.vaults, 99), streak: int(b.streak, 9999), at: Number(at) || 0 };
}

// Load: bad entries are skipped; an unreadable file is copied aside instead of being overwritten later.
(function load() {
  let raw;
  try { raw = readFileSync(FILE, 'utf8'); } catch (e) { return; } // first run: no file yet
  let list;
  try { list = JSON.parse(raw); if (!Array.isArray(list)) throw new Error('not a list'); }
  catch (e) {
    const bad = `${FILE}.corrupt-${Date.now()}`;
    try { copyFileSync(FILE, bad); } catch (_) { /* keep going */ }
    console.warn(`[board] ${FILE} unreadable (${e.message}); kept a copy at ${bad}, starting empty`);
    return;
  }
  for (const p of list) {
    const e = clean(p, p && p.week, p && p.at);
    if (e && players.size < MAX_PLAYERS) players.set(e.name.toLowerCase(), e);
  }
})();

// Writes are batched (at most one per second) and atomic (temp file + rename), so a crash mid-write
// can't leave a half-written file behind.
let timer = null;
function writeNow() {
  clearTimeout(timer); timer = null;
  const data = JSON.stringify([...players.values()]), tmp = FILE + '.tmp';
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(tmp, data);
    try { renameSync(tmp, FILE); } catch (e) { writeFileSync(FILE, data); } // rename can fail on Windows if the file is locked
  } catch (e) { console.warn('[board] save failed:', e.message); }
}
const persist = () => { if (!timer) timer = setTimeout(writeNow, 1000); };
// Writes pending changes now (called on shutdown).
export const flush = () => { if (timer) writeNow(); };

// Stores a clean entry. When the board is full, the player who hasn't saved for the longest time
// makes room, so new players are never locked out.
export function save(e) {
  const k = e.name.toLowerCase();
  if (!players.has(k) && players.size >= MAX_PLAYERS) {
    let oldest = null;
    for (const [key, p] of players) if (oldest === null || p.at < players.get(oldest).at) oldest = key;
    players.delete(oldest);
  }
  players.set(k, e); persist();
}

// Validates and stores a score. Returns true when it was stored.
export function submit(b) { const e = clean(b); if (e) save(e); return !!e; }

// Rankings for `name`. `unsaved` (raw request body) is ranked too without being stored, so a player
// whose save was refused by the rate limit still sees their own position.
export function board(name, unsaved = null) {
  const extra = unsaved && clean(unsaved);
  return buildBoard(extra ? [...players.values(), extra] : [...players.values()], name);
}
