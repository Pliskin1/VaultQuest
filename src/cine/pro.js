// Pro unlock: keyhole + golden key cinematic, then the map chain reaction that unlocks Pro nodes.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE, cancelAnims } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { S, save } from '../core/state.js';
import { updHud } from '../ui/hud.js';
import { award } from '../ui/toast.js';
import { LANGS, freeOf } from '../content/languages.js';
import { NODES, nstate, nodeInner, getSel, moveAlong, renderPanel, countText } from '../screens/map.js';

export async function playProCinematic() {
  const c = $('#procine'), kh = $('#kh'), key = $('#key'), res = $('#p-res');
  cancelAnims(c, kh, key, res, $('#p-rays'), $('#p-glow'), $('#p-flash'), $('#kh-core'), $('#p-next'), $('#p-crown'), $('#p-kick'), ...$$('.kh-seg'), ...$$('#p-perks div'));
  res.style.display = 'none'; c.classList.add('on');
  await anim(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 450, fill: 'none' });
  await anim(kh, [{ transform: 'scale(.3) rotate(-140deg)', opacity: 0 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)' });
  $$('.kh-seg').forEach((s, k) => { const a = k < 4 ? k * 90 : 45 + (k - 4) * 90; anim(s, [{ transform: `rotate(${a}deg)` }, { transform: `rotate(${a + (k < 4 ? 200 : -200)}deg)` }], { duration: 2300, easing: EASE.inout }); });
  await anim(key, [{ transform: 'translate(380px,440px) rotate(80deg) scale(1.3)', opacity: 0 }, { transform: 'translate(0,-70px) rotate(0) scale(1)', opacity: 1, offset: .7 }, { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 }], { duration: 1300, easing: EASE.out });
  const kc = ctr($('#kh-core'));
  FX.spark(kc.x, kc.y, 26, '#C9B8FF', .6); FX.ring(kc.x, kc.y, 100, '#C9B8FF', 3);
  anim(kh, [{ transform: 'translate(0,0)' }, { transform: 'translate(0,4px)' }, { transform: 'translate(0,0)' }], { duration: 200, fill: 'none' }); await wait(300);
  // key turns
  await anim(key, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.15)' }, { transform: 'scaleX(-1)' }], { duration: 650, easing: EASE.inout });
  FX.spark(kc.x, kc.y, 50, '#F2B544', .9); FX.ring(kc.x, kc.y, 160, '#F2B544', 4);
  anim(c, [{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(0,0)' }], { duration: 300, fill: 'none' });
  await wait(350);
  // segments explode outward
  $$('.kh-seg').forEach((s, k) => { const a = k < 4 ? k * 90 + 200 : 45 + (k - 4) * 90 - 200; anim(s, [{ transform: `rotate(${a}deg) scale(1)`, opacity: 1 }, { transform: `rotate(${a + (k < 4 ? 120 : -120)}deg) scale(${k < 4 ? 2.8 : 2.2})`, opacity: 0 }], { duration: 1000, easing: EASE.in }); });
  anim($('#kh-core'), [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.2)', opacity: 0 }], { duration: 500, easing: EASE.in });
  anim(key, [{ transform: 'scaleX(-1) translateY(0)', opacity: 1 }, { transform: 'scaleX(-1) translateY(30px) scale(.4)', opacity: 0 }], { duration: 400, easing: EASE.in });
  anim($('#p-flash'), [{ opacity: 0 }, { opacity: .85, offset: .15 }, { opacity: 0 }], { duration: 900, fill: 'none' });
  anim($('#p-glow'), [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 1200, easing: EASE.out });
  anim($('#p-rays'), [{ opacity: 0, transform: 'rotate(0)' }, { opacity: 1, transform: 'rotate(40deg)' }], { duration: 3200, easing: 'ease-out' });
  anim(c, [{ transform: 'translate(0,0)' }, { transform: 'translate(-10px,6px)' }, { transform: 'translate(8px,-7px)' }, { transform: 'translate(-4px,3px)' }, { transform: 'translate(0,0)' }], { duration: 500, fill: 'none' });
  FX.spark(kc.x, kc.y, 120, null, 1.6); FX.spark(kc.x, kc.y, 90, '#C9B8FF', 1.6); FX.ring(kc.x, kc.y, 520, '#C9B8FF', 6, .9); FX.ring(kc.x, kc.y, 820, '#F2B544', 3, 1.2); FX.ember(kc.x, kc.y, 70);
  await wait(900);
  // results
  res.style.display = 'flex';
  const t = $('#p-title'); t.innerHTML = 'PRO UNLOCKED'.split('').map(ch => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  anim($('#p-crown'), [{ opacity: 0, transform: 'translateY(-160px) scale(.6) rotate(-20deg)' }, { opacity: 1, transform: 'translateY(10px) scale(1.1)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 800, easing: EASE.out });
  anim($('#p-kick'), [{ opacity: 0, letterSpacing: '.6em' }, { opacity: 1, letterSpacing: '.18em' }], { duration: 700, easing: EASE.out });
  [...t.children].forEach((s, k) => anim(s, [{ opacity: 0, transform: 'translateY(60px) scale(1.8)', filter: 'blur(14px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 650, delay: 150 + k * 50, easing: EASE.back }));
  await wait(700);
  const cp = ctr($('#p-crown')); FX.spark(cp.x, cp.y, 40, '#C9B8FF', .8); FX.ring(cp.x, cp.y, 140, '#C9B8FF', 3);
  await wait(500);
  for (const d of $$('#p-perks div')) { anim(d, [{ opacity: 0, transform: 'translateX(-20px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: EASE.out }); const r = d.getBoundingClientRect(); FX.spark(r.left + 11, r.top + r.height / 2, 14, '#C9B8FF', .4); await wait(220); }
  award('pro'); await wait(400);
  const nb = $('#p-next');
  anim(nb, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: EASE.out });
  FX.ember(innerWidth / 2, innerHeight * .8, 40); nb.focus();
  await new Promise(r => nb.onclick = r);
  await anim(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 450 });
  c.classList.remove('on'); c.getAnimations().forEach(a => a.cancel());
}

// Map must already be rendered in its pre-Pro state (gate visible, Pro nodes locked).
export async function proChain() {
  const g = $('#m-gate');
  if (g) {
    const c = ctr(g); FX.shards(c.x, c.y, 30, '#C9B8FF'); FX.spark(c.x, c.y, 60, '#C9B8FF'); FX.ring(c.x, c.y, 240, '#C9B8FF', 4);
    await anim(g, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(2.2)', opacity: 0 }], { duration: 450 }); g.remove();
  }
  S.pro = true; save(); updHud();
  for (let i = freeOf(S.lang); i < NODES.length; i++) {
    const seg = $(`#m-svg .pseg[data-i="${i - 1}"]`), len = seg.getTotalLength();
    seg.style.opacity = 1; seg.style.strokeDasharray = len; seg.style.strokeDashoffset = len;
    await anim(seg, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 380, easing: EASE.inout });
    const n = $(`#m-nodes .node[data-i="${i}"]`), st = nstate(i), b = n.querySelector('.nbtn'), c = ctr(b);
    FX.shards(c.x, c.y, 16, '#6B5FA0'); FX.spark(c.x, c.y, 44, i % 2 ? '#C9B8FF' : '#F2B544'); FX.ring(c.x, c.y, 150, '#C9B8FF', 3);
    n.className = `node ${st} pro ${LANGS[S.lang].levels[i]?.t === 'final' ? 'boss' : ''} ${i === getSel() ? 'sel' : ''}`; b.innerHTML = nodeInner(i, st);
    anim(b, [{ transform: 'scale(.5)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 600, easing: EASE.back, fill: 'none' }); await wait(110);
  }
  $('#m-count').textContent = countText();
  if (S.done[S.lang] >= freeOf(S.lang)) await moveAlong($(`#m-svg .pseg[data-i="${freeOf(S.lang) - 1}"]`), 1200);
  renderPanel();
}
