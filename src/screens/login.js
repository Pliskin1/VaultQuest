// Local profiles: pick or create a handle. Each handle has its own saved progress on this device.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { esc } from '../core/md.js';
import { go } from '../core/router.js';
import { S, login, profiles, validHandle, isReserved, lvlOf } from '../core/state.js';
import { updHud } from '../ui/hud.js';
import { openMap } from './map.js';

let busy = false;

export function openLogin() {
  const list = profiles().slice(-6).reverse();
  $('#lg-prof').innerHTML = list.length ? list.map(p => `<button class="lg-chip ${p.pro ? 'pro' : ''}" data-name="${esc(p.name)}" aria-label="Continue as ${esc(p.name)}"><i>${esc(p.name.slice(0, 2).toUpperCase())}</i><b>${esc(p.name)}</b><span>LVL ${lvlOf(p.xp || 0)} · ${p.xp || 0} XP</span></button>`).join('') : '';
  $$('.lg-chip').forEach(b => b.onclick = () => unlock(b.dataset.name));
  $('#lg-err').textContent = ''; $('#lg-in').value = '';
  return go('s-login').then(() => {
    $('#lg-in').focus();
    $$('#s-login .lg-wrap > *').forEach((el, k) => anim(el, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: k * 80, easing: EASE.out, fill: 'backwards' }));
  });
}

// After login: returning players go straight to their map, new players pick a language.
export const enterGame = () => S.xp > 0 || S.done.py || S.done.js ? openMap() : go('s-lang').then(flipCards);
export function flipCards() {
  $$('.lcard').forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(40px) rotateX(-20deg)' }, { opacity: c.classList.contains('locked') ? .55 : 1, transform: 'none' }], { duration: 700, delay: i * 90, easing: EASE.out, fill: 'none' }));
}

function reject(msg) {
  const f = $('#lg-form'); f.classList.add('bad'); $('#lg-err').textContent = msg;
  anim(f, [{ transform: 'translateX(0)' }, { transform: 'translateX(-14px)' }, { transform: 'translateX(11px)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], { duration: 450, fill: 'none' });
  anim($('#vign'), [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }], { duration: 800, fill: 'none' });
  wait(900).then(() => f.classList.remove('bad'));
}

async function unlock(raw) {
  if (busy) return;
  const name = raw.trim();
  if (!validHandle(name)) return reject(!name ? 'ACCESS DENIED · enter a handle' : isReserved(name) ? 'ACCESS DENIED · that handle is reserved' : 'ACCESS DENIED · 2–16 chars: letters, numbers, - or _');
  busy = true; $('#lg-err').textContent = '';
  const dial = $('#lg-dial'), c = ctr(dial);
  anim(dial, [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-40deg) scale(1.05)', offset: .2 }, { transform: 'rotate(720deg) scale(1.15)' }], { duration: 1100, easing: EASE.inout });
  FX.stream(c.x, c.y, 50, 900);
  await wait(950);
  login(name); updHud();
  FX.spark(c.x, c.y, 90, null, 1.2); FX.ring(c.x, c.y, 320, '#F2B544', 5); FX.ring(c.x, c.y, 520, '#4FD8C4', 2, 1);
  anim($('#s-login .lg-wrap'), [{ opacity: 1 }, { opacity: .15 }], { duration: 300 });
  const g = $('#lg-granted'); g.style.display = 'flex';
  g.innerHTML = 'ACCESS GRANTED'.split('').map(ch => `<span>${ch}</span>`).join('');
  anim(g, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'none' });
  [...g.children].forEach((s, k) => anim(s, [{ opacity: 0, transform: 'translateY(40px) scale(1.6)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 500, delay: k * 35, easing: EASE.back }));
  await wait(1300);
  await enterGame();
  g.style.display = 'none'; dial.getAnimations().forEach(a => a.cancel()); $('#s-login .lg-wrap').getAnimations().forEach(a => a.cancel()); busy = false;
}

export function mount() {
  $('#lg-dial').innerHTML = $('.emblem').innerHTML;
  $('#lg-form').onsubmit = e => { e.preventDefault(); unlock($('#lg-in').value); };
}
