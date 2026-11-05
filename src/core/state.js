// Player state, one save per local profile (localStorage `vaultquest:<handle>`).
// Profiles are local only (no server accounts — out of scope). Demo modes never read or write storage.
import { weekKey } from './rank.js';

export const DEMO_MODE = new URLSearchParams(location.search).get('demo');
export const DEMO = DEMO_MODE !== null;
export const PER_LVL = 300;
export const lvlOf = xp => 1 + Math.floor(xp / PER_LVL);

const USERS = 'vaultquest:users', CUR = 'vaultquest:user';
const keyOf = name => 'vaultquest:' + name.toLowerCase();
// fullName: the real name for certificates (stays on this device); certs: { [lang]: { name, at: 'YYYY-MM-DD', topics: [level titles] } }
const fresh = () => ({ name: '', lang: 'py', xp: 0, done: { py: 0, js: 0 }, stars: {}, ach: [], fresh: [], streak: 1, lastDay: '', questions: 0, pro: false, projects: [], wk: null, fullName: '', certs: {} });
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full/blocked */ } };
const day = (d = new Date()) => d.toISOString().slice(0, 10);

export const S = fresh();
let user = DEMO ? 'demo' : read(CUR, null);

function load(name) {
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, fresh(), read(keyOf(name), {}), { name, fresh: [] });
  // Streak: consecutive days with a session.
  const today = day(), yest = day(new Date(Date.now() - 864e5));
  if (S.lastDay !== today) { S.streak = S.lastDay === yest ? S.streak + 1 : 1; S.lastDay = today; }
  rollWeek();
}
// Weekly XP = XP gained since this week's Monday (UTC). `wk.last` is the XP at the last save (every XP
// change is followed by a save), so when the week rolls over mid-session the new week's baseline is the
// XP before the rollover, and XP earned after it still counts.
function rollWeek() {
  const k = weekKey();
  if (!S.wk || S.wk.start !== k) S.wk = { start: k, base: S.wk && S.wk.last != null ? Math.min(S.wk.last, S.xp) : S.xp, last: S.xp };
}
export const weekXp = () => { rollWeek(); return Math.max(0, S.xp - S.wk.base); };
if (user && !DEMO) load(user);
if (DEMO) { S.name = 'DEMO'; rollWeek(); }

export const save = () => { rollWeek(); S.wk.last = S.xp; if (!DEMO && user) write(keyOf(user), S); };
export const currentUser = () => user;
// Saved profiles on this device; damaged entries in the list are skipped.
export const profiles = () => { const l = read(USERS, []); return (Array.isArray(l) ? l : []).filter(n => typeof n === 'string').map(n => ({ name: n, ...read(keyOf(n), {}) })); };
export const validHandle = n => /^[A-Za-z0-9_\-]{2,16}$/.test(n);

export function login(name) {
  if (DEMO) return;
  user = name; write(CUR, name);
  const list = read(USERS, []);
  if (!list.some(n => n.toLowerCase() === name.toLowerCase())) write(USERS, [...list, name]);
  load(name); save();
}
export function logout() { user = null; try { localStorage.removeItem(CUR); } catch (e) {} }
export const resetState = () => { const n = S.name; Object.keys(S).forEach(k => delete S[k]); Object.assign(S, fresh(), { name: n, lastDay: day() }); save(); };
export const initials = () => (S.name || 'YOU').slice(0, 2).toUpperCase();
