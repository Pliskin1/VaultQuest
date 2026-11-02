// Persistent player state (localStorage key `vaultquest`). Demo modes never read or write storage.
export const DEMO_MODE = new URLSearchParams(location.search).get('demo');
export const DEMO = DEMO_MODE !== null;
export const PER_LVL = 300;
export const lvlOf = xp => 1 + Math.floor(xp / PER_LVL);
const KEY = 'vaultquest';
const fresh = () => ({ lang: 'py', xp: 0, done: { py: 0, js: 0 }, stars: {}, ach: [], fresh: [], streak: 1, questions: 0, pro: false, projects: [] });

export const S = fresh();
try { if (!DEMO) { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.assign(S, s, { fresh: [] }); } } catch (e) { /* corrupt storage → start fresh */ }

export const save = () => { try { if (!DEMO) localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full/blocked */ } };
export const resetState = () => { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, fresh()); try { localStorage.removeItem(KEY); } catch (e) {} };
