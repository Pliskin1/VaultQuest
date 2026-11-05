// Player state, one save per local profile (localStorage `vaultquest:<handle>`).
// Profiles are local only (no server accounts — out of scope). Demo modes never read or write storage.
// Saves are versioned (learn/progress.js). Before a save is upgraded its original text is copied to
// `vaultquest:<handle>.backup.<tag>`; an unreadable save is copied to `.corrupt` before starting fresh.
// If either copy can't be written, the session runs read-only so the original is never overwritten.
import { LANGS } from '../content/languages.js';
import { migrate, grantReward, rewardKey, SAVE_VERSION } from '../learn/progress.js';
import { weekKey } from './rank.js';

export const DEMO_MODE = new URLSearchParams(location.search).get('demo');
export const DEMO = DEMO_MODE !== null;
export const PER_LVL = 300;
export const lvlOf = xp => 1 + Math.floor(xp / PER_LVL);
// The curriculum each language's content belongs to right now, e.g. { py: 'py-1', js: 'js-1' }.
export const LIVE = Object.fromEntries(Object.entries(LANGS).map(([l, L]) => [l, L.curriculum]));

const USERS = 'vaultquest:users', CUR = 'vaultquest:user', RESERVED = ['user', 'users'];
const keyOf = name => 'vaultquest:' + name.toLowerCase();
const fresh = () => ({ name: '', lang: 'py', xp: 0, done: { py: 0, js: 0 }, stars: {}, ach: [], fresh: [], streak: 1, lastDay: '', questions: 0, pro: false, projects: [], wk: null, v: SAVE_VERSION, curriculum: { ...LIVE }, awarded: {}, legacy: {}, attempts: {} });
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full/blocked */ } };
const text = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const put = (k, t) => { try { localStorage.setItem(k, t); return localStorage.getItem(k) === t; } catch (e) { return false; } };
// Keeps an untouched copy of `t` under k; an existing, different copy is never replaced.
const keep = (k, t) => { const old = text(k); return old === t || (old == null ? put(k, t) : put(`${k}-${Date.now()}`, t)); };
const day = (d = new Date()) => d.toISOString().slice(0, 10);

export const S = fresh();
let user = DEMO ? 'demo' : read(CUR, null), readOnly = false;

function readProfile(name) {
  const k = keyOf(name), t = text(k);
  if (t == null) return {};
  let parsed = null;
  try { parsed = JSON.parse(t); } catch (e) { /* corrupt */ }
  const s = migrate(parsed, LIVE);
  if (!s) {
    if (!keep(k + '.corrupt', t)) readOnly = true;
    console.warn(`[VaultQuest] save for "${name}" could not be read; a copy is kept as ${k}.corrupt${readOnly ? ' (copy failed — not saving this session)' : ''}.`);
    return {};
  }
  if (JSON.stringify(s) !== JSON.stringify(parsed)) {
    const from = parsed.v ?? 1, tag = from < SAVE_VERSION ? 'v' + from : Object.values(parsed.curriculum ?? {}).join('+') || 'v' + from;
    if (!keep(`${k}.backup.${tag}`, t)) { readOnly = true; console.warn(`[VaultQuest] could not back up "${name}" before upgrading it — not saving this session.`); }
  }
  return s;
}

function load(name) {
  readOnly = false;
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, fresh(), readProfile(name), { name, fresh: [] });
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

export const save = () => { rollWeek(); S.wk.last = S.xp; if (!DEMO && user && !readOnly) write(keyOf(user), S); };
export const currentUser = () => user;
// Saved profiles on this device; damaged entries in the list are skipped.
export const profiles = () => { const l = read(USERS, []); return (Array.isArray(l) ? l : []).filter(n => typeof n === 'string').map(n => ({ name: n, ...read(keyOf(n), {}) })); };
const known = n => read(USERS, []).some(u => u.toLowerCase() === n.toLowerCase());
export const isReserved = n => RESERVED.includes(n.toLowerCase()) && !known(n);
export const validHandle = n => /^[A-Za-z0-9_\-]{2,16}$/.test(n) && !isReserved(n);

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

// Once-only XP: rk(level, part) is the reward key in the current language's curriculum. A level whose
// content carried over unchanged from an earlier curriculum (`rewards: 'js-1:4'`) keeps that identity, so it
// can't pay twice after a curriculum switch.
export const rk = (i, part, lang = S.lang) => { const base = LANGS[lang].levels[i]?.rewards; return base ? `${base}:${part}` : rewardKey(S.curriculum[lang], i, part); };
export const reward = (key, amount, run) => grantReward(S, key, amount, run);
