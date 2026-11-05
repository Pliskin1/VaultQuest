// "Rate VaultQuest" modal (profile) + testimonial marquee (paywall, free users only).
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { S, save, lvlOf, initials, DEMO } from '../core/state.js';
import { esc } from '../core/md.js';
import { SEED } from '../content/reviews.js';

const MAX = 280, MIN = 10;
const LBL = ['Tap a star', 'Not for me', 'Needs work', 'It’s okay', 'Really good', 'Love it!'];
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
export const starRow = n => Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}">${STAR}</i>`).join('');

let rating = 0, busy = false, onDone = null;

async function api(url, opts = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Something went wrong, try again');
    return j;
  } catch (e) { throw e.name === 'AbortError' ? new Error('Server not responding, try again') : e; }
  finally { clearTimeout(t); }
}

const text = () => $('#rv-text').value.trim();
function paint(n) {
  $$('#rv-stars button').forEach((b, i) => { b.classList.toggle('on', i < n); b.setAttribute('aria-checked', String(i + 1 === rating)); });
  $('#rv-label').textContent = LBL[n];
  $('#rv-label').classList.toggle('set', n > 0);
}
function check() {
  const n = text().length;
  $('#rv-count').textContent = `${n} / ${MAX}`;
  $('#rv-count').classList.toggle('warn', n > MAX - 30);
  $('#rv-send').disabled = busy || !rating || n < MIN;
}

const close = () => { $('#review').classList.remove('on'); };

export function openReview(done) {
  onDone = done || null;
  rating = S.review?.stars || 0;
  $('#rv-text').value = S.review?.text || '';
  $('#rv-av').textContent = initials();
  $('#rv-name').textContent = S.name || 'Player';
  $('#rv-sub').textContent = `LVL ${lvlOf(S.xp)} · ${S.lang === 'js' ? 'JavaScript' : 'Python'}`;
  $('#rv-err').textContent = '';
  $('#rv-send').textContent = S.review ? 'UPDATE REVIEW' : 'POST REVIEW';
  paint(rating); check();
  const ov = $('#review'); ov.classList.add('on');
  anim(ov, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'none' });
  anim($('.rv'), [{ opacity: 0, transform: 'translateY(30px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: EASE.out, fill: 'none' });
  $$('#rv-stars button').forEach((b, k) => anim(b, [{ opacity: 0, transform: 'scale(.4) rotate(-40deg)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120 + k * 60, easing: EASE.back, fill: 'backwards' }));
  ($$('#rv-stars button')[Math.max(0, rating - 1)]).focus();
}

function pick(n) {
  rating = n; paint(n); check();
  const b = $$('#rv-stars button')[n - 1], p = ctr(b);
  anim(b, [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 320, easing: EASE.out, fill: 'none' });
  FX.spark(p.x, p.y, 6 + n * 4, null, .5);
  if (n === 5) FX.ring(p.x, p.y, 70, '#F2B544', 2);
}

async function send() {
  if (busy) return;
  const b = $('#rv-send'), t = text();
  busy = true; check(); $('#rv-err').textContent = '';
  b.innerHTML = '<span class="spinner"></span>&nbsp;POSTING…';
  try {
    const body = { name: S.name, stars: rating, text: t, lvl: lvlOf(S.xp), lang: S.lang };
    if (DEMO) await wait(700);
    else await api('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    S.review = { stars: rating, text: t, at: Date.now() }; save();
    b.innerHTML = '✓ THANK YOU'; b.classList.add('ok');
    const p = ctr(b); FX.spark(p.x, p.y, 30, null, .7); FX.ring(p.x, p.y, 120, '#4FD8C4', 3);
    await wait(900);
    await anim($('#review'), [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
    close(); $('#review').getAnimations().forEach(a => a.cancel());
    onDone?.();
  } catch (e) {
    $('#rv-err').textContent = e.message;
    anim($('.rv'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 300, fill: 'none' });
    b.textContent = S.review ? 'UPDATE REVIEW' : 'POST REVIEW';
  } finally { busy = false; b.classList.remove('ok'); check(); }
}

export function mount() {
  $$('#rv-stars button').forEach((b, i) => {
    b.onclick = () => pick(i + 1);
    b.onmouseenter = () => paint(i + 1);
    b.onkeydown = e => {
      const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (d) { e.preventDefault(); const n = Math.min(5, Math.max(1, (rating || i + 1) + (rating ? d : 0))); pick(n); $$('#rv-stars button')[n - 1].focus(); }
    };
  });
  $('#rv-stars').onmouseleave = () => paint(rating);
  $('#rv-text').oninput = check;
  $('#rv-text').onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !$('#rv-send').disabled) send(); };
  $('#rv-send').onclick = send;
  $('#rv-x').onclick = close;
  $('#review').onclick = e => { if (e.target.id === 'review' && !busy) close(); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && $('#review').classList.contains('on') && !busy) close(); });
}

// ---------- testimonials ----------
const card = r => `<article class="tcard"><div class="tc-top"><div class="tc-av">${esc(r.name.slice(0, 2).toUpperCase())}</div><div class="tc-who"><b>${esc(r.name)}</b><span>LVL ${r.lvl || 1} · ${r.lang === 'js' ? 'JavaScript' : 'Python'}</span></div><div class="stars sm" aria-label="${r.stars} out of 5 stars">${starRow(r.stars)}</div></div><p>“${esc(r.text)}”</p></article>`;

export async function renderTestimonials() {
  const el = $('#pro-tst');
  let list;
  try { list = (await api('/api/reviews')).reviews; } catch { list = SEED; }
  if (S.review && S.name && !list.some(r => r.name.toLowerCase() === S.name.toLowerCase())) list = [{ name: S.name, lvl: lvlOf(S.xp), lang: S.lang, ...S.review }, ...list];
  if (!list?.length) { el.hidden = true; return; }
  const avg = list.reduce((s, r) => s + r.stars, 0) / list.length;
  const loop = list.length >= 3 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.hidden = false;
  el.innerHTML = `<div class="tst-head"><div class="stars" aria-hidden="true">${starRow(Math.round(avg))}</div><b>${avg.toFixed(1)}</b><span>from ${list.length} player${list.length > 1 ? 's' : ''} · what the community says</span></div>
    <div class="tst-view"><div class="tst-track ${loop ? 'loop' : ''}" style="--dur:${list.length * 7}s">${list.map(card).join('')}${loop ? `<div class="tst-dup" aria-hidden="true">${list.map(card).join('')}</div>` : ''}</div></div>`;
  anim(el, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 450, easing: EASE.out, fill: 'backwards' });
}
