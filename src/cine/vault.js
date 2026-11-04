// Level-complete hero cinematic: vault flies in, code streams into the lock, dial spins,
// bolts retract, doors blast open, camera flies through, results. Resolves when a button is clicked:
// 'next' (CONTINUE, or o.actions.next) or 'alt' (o.actions.alt, e.g. back to the map).
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE, cancelAnims } from '../core/anim.js';
import { Clock, wait, nextFrame } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { S, PER_LVL, lvlOf } from '../core/state.js';
import { updHud } from '../ui/hud.js';
import { award } from '../ui/toast.js';

const STAR = '<path d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.4 6.7L12 17.5l-6.1 3.3 1.4-6.7-5-4.6 6.8-.8z"';
const SHAKE = [{ transform: 'translate(0,0)' }, { transform: 'translate(-10px,6px)' }, { transform: 'translate(8px,-7px)' }, { transform: 'translate(-5px,4px)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(0,0)' }];
let built = false;

function buildVault() {
  const style = r => r === 105 ? 'border:12px solid #1D2433' : r === 150 ? 'border:2px dashed #2E3750' : r === 180 ? 'border:2px solid rgba(242,181,68,.38)' : 'border:2px solid #3A4560';
  const ring = (side, r) => `<i style="left:${side === 'l' ? 200 - r - 3 : -r}px;top:${200 - r - 3}px;width:${2 * r}px;height:${2 * r}px;${style(r)}"></i>`;
  const riv = (cx, a0, a1) => Array.from({ length: 7 }, (_, k) => { const a = (a0 + (a1 - a0) * k / 6) * Math.PI / 180; return `<i style="left:${cx + 186 * Math.cos(a) - 5}px;top:${197 + 186 * Math.sin(a) - 5}px;width:10px;height:10px;background:#2C3448;box-shadow:inset 0 1px 0 #4A5470"></i>`; }).join('');
  $('#v-hl').innerHTML = [180, 150, 105, 52].map(r => ring('l', r)).join('') + riv(197, 105, 255);
  $('#v-hr').innerHTML = [180, 150, 105, 52].map(r => ring('r', r)).join('') + riv(0, -75, 75);
  let b = '';
  [-80, 0, 80].forEach(dy => { const w = 230 - Math.sqrt(200 * 200 - dy * dy) + 10; b += `<div class="bolt bl" style="left:6px;top:${230 + dy - 9}px;width:${w}px;height:18px"></div><div class="bolt br" style="left:${460 - 6 - w}px;top:${230 + dy - 9}px;width:${w}px;height:18px"></div>`; });
  b += '<div class="bolt bt" style="left:221px;top:6px;width:18px;height:46px"></div><div class="bolt bb" style="left:221px;top:408px;width:18px;height:46px"></div>';
  $('#v-bolts').innerHTML = b; built = true;
}

