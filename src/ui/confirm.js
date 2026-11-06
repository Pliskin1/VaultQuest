// Confirmation dialog: the app's replacement for window.confirm(). openConfirm() shows it and resolves true
// (confirmed) or false (cancelled: the cancel button, ✕, Escape, a click outside, or browser Back via
// core/history.js). Danger mode tints it coral and puts the focus on the safe choice first.
// Markup: #confirm in index.html · styles: styles/confirm.css.
import { $, $$ } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';

let resolve = null, opener = null;
const isOpen = () => $('#confirm').classList.contains('on');
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// body: trusted HTML built by the caller (escape anything the player typed, e.g. with core/md.js esc).
export function openConfirm({ kicker = 'Are you sure?', title = '', body = '', ok = 'OK', cancel = 'CANCEL', danger = false } = {}) {
  if (resolve) { const r = resolve; resolve = null; r(false); } // a dialog left open counts as cancelled
  opener = document.activeElement;
  $('#cf-kick').textContent = kicker; $('#cf-h').textContent = title; $('#cf-body').innerHTML = body;
  $('#cf-ok').textContent = ok; $('#cf-no').textContent = cancel;
  $('.cf').classList.toggle('danger', danger);
  const ov = $('#confirm');
  ov.getAnimations().forEach(a => a.cancel());
  ov.classList.add('on');
  anim(ov, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'none' });
  anim($('.cf'), [{ opacity: 0, transform: 'translateY(30px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: EASE.out, fill: 'none' });
  $$('#cf-body .cf-l').forEach((t, k) => anim(t, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 160 + k * 50, easing: EASE.back, fill: 'backwards' }));
  if (danger && !calm()) anim($('.cf-ic'), [{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(0)' }], { duration: 480, delay: 380, fill: 'none' });
  (danger ? $('#cf-no') : $('#cf-ok')).focus();
  return new Promise(r => { resolve = r; });
}

async function finish(yes) {
  if (!resolve) return;
  const r = resolve; resolve = null;
  await anim($('#confirm'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
  if (resolve) return r(yes); // a new dialog opened while this one faded out: leave it on screen
  $('#confirm').classList.remove('on'); $('#confirm').getAnimations().forEach(a => a.cancel());
  if (!yes && opener?.isConnected) opener.focus();
  r(yes);
}

export function mount() {
  $('#cf-ok').onclick = () => finish(true);
  $('#cf-no').onclick = () => finish(false);
  $('#cf-x').onclick = () => finish(false);
  $('#confirm').onclick = e => { if (e.target.id === 'confirm') finish(false); };
  addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
    if (e.key !== 'Tab') return;
    // Keep the focus inside the dialog (aria-modal): Tab cycles through its buttons.
    const f = $$('#confirm button'), i = f.indexOf(document.activeElement);
    const to = e.shiftKey ? (i <= 0 ? f.length - 1 : -1) : (i < 0 || i === f.length - 1 ? 0 : -1);
    if (to >= 0) { e.preventDefault(); f[to].focus(); }
  });
}
