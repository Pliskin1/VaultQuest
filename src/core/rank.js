// Leaderboard ranking. Pure (no DOM, no storage) so the server (server/board.js) and the client's
// offline fallback (src/ui/board.js) rank players exactly the same way.
import { RIVALS } from '../content/leaderboard.js';

// ISO date of this week's Monday (UTC). Weekly XP only counts while its week key is the current one.
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - (t.getUTCDay() + 6) % 7);
  return t.toISOString().slice(0, 10);
}

const key = n => String(n).toLowerCase();
const byName = (a, b) => key(a.name).localeCompare(key(b.name));

// players: real players [{ name, xp, wk, week, pro, vaults, streak }]; RIVALS are added unless a real
// player owns the handle. Returns { total, all, week }, each board = { top, me, above }.
export function buildBoard(players, meName, size = 10) {
  const wk = weekKey(), taken = new Set(players.map(p => key(p.name)));
  const rows = [...RIVALS.filter(r => !taken.has(key(r.name))).map(r => ({ ...r, week: wk })), ...players]
    .map(p => ({ ...p, wk: p.week === wk ? p.wk : 0 }));
  // Rank at the start of the week (total XP minus this week's XP) drives the ▲/▼ arrows.
  const before = new Map([...rows].sort((a, b) => (b.xp - b.wk) - (a.xp - a.wk) || byName(a, b)).map((p, i) => [key(p.name), i + 1]));
  const board = (score, arrows) => {
    const list = [...rows].sort((a, b) => score(b) - score(a) || byName(a, b)).map((p, i) => ({
      name: p.name, pro: !!p.pro, xp: p.xp, vaults: p.vaults, streak: p.streak, score: score(p), rank: i + 1,
      move: arrows ? before.get(key(p.name)) - (i + 1) : 0, me: !!meName && key(p.name) === key(meName)
    }));
    const mi = list.findIndex(p => p.me);
    return { top: list.slice(0, size), me: mi >= 0 ? list[mi] : null, above: mi > 0 ? list[mi - 1] : null };
  };
  return { total: rows.length, all: board(p => p.xp, true), week: board(p => p.wk, false) };
}
