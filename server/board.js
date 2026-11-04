// Shared leaderboard, one entry per handle, kept in server/data/leaderboard.json.
// Profiles are local-only (no accounts), so each client reports its own score and the server trusts it.
// That's fine for the hackathon demo; real accounts would be needed to stop someone posting fake scores.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBoard, weekKey } from '../src/core/rank.js';

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'leaderboard.json');
const MAX_PLAYERS = 5000, HANDLE = /^[A-Za-z0-9_\-]{2,16}$/;
const players = new Map();
try { for (const p of JSON.parse(readFileSync(FILE, 'utf8'))) players.set(p.name.toLowerCase(), p); } catch (e) { /* first run: no file yet */ }

// Writes are batched: at most one file write per second.
let timer = null;
function persist() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify([...players.values()])); }
    catch (e) { console.warn('[board] save failed:', e.message); }
  }, 1000);
}

const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));

// Upserts a player's score. Invalid handles are ignored; numbers are clamped.
export function submit(b) {
  if (typeof b.name !== 'string' || !HANDLE.test(b.name)) return;
  const k = b.name.toLowerCase();
  if (!players.has(k) && players.size >= MAX_PLAYERS) return;
  players.set(k, { name: b.name, xp: int(b.xp, 1e6), wk: int(b.wk, 1e6), week: weekKey(), pro: !!b.pro, vaults: int(b.vaults, 99), streak: int(b.streak, 9999) });
  persist();
}

export const board = name => buildBoard([...players.values()], name);
