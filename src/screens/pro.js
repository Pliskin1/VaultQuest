// Paywall + mock checkout → Pro cinematic → map chain reaction.
import { $, $$ } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { go } from '../core/router.js';
import { S, save } from '../core/state.js';
import { updHud } from '../ui/hud.js';
import { LANGS, freeOf } from '../content/languages.js';
import { playProCinematic, proChain } from '../cine/pro.js';
import { openMap, renderMap, setSel } from './map.js';

// next: where a successful checkout continues (WORLD 1 CLEARED → checkout → the project's Blueprint). Without
// it, the checkout ends on the map as before.
let next = null;
export function openPro({ next: then = null } = {}) {
  if (S.pro) return then ? then() : openMap();
  next = then;
  updHud();
  go('s-pro').then(() => {
    $$('.feats li').forEach((li, k) => anim(li, [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: k * 100, easing: EASE.out, fill: 'backwards' }));
    anim($('.pro-right'), [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 250, easing: EASE.out, fill: 'backwards' });
  });
}

const closeCheckout = () => $('#checkout').classList.remove('on');

export function mount() {
  $$('.plan').forEach(p => p.onclick = () => $$('.plan').forEach(q => q.classList.toggle('sel', q === p)));
  $('#pro-later').onclick = () => { next = null; openMap(); };
  $('#pro-cta').onclick = () => {
    const y = $('.plan.sel').dataset.plan === 'y';
    $('#co-plan').textContent = y ? 'Pro Yearly · €39.99/year' : 'Pro Monthly · €4.99/month';
    const co = $('#checkout'); co.classList.add('on');
    anim(co, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'none' });
    anim($('.co'), [{ opacity: 0, transform: 'translateY(30px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: EASE.out, fill: 'none' });
    $('#co-pay').focus();
  };
  $('#co-x').onclick = closeCheckout;
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#co-pay').disabled) closeCheckout(); });
  $('#co-pay').onclick = async () => {
    const b = $('#co-pay'); if (b.disabled) return;
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>&nbsp;PROCESSING…';
    await wait(1300); S.pro = true; save(); b.innerHTML = '✓ YOU\'RE PRO'; b.style.background = 'var(--cyan)'; await wait(800);
    await anim($('#checkout'), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    closeCheckout(); $('#checkout').getAnimations().forEach(a => a.cancel());
    b.disabled = false; b.innerHTML = 'CONFIRM &amp; START TRIAL'; b.style.background = '';
    await playProCinematic();
    const proj = LANGS[S.lang].levels.findIndex((l, i) => i >= freeOf(S.lang) && l.t === 'project');
    setSel(proj > 0 ? proj : freeOf(S.lang));
    await go('s-map'); S.pro = false; renderMap(); S.pro = true; await wait(400); await proChain();
    const then = next; next = null;
    if (then) { await wait(600); then(); }
  };
}
