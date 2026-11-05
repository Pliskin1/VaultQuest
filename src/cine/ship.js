// Project shipped: preview card flies to center, confetti, SHIPPED!, stats. Resolves on ADD TO PORTFOLIO.
import { $, $$ } from '../core/dom.js';
import { anim, EASE, cancelAnims } from '../core/anim.js';
import { Clock, wait, nextFrame } from '../core/clock.js';
import { FX } from '../core/fx.js';

// Every number shown is real: XP paid now, milestones cleared and checks passed on the verified run, and an
// AI review score only if the AI reviewer gave one.
export async function playShipCinematic({ xp = 0, title = 'To-Do App', lang = 'JavaScript', milestones, checks, review = null } = {}) {
  const sc = $('#shipcine'), src = $('.pv'), r = src.getBoundingClientRect(), h = $('#s-holder');
  cancelAnims(sc, h, $('#s-bg'), $('#s-rays'), $('#s-glow'), $('#s-kick'), $('#s-next'), $('#s-share'), ...$$('#s-stats .c-stat'));
  h.innerHTML = '';
  const cl = src.cloneNode(true); cl.style.margin = '0'; cl.style.width = r.width + 'px'; cl.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); h.appendChild(cl);
  h.style.cssText = `position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:2`;
  $('#sh-title').innerHTML = ''; $('#s-kick').textContent = `PROJECT COMPLETE · ${title} · ${lang}`.toUpperCase(); $('#s-share').textContent = 'COPY MY CODE'; $('#s-xp').textContent = '+0';
  $('#s-ms').textContent = `${milestones.cleared} / ${milestones.total}`;
  $('#s-score-l').textContent = review === null ? 'CHECKS PASSED' : 'AI CODE REVIEW'; $('#s-score').textContent = review === null ? `${checks.passed} / ${checks.total}` : `${review} / 100`;
  sc.classList.add('on'); anim($('#s-bg'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
  const dx = innerWidth / 2 - (r.left + r.width / 2), dy = innerHeight * .47 - (r.top + r.height / 2);
  await anim(h, [{ transform: 'translate(0,0) scale(1) rotateY(0)' }, { transform: `translate(${dx * .6}px,${dy * .6 - 40}px) scale(1.06) perspective(800px) rotateY(-12deg)`, offset: .55 }, { transform: `translate(${dx}px,${dy}px) scale(1.12) perspective(800px) rotateY(0)` }], { duration: 1200, easing: 'cubic-bezier(.16,1,.3,1)' });
  anim(cl, [{ boxShadow: '0 0 0 0 rgba(242,181,68,0)' }, { boxShadow: '0 0 0 2px #F2B544, 0 0 90px 10px rgba(242,181,68,.45)' }], { duration: 700 });
  const p = { x: innerWidth / 2, y: innerHeight * .47 };
  FX.spark(p.x, p.y, 110, null, 1.5); FX.spark(p.x, p.y, 70, '#C9B8FF', 1.4); FX.spark(p.x, p.y, 70, '#4FD8C4', 1.4); FX.ring(p.x, p.y, 520, '#F2B544', 5, .9); FX.ring(p.x, p.y, 760, '#C9B8FF', 3, 1.1); FX.ember(p.x, p.y, 70);
  FX.spark(0, innerHeight, 80, null, 1.8); FX.spark(innerWidth, innerHeight, 80, '#C9B8FF', 1.8);
  anim($('#s-glow'), [{ opacity: 0, transform: 'scale(.4)' }, { opacity: .7, transform: 'scale(1)' }], { duration: 1200, easing: EASE.out });
  anim($('#s-rays'), [{ opacity: 0, transform: 'rotate(0)' }, { opacity: 1, transform: 'rotate(30deg)' }], { duration: 3500, easing: 'ease-out' });
  anim($('#s-kick'), [{ opacity: 0, letterSpacing: '.5em' }, { opacity: 1, letterSpacing: '.18em' }], { duration: 700, easing: EASE.out });
  const t = $('#sh-title'); t.innerHTML = 'SHIPPED!'.split('').map(ch => `<span>${ch}</span>`).join('');
  [...t.children].forEach((s, k) => anim(s, [{ opacity: 0, transform: 'translateY(50px) scale(1.8)', filter: 'blur(12px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 600, delay: 100 + k * 60, easing: EASE.back }));
  await wait(900);
  $$('#s-stats .c-stat').forEach((s, k) => anim(s, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: k * 130, easing: EASE.out }));
  await wait(300);
  const t0 = Clock.t;
  while (Clock.t - t0 < 1000) { const k = Math.min(1, (Clock.t - t0) / 1000); $('#s-xp').textContent = '+' + Math.round(xp * (1 - Math.pow(1 - k, 3))); await nextFrame(); }
  $('#s-xp').textContent = '+' + xp;
  await wait(500);
  [$('#s-share'), $('#s-next')].forEach((b, k) => anim(b, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: k * 120, easing: EASE.out }));
  await wait(600); $('#s-next').focus();
  await new Promise(r => $('#s-next').onclick = r);
  await anim(sc, [{ opacity: 1 }, { opacity: 0 }], { duration: 450 });
  sc.classList.remove('on'); sc.getAnimations().forEach(a => a.cancel());
}
