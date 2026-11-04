// Level screen: 3 challenges (mcq / blank / fix), hearts, combo, mentor panel.
// Hearts, answer identity and the zero-hearts transition come from the shared engine (learn/attempt.js);
// this file only judges answers per language (option, blank, real code run) and draws the result.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE, shake } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { esc } from '../core/md.js';
import { hl } from '../core/highlight.js';
import { go } from '../core/router.js';
import { S, save, lvlOf, rk, reward } from '../core/state.js';
import { rollbackRun } from '../learn/progress.js';
import { newAttempt, answerKey, beginSubmission, settleSubmission, endAttempt, isCurrent, whenExhausted } from '../learn/attempt.js';
import { updHud } from '../ui/hud.js';
import { award, floatText } from '../ui/toast.js';
import { Mentor } from '../ui/mentor.js';
import { LANGS, freeOf } from '../content/languages.js';
import { playVaultCinematic } from '../cine/vault.js';
import { openMap, renderMap, setSel, rewindForTravel, travel } from './map.js';
import { runJsChallenge } from '../run/js-runner.js';
import { runPython, preloadPython } from '../run/py-runner.js';

let A = null; // the current attempt (shared engine state: hearts, answers tried, rewards paid)
export const G = { li: 0, ci: 0, combo: 0, mistakes: 0, hints: 0, chMistake: false, hintIdx: 0, lock: false };
const lvl = () => LANGS[S.lang].levels[G.li], chal = () => lvl().ch[G.ci];
const hearts = () => A ? A.session.hearts : 3;
const HEART = '<path d="M13 22S2 15 2 8a5.5 5.5 0 0 1 11-1.5A5.5 5.5 0 0 1 24 8c0 7-11 14-11 14z"';
const cmd = () => S.lang === 'py' ? 'python main.py' : 'node main.js';
const plain = s => s.replace(/<[^>]+>/g, '');
const aiChal = c => ({ type: c.t, q: plain(c.q), code: c.code });

export function startLevel(i) {
  endAttempt(A); Mentor.cancel(); Mentor.use('lv');
  A = newAttempt(S.lang, i);
  Object.assign(G, { li: i, ci: 0, combo: 0, mistakes: 0, hints: 0, chMistake: false, hintIdx: 0, lock: false });
  const L = LANGS[S.lang];
  $('#lv-kick').textContent = `VAULT 0${i + 1} · ${L.name.toUpperCase()}`; $('#lv-name').textContent = L.titles[i];
  $('#msgs').innerHTML = ''; $('#lv-combo').textContent = ''; renderHearts(); updHud();
  go('s-level').then(() => Mentor.say(`Welcome to **Vault 0${i + 1}: ${L.titles[i]}**. Solve ${lvl().ch.length} challenges to crack it. Stuck? Ask me anything — I'll guide you, but I won't just hand you the answer.`));
  renderCh(false);
}

// Leaving the vault ends the attempt: pending runs, replies and resets from it are ignored.
function leaveLevel() { endAttempt(A); Mentor.cancel(); openMap(); }

const renderSegs = () => { $('#lv-segs').innerHTML = lvl().ch.map((_, k) => `<i class="${k < G.ci ? 'on' : k === G.ci ? 'now' : ''}"></i>`).join(''); };
const renderHearts = () => { $('#lv-hearts').innerHTML = [0, 1, 2].map(k => `<div class="heart" aria-hidden="true">${k < hearts() ? `<svg viewBox="0 0 26 24">${HEART} fill="#FF9B7A"/></svg>` : `<svg viewBox="0 0 26 24">${HEART} fill="none" stroke="#3A4256" stroke-width="2"/></svg>`}</div>`).join(''); $('#lv-hearts').setAttribute('aria-label', hearts() + ' hearts left'); };

function updHint() {
  const n = G.hintIdx, b = $('#btn-hint');
  b.textContent = n >= 3 ? 'No hints left' : n === 0 ? 'Hint · free' : `Hint ${n + 1}/3 · free`;
}

