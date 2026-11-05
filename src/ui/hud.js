import { $$ } from '../core/dom.js';
import { S, PER_LVL, lvlOf, initials } from '../core/state.js';

const HUD = `<div style="display:flex;align-items:center;gap:20px"><div class="brand"><svg width="28" height="28" viewBox="0 0 34 34" fill="none" aria-hidden="true"><circle cx="17" cy="17" r="15" stroke="#F2B544" stroke-width="2"/><circle cx="17" cy="17" r="6" stroke="#F2B544" stroke-width="2"/><path d="M17 2v6M17 26v6M2 17h6M26 17h6" stroke="#F2B544" stroke-width="2"/></svg>VAULTQUEST</div><span class="chip hud-lang"></span></div>
 <div class="hud-r"><div class="xpw"><span class="lvlb hud-lvl"></span><div class="bar"><i class="hud-bar"></i></div><span class="xpt hud-xp"></span></div>
 <div class="streak"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.5 2 2.5 0-3-1-5 1-8z" stroke="#FF9B7A" stroke-width="1.8" stroke-linejoin="round"/></svg><span class="hud-streak"></span></div>
 <button class="gopro hud-gopro" aria-label="Upgrade to PRO">GO PRO</button><button class="avatar-btn hud-prof" aria-label="Profile">YOU</button></div>`;

// handlers: { pro(), profile(fromScreenId) }
export function mountHud(handlers) {
  $$('[data-hud]').forEach(h => {
    h.innerHTML = HUD;
    const screen = h.closest('.screen').id;
    h.querySelector('.hud-gopro').onclick = () => handlers.pro();
    h.querySelector('.hud-prof').onclick = () => handlers.profile(screen);
  });
}

export function updHud() {
  const L = lvlOf(S.xp), into = S.xp % PER_LVL;
  $$('.hud-lvl').forEach(e => e.textContent = 'LVL ' + L);
  $$('.hud-bar').forEach(e => e.style.width = (into / PER_LVL * 100) + '%');
  $$('.hud-xp').forEach(e => e.textContent = `${S.xp} XP`);
  $$('.hud-streak').forEach(e => e.textContent = S.streak + ' day streak');
  $$('.hud-lang').forEach(e => e.textContent = (S.lang === 'py' ? 'py · Python' : 'js · JavaScript') + ' path');
  $$('.hud-gopro').forEach(b => b.style.display = S.pro ? 'none' : '');
  $$('.hud-prof').forEach(b => { b.classList.toggle('is-pro', !!S.pro); b.textContent = initials(); b.setAttribute('aria-label', `Profile: ${S.name || 'you'}`); });
}
