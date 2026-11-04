// Leaderboard data. POST /api/leaderboard saves this player's score and returns the rankings. When the
// server can't be reached (or in demo mode, which must stay deterministic and offline) the board is built
// locally from this device's profiles plus the made-up rivals, so the screen always has something to show.
import { S, DEMO, profiles, weekXp } from '../core/state.js';
import { buildBoard, weekKey } from '../core/rank.js';

const TIMEOUT = 6000;
const vaultsOf = p => ((p.done && p.done.py) || 0) + ((p.done && p.done.js) || 0);
const mine = () => ({ name: S.name, xp: S.xp, wk: weekXp(), week: weekKey(), pro: !!S.pro, vaults: vaultsOf(S), streak: S.streak });

function localBoard() {
  const wk = weekKey(), myKey = (S.name || '').toLowerCase();
  const others = DEMO ? [] : profiles().filter(p => p.name.toLowerCase() !== myKey).map(p => ({
    name: p.name, xp: p.xp || 0, wk: p.wk && p.wk.start === wk ? Math.max(0, (p.xp || 0) - p.wk.base) : 0, week: wk,
    pro: !!p.pro, vaults: vaultsOf(p), streak: p.streak || 1
  }));
  return buildBoard(S.name ? [...others, mine()] : others, S.name);
}

// Saves this player's score and resolves to { total, all, week, live }. Never rejects.
export async function fetchBoard() {
  if (!DEMO && S.name) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mine()), signal: ctl.signal });
      if (r.ok) { const b = await r.json(); if (b && b.all && b.week) return { ...b, live: true }; }
    } catch (e) { /* offline → local board */ } finally { clearTimeout(to); }
  }
  return { ...localBoard(), live: false };
}
