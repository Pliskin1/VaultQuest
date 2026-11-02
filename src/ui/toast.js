import { $ } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { S, save } from '../core/state.js';
import { ACH } from '../content/achievements.js';

export function award(id) {
  if (S.ach.includes(id)) return;
  S.ach.push(id); S.fresh.push(id); save(); toast(id);
}

export async function toast(id) {
  const a = ACH[id], t = document.createElement('div');
  t.className = 'toast'; t.style.borderColor = a.col + '88';
  t.innerHTML = `<div class="shine"></div><svg width="52" height="52" viewBox="0 0 56 56" fill="none" style="flex:none" aria-hidden="true"><path d="M28 3l21.7 12.5v25L28 53 6.3 40.5v-25z" fill="#151A26" stroke="${a.col}" stroke-width="2"/><path d="${a.ic}" stroke="${a.col}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><div><b style="color:${a.col}">ACHIEVEMENT · ${a.r}</b><strong>${a.n}</strong><span>${a.d}</span></div>`;
  $('#toasts').appendChild(t);
  await anim(t, [{ opacity: 0, transform: 'translateX(120px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: EASE.back });
  const r = t.getBoundingClientRect(); FX.spark(r.left + 30, r.top + r.height / 2, 20, a.col, .6);
  anim(t.querySelector('.shine'), [{ left: '-80px' }, { left: '400px' }], { duration: 900, easing: 'ease-in-out' });
  await wait(2600);
  await anim(t, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(80px)' }], { duration: 400, easing: EASE.in });
  t.remove();
}

// "+50 XP" float (cls='float') or "COMBO xN" slam (cls='slam').
export function floatText(txt, x, y, cls = 'float') {
  const d = document.createElement('div'); d.className = cls; d.textContent = txt; document.body.appendChild(d);
  d.style.left = (x - d.offsetWidth / 2) + 'px'; d.style.top = (y - 20) + 'px';
  const kf = cls === 'float'
    ? [{ opacity: 0, transform: 'translateY(10px) scale(.6)' }, { opacity: 1, transform: 'translateY(-30px) scale(1.1)', offset: .25 }, { opacity: 0, transform: 'translateY(-90px) scale(1)' }]
    : [{ opacity: 0, transform: 'scale(2.6) rotate(-6deg)', filter: 'blur(10px)' }, { opacity: 1, transform: 'scale(1) rotate(-6deg)', filter: 'blur(0)', offset: .2 }, { opacity: 1, transform: 'scale(1.05) rotate(-6deg)', offset: .75 }, { opacity: 0, transform: 'scale(1.4) rotate(-6deg)' }];
  anim(d, kf, { duration: cls === 'float' ? 1300 : 1500, easing: 'ease-out' }).then(() => d.remove());
}