// o: { kick, title, stars, bonus, prevXp, lvBefore, mistakes, first, actions?: { next, alt, pro } }
export async function playVaultCinematic(o) {
  if (!built) buildVault();
  const cine = $('#cine'), stage = $('#c-stage'), wheel = $('#v-wheel'), res = $('#c-res');
  cancelAnims(cine, stage, wheel, $('#c-rays'), $('#c-glow'), $('#v-in'), $('#v-seam'), $('#v-hl'), $('#v-hr'), $('#c-flash'), res, $('#c-next'), $('#v-ticks'), $('#v-hub'), ...$$('#v-bolts .bolt'));
  res.style.display = 'none'; stage.style.opacity = 1;
  const nb = $('#c-next'), alt = $('#c-alt'), arrow = nb.querySelector('svg').outerHTML;
  nb.innerHTML = `${o.actions?.next ?? 'CONTINUE'} ${arrow}`; nb.classList.toggle('pro', !!o.actions?.pro);
  alt.textContent = o.actions?.alt ?? ''; alt.style.display = o.actions?.alt ? '' : 'none'; alt.style.opacity = 0;
  cine.classList.add('on');
  await anim(cine, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'none' });
  // 1. vault flies in
  await anim(stage, [{ transform: 'perspective(1200px) translateZ(-900px) rotateX(35deg) rotateZ(-40deg)', opacity: 0 }, { transform: 'perspective(1200px) translateZ(0) rotateX(0) rotateZ(0)', opacity: 1 }], { duration: 1100, easing: 'cubic-bezier(.16,1,.3,1)' });
  const hub = ctr($('#v-hub'));
  // 2. code streams into the lock
  FX.stream(hub.x, hub.y, 90, 1300);
  anim($('#v-ticks'), [{ transform: 'rotate(0)' }, { transform: 'rotate(90deg)' }], { duration: 2600, easing: EASE.inout });
  anim($('#v-hub'), [{ boxShadow: '0 0 0 0 rgba(242,181,68,0)' }, { boxShadow: '0 0 40px 14px rgba(242,181,68,.8)' }], { duration: 1400, easing: 'ease-in' });
  await wait(1350); FX.ring(hub.x, hub.y, 120, '#F2B544', 4); FX.spark(hub.x, hub.y, 30);
  // 3. dial spins
  anim(wheel, [{ transform: 'rotate(0)' }, { transform: 'rotate(-30deg)', offset: .15 }, { transform: 'rotate(720deg)' }], { duration: 1500, easing: EASE.inout });
  await wait(900);
  // 4. bolts retract one by one
  for (const b of $$('#v-bolts .bolt')) {
    const dir = b.classList.contains('bl') ? 'translateX(-34px)' : b.classList.contains('br') ? 'translateX(34px)' : b.classList.contains('bt') ? 'translateY(-34px)' : 'translateY(34px)';
    anim(b, [{ transform: 'none' }, { transform: dir }], { duration: 220, easing: EASE.in });
    const p = ctr(b); FX.spark(p.x, p.y, 14, null, .5); await wait(95);
  }
  await wait(200);
  // 5. seam of light
  await anim($('#v-seam'), [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: 420, easing: EASE.out });
  anim(stage, [{ transform: 'translate(0,0)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(2px,-1px)' }, { transform: 'translate(-1px,1px)' }, { transform: 'translate(0,0)' }], { duration: 400, fill: 'none' });
  await wait(250);
  // 6. doors blast open
  const c = ctr($('#v-frame'));
  anim(wheel, [{ transform: 'rotate(720deg) scale(1)', opacity: 1 }, { transform: 'rotate(760deg) scale(.6)', opacity: 0 }], { duration: 300 });
  anim($('#v-seam'), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
  anim($('#v-hl'), [{ transform: 'none' }, { transform: 'translateX(-262px)' }], { duration: 1100, easing: EASE.door });
  anim($('#v-hr'), [{ transform: 'none' }, { transform: 'translateX(262px)' }], { duration: 1100, easing: EASE.door });
  anim($('#v-in'), [{ opacity: 0 }, { opacity: 1 }], { duration: 700 });
  anim($('#c-flash'), [{ opacity: 0 }, { opacity: .9, offset: .15 }, { opacity: 0 }], { duration: 900, fill: 'none' });
  anim($('#c-glow'), [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 1200, easing: EASE.out });
  anim($('#c-rays'), [{ opacity: 0, transform: 'rotate(0)' }, { opacity: 1, transform: 'rotate(40deg)' }], { duration: 3000, easing: 'ease-out' });
  anim(cine, SHAKE, { duration: 500, fill: 'none' });
  FX.spark(c.x, c.y, 160, null, 1.6); FX.ring(c.x, c.y, 520, '#FFD27A', 6, .9); FX.ring(c.x, c.y, 800, '#4FD8C4', 3, 1.2); FX.ember(c.x, c.y, 70);
  await wait(1000);
  // 7. fly through the door
  anim(stage, [{ transform: 'scale(1)', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(3.4)', opacity: 0, filter: 'blur(6px)' }], { duration: 900, easing: EASE.in });
  anim($('#c-glow'), [{ opacity: 1, transform: 'scale(1)' }, { opacity: .55, transform: 'scale(1.6)' }], { duration: 1000, easing: EASE.in });
  await wait(550);
  // 8. results
  res.style.display = 'flex'; $('#c-kick').textContent = o.kick; $('#c-mis').textContent = o.mistakes; $('#c-xp').textContent = '+0'; $('#c-lvup').style.opacity = 0;
  // One unbreakable group per word, so a long title (WORLD 1 CLEARED) wraps between words on small screens.
  const title = $('#c-title'); title.innerHTML = o.title.split(' ').map(w => `<span class="cw">${[...w].map(ch => `<span>${ch}</span>`).join('')}</span>`).join(' ');
  anim($('#c-kick'), [{ opacity: 0, letterSpacing: '.6em' }, { opacity: 1, letterSpacing: '.18em' }], { duration: 700, easing: EASE.out });
  [...title.querySelectorAll('.cw span')].forEach((s, k) => anim(s, [{ opacity: 0, transform: 'translateY(60px) scale(1.8)', filter: 'blur(14px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 650, delay: k * 55, easing: EASE.back }));
  $('#c-stars').innerHTML = [0, 1, 2].map(k => `<svg viewBox="0 0 24 24" style="opacity:0" aria-hidden="true">${STAR} fill="${k < o.stars ? '#F2B544' : '#1E2433'}" stroke="${k < o.stars ? '#FFD27A' : '#2A3245'}" stroke-width=".6"/></svg>`).join('');
  $('#c-stars').setAttribute('aria-label', `${o.stars} of 3 stars`);
  $$('.c-stats .c-stat').forEach((s, k) => anim(s, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 900 + k * 120, easing: EASE.out }));
  await wait(750);
  for (const [k, sv] of $$('#c-stars svg').entries()) {
    await anim(sv, [{ opacity: 0, transform: 'scale(3.2) rotate(-50deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)' }], { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)' });
    const p = ctr(sv);
    if (k < o.stars) { FX.ring(p.x, p.y, 120, '#FFD27A', 4, .6); FX.spark(p.x, p.y, 34, null, .8); anim(res, [{ transform: 'translate(0,0)' }, { transform: 'translate(0,5px)' }, { transform: 'translate(0,0)' }], { duration: 180, fill: 'none' }); }
    anim(sv, [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 300, fill: 'none' }); await wait(140);
  }
  // XP count-up + level bar
  const L0 = o.lvBefore, xp = o.prevXp + o.bonus, L1 = lvlOf(xp), startPct = (o.prevXp % PER_LVL) / PER_LVL * 100;
  $('#c-lvl').textContent = `LVL ${L0} → ${L0 + 1}`;
  $('#c-lvtxt').textContent = L1 > L0 ? 'New rank: Vault Cracker' : `${PER_LVL - (xp % PER_LVL)} XP to next level`;
  anim($('#c-lvbar'), [{ width: startPct + '%' }, { width: (L1 > L0 ? 100 : (xp % PER_LVL) / PER_LVL * 100) + '%' }], { duration: 1200, easing: EASE.inout });
  const t0 = Clock.t;
  while (Clock.t - t0 < 1000) { const k = Math.min(1, (Clock.t - t0) / 1000); $('#c-xp').textContent = '+' + Math.round(o.bonus * (1 - Math.pow(1 - k, 3))); await nextFrame(); }
  $('#c-xp').textContent = '+' + o.bonus;
  await wait(250);
  if (L1 > L0) { const u = $('#c-lvup'); anim(u, [{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 450, easing: EASE.back }); const p = ctr(u); FX.spark(p.x, p.y, 40, '#4FD8C4', .7); FX.ring(p.x, p.y, 140, '#4FD8C4', 3); }
  updHud(); if (o.first) award('first');
  await wait(600);
  [nb, alt].forEach((b, k) => anim(b, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: k * 120, easing: EASE.out }));
  FX.ember(innerWidth / 2, innerHeight * .75, 40); nb.focus();
  const choice = await new Promise(r => { nb.onclick = () => r('next'); alt.onclick = () => r('alt'); });
  await anim(cine, [{ opacity: 1 }, { opacity: 0 }], { duration: 450 });
  cine.classList.remove('on'); cine.getAnimations().forEach(a => a.cancel());
  return choice;
}
