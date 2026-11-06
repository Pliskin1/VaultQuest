// Paywall + mock checkout → Pro cinematic → map chain reaction.
import { $, $$ } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { go } from '../core/router.js';
import { S, save } from '../core/state.js';
import { updHud } from '../ui/hud.js';
import { LANGS, freeOf } from '../content/languages.js';
import { afterCheckout } from '../learn/unlock.js';
import { playProCinematic, proChain } from '../cine/pro.js';
import { openMap, renderMap, setSel } from './map.js';
import { renderTestimonials } from '../ui/review.js';

// next: where a successful checkout continues (WORLD 1 CLEARED → checkout → the PRO Vault; a vault → checkout →
// the same vault). back: where "Maybe later" goes. Without them, both end on the map.
let next = null, back = null;
// PRO can be bought at any time; the page only words it differently before the Mini Boss is beaten.
const LEAD = {
  cleared: 'You\'ve cracked the foundations. Pro unlocks advanced vaults and guided projects in every language, with an AI mentor reviewing your code at every step.',
  early: 'Upgrade whenever you like — your progress stays exactly where it is. Finish the free vaults and the Mini Boss, and PRO Vault 06 opens right after, with no second checkout.'
};
export function openPro({ next: then = null, back: ret = null } = {}) {
  if (S.pro) return then ? then() : openMap();
  next = then; back = ret;
  $('#pro-lead').textContent = (S.done[S.lang] ?? 0) >= freeOf(S.lang) ? LEAD.cleared : LEAD.early;
  updHud();
  renderTestimonials();
  go('s-pro', () => {
    $$('.feats li').forEach((li, k) => anim(li, [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: k * 100, easing: EASE.out, fill: 'backwards' }));
    anim($('.pro-right'), [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 250, easing: EASE.out, fill: 'backwards' });
  });
}

const closeCheckout = () => $('#checkout').classList.remove('on');
const paying = () => $('#co-pay').disabled;

export function mount() {
  $$('.plan').forEach(p => p.onclick = () => $$('.plan').forEach(q => q.classList.toggle('sel', q === p)));
  $('#pro-later').onclick = () => { const r = back; next = back = null; (r ?? openMap)(); };
  $('#pro-cta').onclick = () => {
    if (S.pro) return;
    const y = $('.plan.sel').dataset.plan === 'y';
    $('#co-plan').textContent = y ? 'Pro Yearly · €39.99/year' : 'Pro Monthly · €4.99/month';
    const co = $('#checkout'); co.classList.add('on');
    anim(co, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'none' });
    anim($('.co'), [{ opacity: 0, transform: 'translateY(30px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: EASE.out, fill: 'none' });
    $('#co-pay').focus();
  };
  $('#co-x').onclick = () => { if (!paying()) closeCheckout(); }; // a payment in progress can't be cancelled halfway
  addEventListener('keydown', e => { if (e.key === 'Escape' && !paying()) closeCheckout(); });
  $('#co-pay').onclick = async () => {
    const b = $('#co-pay'); if (b.disabled) return;
    if (S.pro) return; // never a second purchase
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>&nbsp;PROCESSING…';
    await wait(1300); S.pro = true; save(); b.innerHTML = '✓ YOU\'RE PRO'; b.style.background = 'var(--cyan)'; await wait(800);
    await anim($('#checkout'), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    closeCheckout(); $('#checkout').getAnimations().forEach(a => a.cancel());
    b.disabled = false; b.innerHTML = 'CONFIRM &amp; START TRIAL'; b.style.background = '';
    await playProCinematic();
    setSel(afterCheckout(S, S.lang, LANGS[S.lang])); // the PRO Vault comes first; before the Mini Boss, the current FREE vault
    await go('s-map'); S.pro = false; renderMap(); S.pro = true; await wait(400); await proChain();
    const then = next; next = back = null;
    if (then) { await wait(600); then(); }
  };
}