async function renderCh(animate = true) {
  const c = chal(), card = $('#card');
  G.chMistake = false; G.hintIdx = 0; G.lock = true; renderSegs(); updHint();
  if (animate) await anim(card, [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateX(-80px)', filter: 'blur(8px)' }], { duration: 350, easing: EASE.in });
  const typ = { mcq: 'MULTIPLE CHOICE', blank: 'FILL THE BLANK', fix: 'FIX THE BUG' }[c.t];
  let h = `<div class="kicker">CHALLENGE ${G.ci + 1}/${lvl().ch.length} · ${typ}</div><h3>${c.q}</h3>`;
  if (c.t === 'mcq') h += `<pre class="codeblk">${hl(c.code, S.lang)}</pre><div class="opts">${c.opts.map((o, k) => `<button class="opt" data-k="${k}"><kbd>${'ABCD'[k]}</kbd>${esc(o[0])}</button>`).join('')}</div>`;
  if (c.t === 'blank') { const [a, b] = c.code.split('___'); h += `<pre class="codeblk">${hl(a, S.lang)}<input class="blank" id="blank" aria-label="Your answer" autocomplete="off" spellcheck="false">${hl(b, S.lang)}</pre><div class="row"><button class="btn" id="b-check">CHECK</button><span style="color:var(--mut2);font-size:14px">or press Enter</span></div>`; }
  if (c.t === 'fix') {
    const n = c.code.split('\n').length;
    h += `<div class="ed"><div class="gut" aria-hidden="true">${Array.from({ length: n }, (_, k) => k + 1).join('<br>')}</div><pre id="ed-hl" aria-hidden="true">${hl(c.code, S.lang)}\n</pre><textarea id="ed" spellcheck="false" aria-label="Code editor">${esc(c.code)}</textarea></div>
    <div class="row"><button class="btn" id="b-run"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2l9 5-9 5z" fill="#07090F"/></svg>RUN</button><span style="color:var(--mut2);font-size:14px">Runs your code for real</span></div>
    <div class="console" id="cons" aria-live="polite"><span class="dim">$ ${cmd()}</span></div>`;
    if (S.lang === 'py') preloadPython();
  }
  card.innerHTML = h; G.lock = false;
  if (c.t === 'mcq') $$('.opt').forEach(b => b.onclick = () => pickOpt(b));
  if (c.t === 'blank') { $('#b-check').onclick = checkBlank; $('#blank').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); checkBlank(); } }; }
  if (c.t === 'fix') {
    const ta = $('#ed');
    ta.oninput = () => { $('#ed-hl').innerHTML = hl(ta.value, S.lang) + '\n'; };
    ta.onkeydown = e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 4; ta.oninput(); } };
    $('#b-run').onclick = runFix;
  }
  if (animate) await anim(card, [{ opacity: 0, transform: 'translateX(80px)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 450, easing: EASE.out });
  card.getAnimations().forEach(a => a.cancel());
}

// Starts a submission → token, or null while the card is busy, one is being judged, or the attempt is over.
const begin = () => G.lock ? null : beginSubmission(A);

// One judged submission → shared heart rules → feedback. why() → the mentor's explanation, asked for only
// when it's shown (not for a repeated answer).
function settle(tok, el, type, value, passed, why) {
  const out = settleSubmission(A, tok, { key: answerKey(A, G.ci, type, value), passed });
  if (!out) return null; // stale: the attempt it belongs to has ended
  if (passed) correct(el, tok); else wrong(el, why, out, tok);
  return out;
}

function pickOpt(b) {
  const tok = begin(); if (!tok) return;
  const c = chal(), k = +b.dataset.k, o = c.opts[k];
  b.classList.add(o[1] ? 'ok' : 'bad');
  settle(tok, b, 'mcq', k, !!o[1], () => Mentor.fetchText('wrong', { lang: S.lang, challenge: aiChal(c), answer: o[0] }, o[2]));
}

function checkBlank() {
  const inp = $('#blank'), v = inp.value.trim(), c = chal(); if (!v) return; // an empty blank isn't an answer
  const tok = begin(); if (!tok) return;
  const ok = c.ans.includes(v);
  if (ok) { inp.classList.remove('bad'); inp.classList.add('ok'); }
  else { inp.classList.add('bad'); inp.value = ''; wait(900).then(() => inp.classList.remove('bad')); }
  settle(tok, inp, 'blank', v, ok, () => Mentor.fetchText('wrong', { lang: S.lang, challenge: aiChal(c), answer: v }, c.wrong[v] || c.why));
}

const regexFail = (c, code) => c.checks.find(k => (k.bad && k.bad.test(code)) || (k.need && !k.need.test(code)));
const outputOk = (out, ok) => out === ok || out.endsWith('\n' + ok);

// Runs the user's code for real (Pyodide worker / sandboxed JS worker). Falls back to regex checks
// if the runtime can't load. A run is a submission like any other: new failing code costs a heart,
// re-running code that already failed doesn't.
async function runFix() {
  const tok = begin(); if (!tok) return;
  const c = chal(), code = $('#ed').value, cons = $('#cons'), btn = $('#b-run'), head = `<span class="dim">$ ${cmd()}</span>`;
  btn.disabled = true;
  cons.innerHTML = head + '\n<span class="dim">running…</span>';
  let res;
  try { [res] = await Promise.all([S.lang === 'py' ? runPython(code) : runJsChallenge(code), wait(600)]); }
  catch (e) { res = null; }
  if (!isCurrent(A, tok)) return; // left or restarted the vault while the code ran
  let out, err;
  if (res) { out = res.stdout.trim(); err = res.stderr.trim(); }
  else { const f = regexFail(c, code); out = f ? '' : c.ok; err = f ? f.out : ''; }
  const f = regexFail(c, code);
  if (!err && outputOk(out, c.ok) && !f) {
    cons.innerHTML = `${head}\n${esc(out)}\n<span class="okl">✓ All checks passed</span>`;
    award('debug'); settle(tok, cons, 'code', code, true); return;
  }
  const msg = err || (outputOk(out, c.ok) ? '✗ Right output, but the bug is still in the code' : `✗ Expected output: ${c.ok}`);
  cons.innerHTML = `${head}\n${out ? esc(out) + '\n' : ''}<span class="err">${esc(msg)}</span>`;
  btn.disabled = false;
  const fallback = f ? f.why : err ? 'Read the **last line** of the error — it names the problem. Which word or symbol on that line looks different from what Python/JS expects?' : `It runs, but prints \`${out.split('\n').pop() || 'nothing'}\` instead of \`${c.ok.split('\n').pop()}\`. Which line produces the output?`;
  settle(tok, cons, 'code', code, false, () => Mentor.fetchText('wrong', { lang: S.lang, challenge: aiChal(c), answer: code, error: err || `wrong output: ${out}` }, fallback));
}

async function correct(el, tok) {
  G.lock = true; const p = ctr(el); G.combo++;
  const gain = reward(rk(G.li, G.ci), 50 + (G.combo - 1) * 10, A.run); updHud(); save(); // 0 on replay
  FX.spark(p.x, p.y, 46, null, .9); FX.ring(p.x, p.y, 140, '#4FD8C4', 3); floatText('+' + gain + ' XP', p.x, p.y - 30);
  anim($('#card'), [{ boxShadow: '0 0 0 0 rgba(79,216,196,0)' }, { boxShadow: '0 0 0 3px rgba(79,216,196,.7), 0 0 60px -10px rgba(79,216,196,.6)' }, { boxShadow: '0 0 0 0 rgba(79,216,196,0)' }], { duration: 900, fill: 'none' });
  if (G.combo >= 2) { $('#lv-combo').textContent = 'COMBO x' + G.combo; const m = ctr($('.l-main')); floatText('COMBO x' + G.combo, m.x, m.y - 200, 'slam'); }
  if (G.combo >= 3) award('combo');
  if (G.chMistake) award('bounce');
  const praise = G.chMistake ? ['There it is. You found it yourself — that\'s how it sticks.', 'Yes! Mistake → understanding. That\'s the whole game.'] : ['Clean. Nice work.', 'Exactly right.', 'Sharp. On to the next one.'];
  Mentor.say(praise[(G.ci + G.combo) % praise.length], { kind: 'good', fast: true });
  await wait(1500);
  if (!isCurrent(A, tok)) return; // left the vault during the pause
  G.ci++;
  if (G.ci >= lvl().ch.length) return levelDone();
  renderCh(true);
}

const DUPLICATE = 'Same answer as before, so **no heart lost** — and the result won\'t change. What will you try differently?';

async function wrong(el, why, out, tok) {
  G.combo = 0; $('#lv-combo').textContent = ''; G.chMistake = true;
  anim(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-12px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 450, fill: 'none' });
  if (out.duplicate) return Mentor.say(DUPLICATE, { label: 'MENTOR' });
  G.mistakes++;
  shake($('#app'));
  anim($('#vign'), [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }], { duration: 800, fill: 'none' });
  loseHeart();
  if (out.exhausted) G.lock = true; // nothing more can be answered in this attempt
  await Mentor.say(why(), { kind: 'fix' });
  if (out.exhausted) outOfHearts(tok);
}

