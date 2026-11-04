// Syntax Recovery screen: three questions about the student's own mistakes win the hearts back. One screen
// and one engine (learn/attempt.js) for every language — the questions come from the curriculum's bank.
// The vault screen opens it with callbacks, so this file never imports the vault screen.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { FX } from '../core/fx.js';
import { esc, md } from '../core/md.js';
import { hl } from '../core/highlight.js';
import { go } from '../core/router.js';
import { currentQuestion, answerRecoveryQuestion, finishRecovery, recoveryDone } from '../learn/attempt.js';
import { getQuestion, RECOVERY_SIZE } from '../learn/recovery.js';
import { MAX_HEARTS } from '../learn/hearts.js';

const HEART = '<path d="M13 22S2 15 2 8a5.5 5.5 0 0 1 11-1.5A5.5 5.5 0 0 1 24 8c0 7-11 14-11 14z"';
// ctx: { attempt, lang, langName, title, challenge (index), save(), leave(), back() }
let R = null;
const live = () => R && !R.attempt.over;

export function openRecovery(ctx) {
  R = { ...ctx, busy: false };
  $('#rc-kick').textContent = `SYNTAX RECOVERY · ${ctx.langName.toUpperCase()}`;
  $('#rc-name').textContent = ctx.title;
  renderHearts(); renderWhy(); render(false);
  return go('s-recovery');
}

const rec = () => R.attempt.session.recovery;
const heartsHtml = n => [0, 1, 2].map(k => `<div class="heart" aria-hidden="true"><svg viewBox="0 0 26 24">${HEART} ${k < n ? 'fill="#FF9B7A"' : 'fill="none" stroke="#3A4256" stroke-width="2"'}/></svg></div>`).join('');
function renderHearts() {
  const n = R.attempt.session.hearts, r = rec();
  $('#rc-hearts').innerHTML = heartsHtml(n);
  $('#rc-hearts').setAttribute('aria-label', n + ' hearts left');
  $('#rc-segs').innerHTML = Array.from({ length: RECOVERY_SIZE }, (_, k) => `<i class="${k < r.index ? 'on' : k === r.index ? 'now' : ''}"></i>`).join('');
}

// Why Recovery started and what it practises — honest about whether the questions come from the
// student's own mistakes or are refreshers on the vault's ideas.
function renderWhy() {
  const r = rec(), qs = r.questionIds.map(id => getQuestion(r.bank, id));
  const own = qs.filter(q => r.targeted.includes(q.id)), more = qs.filter(q => !r.targeted.includes(q.id));
  const list = l => l.map(q => `<li>${esc(q.concept)}</li>`).join('');
  $('#rc-why').innerHTML = `<div class="kicker" style="color:var(--coral)">OUT OF HEARTS</div>
    <h3>Nothing is lost.</h3>
    <p>You used your three hearts on <b>Challenge ${R.challenge + 1}</b>. Your answers, code and XP are saved — answer three short questions to win your hearts back, then you continue right where you stopped.</p>
    ${own.length ? `<div class="kicker">FROM YOUR MISTAKES</div><ul>${list(own)}</ul>` : ''}
    ${more.length ? `<div class="kicker">${own.length ? 'PLUS A REFRESHER' : 'REFRESHERS ON THIS VAULT'}</div><ul>${list(more)}</ul>` : ''}
    <div class="rc-rule"><b>No penalty.</b> A wrong answer here costs nothing. Each correct answer gives back one heart.</div>`;
}

