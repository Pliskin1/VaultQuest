// What "Reset progress" wipes, shown in the confirmation dialog (ui/confirm.js) with the player's real numbers.
// Pure (no DOM, no state import), so it can be unit-tested in Node. resetState() (core/state.js) keeps only the
// handle: XP, vaults, achievements, certificates, shipped projects, the streak and PRO all go.
import { esc } from '../core/md.js';

const count = v => Math.max(0, Math.floor(Number(v)) || 0);
const plural = (n, one, many) => n === 1 ? one : many;

// st: the profile (S) · lvl: its level (lvlOf(S.xp)) → [{ v, label, col }], only what there is to lose.
export function resetLosses(st, lvl) {
  const s = st && typeof st === 'object' ? st : {}, done = s.done && typeof s.done === 'object' ? s.done : {};
  const xp = count(s.xp), vaults = count(done.py) + count(done.js), ach = Array.isArray(s.ach) ? s.ach.length : 0;
  const certs = s.certs && typeof s.certs === 'object' ? Object.keys(s.certs).length : 0;
  const projects = Array.isArray(s.projects) ? s.projects.length : 0, streak = count(s.streak);
  return [
    { v: xp, label: lvl ? `XP · LVL ${lvl}` : 'XP', col: 'var(--gold)' },
    { v: vaults, label: plural(vaults, 'vault cracked', 'vaults cracked'), col: 'var(--gold)' },
    { v: ach, label: plural(ach, 'achievement', 'achievements'), col: 'var(--cyan)' },
    { v: certs, label: plural(certs, 'certificate', 'certificates'), col: 'var(--gold2)' },
    { v: projects, label: plural(projects, 'shipped project', 'shipped projects'), col: 'var(--violet)' },
    { v: streak > 1 ? streak : 0, label: 'day streak', col: 'var(--coral)' }, // a new profile starts at 1
    { v: s.pro === true ? 'PRO' : 0, label: 'membership', col: 'var(--violet)' }
  ].filter(l => l.v);
}

// Dialog body: who loses what, then what stays.
export function resetBody(st, lvl) {
  const losses = resetLosses(st, lvl), name = st && typeof st.name === 'string' && st.name ? ` as <b>${esc(st.name)}</b>` : '';
  const tiles = losses.length
    ? `<div class="cf-loss" role="list" aria-label="What you would lose">${losses.map(l => `<div class="cf-l" role="listitem"><strong style="color:${l.col}">${l.v}</strong><span>${l.label}</span></div>`).join('')}</div>`
    : '<p class="cf-p cf-none">You haven’t earned anything yet, so there’s nothing to lose.</p>';
  return `<p class="cf-p">Everything you’ve earned${name} on this device is wiped, and you start over at Vault 01.</p>${tiles}<p class="cf-keep">Only your handle stays · this can’t be undone</p>`;
}