// Zero hearts — the single place this is handled, for every language. Until Syntax Recovery exists
// (Phase 4) the vault restarts: only this attempt's XP is taken back, and nothing happens if the
// player has left the vault in the meantime.
function outOfHearts(tok) {
  return whenExhausted(() => A, tok, {
    announce: () => Mentor.say('Out of hearts — the vault resets. Take a breath, you\'ve got this.', { kind: 'fix' }),
    pause: () => wait(1200),
    next: () => { rollbackRun(S, A.run); save(); updHud(); startLevel(G.li); }
  });
}

function loseHeart() {
  const left = hearts(), h = $$('#lv-hearts .heart')[left]; if (!h) return; const p = ctr(h);
  h.innerHTML = `<svg viewBox="0 0 26 24">${HEART} fill="none" stroke="#3A4256" stroke-width="2"/></svg><svg class="hl" viewBox="0 0 26 24" style="clip-path:inset(0 50% 0 0)">${HEART} fill="#FF9B7A"/></svg><svg class="hr" viewBox="0 0 26 24" style="clip-path:inset(0 0 0 50%)">${HEART} fill="#FF9B7A"/></svg>`;
  anim(h.querySelector('.hl'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(-10px,26px) rotate(-35deg)', opacity: 0 }], { duration: 800, easing: EASE.in });
  anim(h.querySelector('.hr'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(10px,26px) rotate(35deg)', opacity: 0 }], { duration: 800, easing: EASE.in });
  FX.spark(p.x, p.y, 18, '#FF9B7A', .5);
  $('#lv-hearts').setAttribute('aria-label', left + ' hearts left');
}

async function levelDone() {
  const i = G.li, stars = G.mistakes <= 1 ? 3 : G.mistakes <= 3 ? 2 : 1;
  const free = freeOf(S.lang), wasDone = i < free ? i < S.done[S.lang] : !!S.stars[S.lang + i];
  const prevXp = S.xp, bonus = reward(rk(i, 'bonus'), 150 + i * 50 + stars * 30, A.run); // once per vault; better stars on replay pay nothing
  endAttempt(A); // the vault is cracked: nothing from this attempt can be taken back any more
  S.stars[S.lang + i] = Math.max(S.stars[S.lang + i] || 0, stars);
  if (!wasDone && i < free) S.done[S.lang] = i + 1;
  save();
  await playVaultCinematic({ kick: `VAULT 0${i + 1} CRACKED`, title: 'UNLOCKED', stars, bonus, prevXp, lvBefore: lvlOf(prevXp), mistakes: G.mistakes, first: i === 0 });
  setSel(i); await go('s-map'); renderMap();
  if (!wasDone && i + 1 < free && rewindForTravel(i)) { await wait(500); await travel(i); }
  if (G.mistakes === 0) award('clean');
  if (G.hints === 0) award('hintfree');
  if (S.done[S.lang] >= free) award('legend');
  save();
}

// Keyword fallback for free-text questions (prototype Mentor.answer).
function localAnswer(q) {
  const s = q.toLowerCase(), c = chal();
  if (/(==|=).*(=|==)|assign|equal|difference|razlik/.test(s) && /=/.test(s)) return 'Great question. `=` **stores** a value: `score = 10` puts 10 in the box. `==` **compares** two values and answers True or False: `score == 10` asks "is it 10?". So use `=` to save, `==` to check.';
  if (/case|capital|upper|big letter|name/.test(s)) return 'Python treats `Name` and `name` as completely different names — it\'s case-sensitive. Check that every use matches how the variable was first written.';
  if (/return|print|none/.test(s)) return '`print` shows a value on the screen. `return` hands it back to whoever called the function. If a function never returns, the caller gets `None`.';
  if (/colon|:|indent/.test(s)) return 'Lines that open a block (`if`, `for`, `def`, `while`) end with `:` and the block below is indented by 4 spaces.';
  if (/string|quote|str/.test(s)) return 'Anything in quotes is a **string** — text. `"5"` is text, `5` is a number. `+` joins strings but adds numbers.';
  if (/why|error|wrong|crash/.test(s)) return c.t === 'fix' ? 'Read the last line of the error — it names the problem. Then find that exact word in your code. What\'s different about it?' : 'What do you expect each line to do? Walk through it one line at a time and say the value out loud.';
  return 'Let\'s reason it out together: what do you expect this code to do, and where could reality differ? Try the smallest change, run it, and compare.';
}

export function mount() {
  $('#m-form').onsubmit = e => {
    e.preventDefault(); const i = $('#m-in'), v = i.value.trim(); if (!v) return;
    i.value = ''; Mentor.user(v); S.questions++; award('curious'); save();
    Mentor.ask('ask', { lang: S.lang, challenge: aiChal(chal()), question: v }, localAnswer(v), { label: 'MENTOR' });
  };
  $('#btn-hint').onclick = () => {
    const c = chal(); if (G.hintIdx >= c.hints.length) return;
    const n = ++G.hintIdx; G.hints++; updHint(); // hints are always free
    Mentor.ask('hint', { lang: S.lang, challenge: aiChal(c), hintLevel: n }, c.hints[n - 1], { kind: 'hint', label: `HINT ${n}/3` });
  };
  $('#btn-explain').onclick = () => Mentor.ask('explain', { lang: S.lang, concept: lvl().concept, challenge: aiChal(chal()) }, lvl().concept, { label: 'CONCEPT' });
  $('#lv-back').onclick = leaveLevel;
}