async function render(animate = true) {
  const card = $('#rc-card'), r = rec();
  if (animate) await anim(card, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-60px)' }], { duration: 300, easing: EASE.in });
  if (!live()) return;
  if (recoveryDone(R.attempt)) {
    card.innerHTML = `<div class="kicker" style="color:var(--cyan)">HEARTS RESTORED · ${RECOVERY_SIZE}/${RECOVERY_SIZE}</div>
      <h3>You’re ready to go back.</h3><div class="rc-big">${heartsHtml(MAX_HEARTS)}</div>
      <p class="rc-sub">${r.wrong ? `${r.wrong} wrong answer${r.wrong > 1 ? 's' : ''} along the way · no penalty.` : 'Every answer right the first time.'} Your code and answers are exactly as you left them.</p>
      <div class="row"><button class="btn" id="rc-return">BACK TO CHALLENGE ${R.challenge + 1}</button></div>`;
    $('#rc-return').onclick = backToChallenge;
  } else {
    const q = currentQuestion(R.attempt);
    let h = `<div class="kicker">QUESTION ${r.index + 1} OF ${RECOVERY_SIZE} · ${esc(q.concept.toUpperCase())}</div><h3>${esc(q.prompt)}</h3><pre class="codeblk">${hl(q.code, R.lang)}</pre>`;
    h += q.type === 'mcq'
      ? `<div class="opts">${q.options.map((o, k) => `<button class="opt" data-k="${k}"><kbd>${'ABCD'[k]}</kbd>${esc(o)}</button>`).join('')}</div>`
      : `<div class="row"><input class="blank rc-fill" id="rc-fill" aria-label="Your answer" autocomplete="off" spellcheck="false"><button class="btn" id="rc-check">CHECK</button></div>`;
    card.innerHTML = h + '<div class="rc-fb" id="rc-fb" aria-live="polite"></div>';
    if (q.type === 'mcq') $$('#rc-card .opt').forEach(b => b.onclick = () => answer(q.id, +b.dataset.k, b));
    else { const inp = $('#rc-fill'), check = () => inp.value.trim() && answer(q.id, inp.value, inp); $('#rc-check').onclick = check; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); check(); } }; }
  }
  R.busy = false;
  if (animate) await anim(card, [{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE.out });
  card.getAnimations().forEach(a => a.cancel());
}

// One answer. The engine ignores answers for a question that is no longer current, and `busy` blocks
// clicks until the student moves on — so double-clicks can't answer the next question.
function answer(qid, value, el) {
  if (!live() || R.busy) return;
  R.busy = true;
  const res = answerRecoveryQuestion(R.attempt, qid, value);
  if (!res) { R.busy = false; return; }
  R.save();
  const fb = $('#rc-fb'), p = ctr(el);
  if (!res.correct) {
    el.classList.add('bad'); if (el.tagName === 'BUTTON') el.disabled = true; else el.value = '';
    anim(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 350, fill: 'none' });
    fb.className = 'rc-fb bad'; fb.innerHTML = `<p><b>Not quite — no heart lost.</b> ${md(res.question.hint)}</p>`;
    R.busy = false;
    return;
  }
  el.classList.add('ok');
  $$('#rc-card .opt, #rc-check').forEach(b => { b.disabled = true; });
  renderHearts();
  const h = $$('#rc-hearts .heart')[res.hearts - 1];
  if (h) { const c = ctr(h); anim(h, [{ transform: 'scale(.3)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 600, easing: EASE.back, fill: 'none' }); FX.spark(c.x, c.y, 26, '#FF9B7A', .6); }
  FX.spark(p.x, p.y, 36, '#4FD8C4', .8); FX.ring(p.x, p.y, 120, '#4FD8C4', 3);
  const last = res.complete;
  fb.className = 'rc-fb ok';
  fb.innerHTML = `<p><b>Correct · +1 heart.</b> ${md(res.question.explain)}</p><div class="row"><button class="btn" id="rc-next">${last ? 'ALL HEARTS BACK' : 'NEXT QUESTION'}</button></div>`;
  $('#rc-next').onclick = () => { if (live()) { $('#rc-next').disabled = true; render(true); } };
  $('#rc-next').focus();
}

function backToChallenge() {
  if (!live() || R.busy) return;
  R.busy = true;
  if (!finishRecovery(R.attempt)) { R.busy = false; return; }
  R.save();
  R.back();
}

export function mount() {
  $('#rc-back').onclick = () => { if (R) R.leave(); };
}
