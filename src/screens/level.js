// Level screen: 3 challenges (mcq / fill / code — and the Pro vault's blank / fix), hearts, combo, mentor panel.
// Hearts, answer identity, saving/resuming and Syntax Recovery come from the shared engine
// (learn/attempt.js); this file only judges answers per language (option, blank, real code run),
// diagnoses failures through learn/diagnose.js and draws the result.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE, shake } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { esc, md } from '../core/md.js';
import { hl } from '../core/highlight.js';
import { go } from '../core/router.js';
import { S, save, lvlOf, rk, reward } from '../core/state.js';
import { newAttempt, attemptKey, answerKey, beginSubmission, settleSubmission, cancelSubmission, endAttempt, isCurrent, whenExhausted, inRecovery, startRecovery, fromSave, toSave, explainApproach, answerApproach, startCoding, inPlanning } from '../learn/attempt.js';
import { MAX_CHARS } from '../learn/approach.js';
import { diagnose } from '../learn/diagnose.js';
import { judge, fillCode } from '../learn/judge.js';
import { updHud } from '../ui/hud.js';
import { award, floatText } from '../ui/toast.js';
import { Mentor } from '../ui/mentor.js';
import { LANGS, freeOf } from '../content/languages.js';
import { playVaultCinematic } from '../cine/vault.js';
import { openMap, openMapAt, renderMap, setSel, rewindForTravel, travel } from './map.js';
import { canEnter, nextStep, roles } from '../learn/unlock.js';
import { openRecovery } from './recovery.js';
import { openPro } from './pro.js';
import { startProject } from './project.js';
import { runJsChallenge, observeJs } from '../run/js-runner.js';
import { runPython, preloadPython, observePython, pythonStatus } from '../run/py-runner.js';

let A = null; // the current attempt (shared engine state: hearts, answers tried, recovery, saved view)
export const G = { li: 0, ci: 0, combo: 0, mistakes: 0, hints: 0, chMistake: false, hintIdx: 0, lock: false };
const lvl = () => LANGS[S.lang].levels[G.li], chal = () => lvl().ch[G.ci];
const hearts = () => A ? A.session.hearts : 3;
const HEART = '<path d="M13 22S2 15 2 8a5.5 5.5 0 0 1 11-1.5A5.5 5.5 0 0 1 24 8c0 7-11 14-11 14z"';
const cmd = () => S.lang === 'py' ? 'python main.py' : 'node main.js';
const plain = s => s.replace(/<[^>]+>/g, '');
const aiChal = c => ({ type: c.t, q: plain(c.q), code: c.code });
// "Vault 03 · Make Things Work" / "Mini Boss · Count Completed Tasks"
const vaultName = (lang, i) => LANGS[lang].levels[i].boss ? `Mini Boss · ${LANGS[lang].titles[i].replace(/^Mini Boss: /, '')}` : `Vault 0${i + 1} · ${LANGS[lang].titles[i]}`;

// Opens a vault. An unfinished attempt saved in the profile is resumed exactly — same challenge, hearts,
// answers and code; a locked one goes straight back to Syntax Recovery. Otherwise a new attempt starts.
export function startLevel(i, { afterRecovery = false } = {}) {
  flushDraft(); endAttempt(A); Mentor.cancel(); Mentor.use('lv');
  const L = LANGS[S.lang], cur = S.curriculum[S.lang];
  if (L.levels[i]?.t) return startProject(i); // projects and the Final Boss have their own screen
  // The order of World 1 is enforced here too (learn/unlock.js) — a locked vault opens the map on it instead.
  if (!canEnter(S, S.lang, L, i)) return i >= freeOf(S.lang) && !S.pro ? openPro() : openMapAt(i);
  const n = L.levels[i].ch.length;
  const approach = L.levels[i].ch.some(c => c.approach); // explain-first vault (Mini Boss)
  const saved = fromSave(S.attempts[attemptKey(cur, i)], { lang: S.lang, vault: i, curriculum: cur, challenges: n, approach });
  A = saved || newAttempt(S.lang, i, cur, { approach });
  const { drafts, ...view } = A.view;
  Object.assign(G, { li: i, ...view, lock: false });
  $('#lv-kick').textContent = `${L.levels[i].boss ? 'MINI BOSS' : `VAULT 0${i + 1}`} · ${L.name.toUpperCase()}`; $('#lv-name').textContent = L.titles[i].replace(/^Mini Boss: /, '');
  $('#msgs').innerHTML = ''; $('#lv-combo').textContent = G.combo >= 2 ? 'COMBO x' + G.combo : ''; renderHearts(); updHud();
  if (inRecovery(A)) return enterRecovery(); // refresh, leaving or reopening never skips Recovery
  if (G.ci >= n) return levelDone(); // every challenge was solved before the celebration could play
  const welcome = afterRecovery ? `**Syntax Recovery complete** · 3 hearts restored. You're back on Challenge ${G.ci + 1} — your answers and code are just as you left them.`
    : saved && L.levels[i].boss ? `Welcome back to the **Mini Boss**. ${!A.approach?.accepted ? 'Your plan so far is saved — keep explaining it.' : !A.approach.started ? 'Your plan is accepted — press **Start coding** when you\'re ready.' : `You have ${hearts()} heart${hearts() === 1 ? '' : 's'}, and your plan and code are saved.`}`
    : saved ? `Welcome back to **Vault 0${i + 1}: ${L.titles[i]}**. You're on Challenge ${G.ci + 1} of ${n} with ${hearts()} heart${hearts() === 1 ? '' : 's'} — everything you did is saved.`
    : L.levels[i].boss ? `Welcome to the **Mini Boss: ${L.titles[i].replace(/^Mini Boss: /, '')}**. Explain your plan first — I'll ask about anything that's missing. The code editor unlocks once your plan is complete.`
    : `Welcome to **Vault 0${i + 1}: ${L.titles[i]}**. Solve ${n} challenges to crack it. Stuck? Ask me anything — I'll guide you, but I won't just hand you the answer.`;
  Mentor.say(welcome, afterRecovery ? { kind: 'good', label: 'SYNTAX RECOVERY' } : {}); // queued first: replies to early clicks follow it
  go('s-level');
  renderCh(false, true);
}

// Saves the attempt into the profile, so refreshing, leaving or switching language resumes it exactly.
function persist(view = {}) {
  if (!A || A.over) return;
  A.view = { ...A.view, ci: G.ci, combo: G.combo, mistakes: G.mistakes, hints: G.hints, chMistake: G.chMistake, hintIdx: G.hintIdx, ...view };
  S.attempts[attemptKey(A.curriculum, A.vault)] = toSave(A); save();
}

// The student's unsubmitted code / blank text, kept per challenge (saved shortly after typing stops).
let draftTimer = null;
const draftEl = () => $('#card #ed') || $('#card #blank');
function keepDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(flushDraft, 300); }
function flushDraft() {
  clearTimeout(draftTimer); draftTimer = null;
  const plan = $('#card #ap');
  if (plan && A && !A.over && A.approach && !A.approach.accepted && A.approach.text !== plan.value) { A.approach = { ...A.approach, text: plan.value.slice(0, MAX_CHARS) }; return persist(); }
  const el = draftEl();
  if (!A || A.over || G.lock || !el || inRecovery(A) || A.view.drafts[G.ci] === el.value) return;
  persist({ drafts: { ...A.view.drafts, [G.ci]: el.value } });
}

// Leaving the vault ends the attempt object: pending runs, replies and transitions from it are ignored.
// Its saved state stays in the profile, so coming back resumes it (hearts and Recovery included).
function leaveLevel() { flushDraft(); endAttempt(A); Mentor.cancel(); openMap(); }

const renderSegs = () => { $('#lv-segs').innerHTML = lvl().ch.map((_, k) => `<i class="${k < G.ci ? 'on' : k === G.ci ? 'now' : ''}"></i>`).join(''); };
const renderHearts = () => { $('#lv-hearts').innerHTML = [0, 1, 2].map(k => `<div class="heart" aria-hidden="true">${k < hearts() ? `<svg viewBox="0 0 26 24">${HEART} fill="#FF9B7A"/></svg>` : `<svg viewBox="0 0 26 24">${HEART} fill="none" stroke="#3A4256" stroke-width="2"/></svg>`}</div>`).join(''); $('#lv-hearts').setAttribute('aria-label', hearts() + ' hearts left'); };

function updHint() {
  const n = G.hintIdx, b = $('#btn-hint');
  b.style.display = inPlanning(A) ? 'none' : ''; // no hints while planning (docs/PLAN.md §H)
  b.textContent = n >= 3 ? 'No hints left' : n === 0 ? 'Hint · free' : `Hint ${n + 1}/3 · free`;
}

// resume: keep this challenge's saved hint level and mistake flag (reopening a saved attempt).
async function renderCh(animate = true, resume = false) {
  if (chal().approach && inPlanning(A)) return renderPlan(animate);
  const c = chal(), card = $('#card'), draft = A.view.drafts[G.ci];
  if (!resume) { G.chMistake = false; G.hintIdx = 0; }
  G.lock = true; renderSegs(); updHint();
  if (animate) await anim(card, [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateX(-80px)', filter: 'blur(8px)' }], { duration: 350, easing: EASE.in });
  const typ = { mcq: 'MULTIPLE CHOICE', blank: 'FILL THE BLANK', fill: 'FILL THE BLANK', fix: 'FIX THE BUG', code: c.kind === 'fix' ? 'FIX THE BUG' : 'WRITE THE CODE' }[c.t];
  const q = /<[a-z]/i.test(c.q) ? c.q : md(c.q); // Pro vault prompts are HTML; World 1 prompts use `code` / **bold**
  let h = `<div class="kicker">${lvl().boss ? 'MINI BOSS' : `CHALLENGE ${G.ci + 1}/${lvl().ch.length}`} · ${typ}</div><h3>${q}</h3>`;
  if (c.t === 'mcq') h += `<pre class="codeblk">${hl(c.code, S.lang)}</pre><div class="opts">${c.opts.map((o, k) => `<button class="opt" data-k="${k}"><kbd>${'ABCD'[k]}</kbd>${esc(o[0])}</button>`).join('')}</div>`;
  if (c.t === 'blank' || c.t === 'fill') { const [a, b] = c.code.split('___'); h += `<pre class="codeblk">${hl(a, S.lang)}<input class="blank" id="blank" aria-label="Your answer" autocomplete="off" spellcheck="false" value="${esc(draft ?? '').replace(/"/g, '&quot;')}">${hl(b, S.lang)}</pre><div class="row"><button class="btn" id="b-check">CHECK</button><span style="color:var(--mut2);font-size:14px">or press Enter</span></div>`; }
  if (c.approach) h += `<details class="ap-plan"><summary>YOUR PLAN · accepted</summary><p>${esc(A.approach.text)}</p>${A.approach.answers.map(x => `<p class="ap-ans">${esc(x)}</p>`).join('')}</details>`;
  if (c.t === 'fix' || c.t === 'code') {
    const code = draft ?? c.code, n = Math.max(code.split('\n').length, c.code.split('\n').length);
    h += `<div class="ed"><div class="gut" aria-hidden="true">${Array.from({ length: n }, (_, k) => k + 1).join('<br>')}</div><pre id="ed-hl" aria-hidden="true">${hl(code, S.lang)}\n</pre><textarea id="ed" spellcheck="false" aria-label="Code editor">${esc(code)}</textarea></div>
    <div class="row"><button class="btn" id="b-run"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2l9 5-9 5z" fill="#07090F"/></svg>RUN</button><span style="color:var(--mut2);font-size:14px">Runs your code for real</span></div>
    <div class="console" id="cons" aria-live="polite"><span class="dim">$ ${cmd()}</span></div>`;
    if (S.lang === 'py') preloadPython();
  }
  card.innerHTML = h; G.lock = false;
  if (c.t === 'mcq') $$('.opt').forEach(b => b.onclick = () => pickOpt(b));
  if (c.t === 'blank' || c.t === 'fill') { $('#b-check').onclick = checkBlank; $('#blank').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); checkBlank(); } }; $('#blank').oninput = keepDraft; }
  if (c.t === 'fix' || c.t === 'code') {
    const ta = $('#ed');
    ta.oninput = () => { $('#ed-hl').innerHTML = hl(ta.value, S.lang) + '\n'; keepDraft(); };
    ta.onkeydown = e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 4; ta.oninput(); } };
    $('#b-run').onclick = c.t === 'code' ? runCode : runFix;
  }
  if (animate) await anim(card, [{ opacity: 0, transform: 'translateX(80px)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 450, easing: EASE.out });
  card.getAnimations().forEach(a => a.cancel());
}

// ── MINI BOSS · PLAN FIRST: the editor stays hidden — and the engine refuses submissions — until the mentor has
// accepted the plan. Explaining is always free: no hearts, no XP. ──
const planStatus = p => p.accepted ? '✓ Plan accepted — coding is unlocked.' : p.reviews ? 'Answer the mentor’s question in the chat, or improve your plan and explain it again.' : 'Your mentor reads your plan and asks about anything that’s missing. Coding unlocks once your plan is complete.';
async function renderPlan(animate) {
  const c = chal(), card = $('#card'), p = A.approach;
  G.lock = true; renderSegs(); updHint();
  if (animate) await anim(card, [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateX(-80px)', filter: 'blur(8px)' }], { duration: 350, easing: EASE.in });
  card.innerHTML = `<div class="kicker" style="color:var(--coral)">MINI BOSS · PLAN FIRST</div><h3>${md(c.q)}</h3>
    <p class="ap-sub">${esc(c.approach.prompt)}</p><pre class="codeblk">${hl(c.approach.sample, S.lang)}</pre>
    <div class="ap-box"><textarea id="ap" maxlength="${MAX_CHARS}" aria-label="Your plan" placeholder="In your own words: what will your function go through, what will it check, and what will it give back?">${esc(p.text)}</textarea>
    <div class="ap-meta"><span id="ap-count"></span><span>Explaining is always free — no hearts</span></div></div>
    <div class="row"><button class="btn" id="ap-explain">EXPLAIN TO THE MENTOR</button><button class="btn pro" id="ap-start">START CODING</button></div>
    <div class="ap-status" id="ap-status"></div>`;
  const ta = $('#ap'), count = () => { const w = (ta.value.match(/[\p{L}\p{N}_']+/gu) || []).length; $('#ap-count').textContent = `${w} word${w === 1 ? '' : 's'} · ${ta.value.length}/${MAX_CHARS}`; };
  ta.oninput = () => { count(); keepDraft(); }; count();
  $('#ap-explain').onclick = explainPlan; $('#ap-start').onclick = beginCoding;
  showPlanState();
  G.lock = false;
  if (animate) await anim(card, [{ opacity: 0, transform: 'translateX(80px)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 450, easing: EASE.out });
  card.getAnimations().forEach(a => a.cancel());
}
function showPlanState() {
  const p = A.approach, st = $('#ap-status'); if (!st) return;
  st.textContent = planStatus(p); st.classList.toggle('ok', p.accepted);
  $('#ap-start').disabled = !p.accepted; $('#ap-explain').disabled = p.accepted; $('#ap').readOnly = p.accepted;
}
// The mentor's review of the plan: one question at a time, or acceptance.
function planReply(r) {
  persist(); showPlanState();
  Mentor.say(r.question, r.accepted ? { kind: 'good', label: 'PLAN ACCEPTED' } : { label: 'QUESTION FOR YOU' });
}
function explainPlan() {
  if (!A?.approach || A.over || G.lock || A.approach.accepted) return;
  const r = explainApproach(A, $('#ap').value.trim(), chal().approach.rules);
  if (r) planReply(r);
}
function beginCoding() {
  if (G.lock || !startCoding(A)) return; // refused unless the plan was accepted
  persist(); renderCh(true);
}

// Starts a submission → token, or null while the card is busy, one is being judged, or the attempt is over.
const begin = () => G.lock ? null : beginSubmission(A);

// One judged submission → mistake diagnosis (language content) → shared heart rules → feedback.
// why() → the mentor's explanation, asked for only when it's shown (not for a repeated answer).
// error: the real runtime message, used as evidence · found: mistake tags from judging the behaviour.
function settle(tok, el, type, value, passed, why, error = '', found = []) {
  const d = passed ? {} : diagnose({ lang: A.lang, challenge: chal(), type, answer: value, error, found });
  const out = settleSubmission(A, tok, { key: answerKey(A, G.ci, type, value), passed, ...d });
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
  if (c.t === 'fill') return checkFill(inp, v, c, tok);
  const ok = c.ans.includes(v);
  if (ok) { inp.classList.remove('bad'); inp.classList.add('ok'); }
  else { inp.classList.add('bad'); inp.value = ''; A.view.drafts = { ...A.view.drafts, [G.ci]: '' }; wait(900).then(() => inp.classList.remove('bad')); }
  settle(tok, inp, 'blank', v, ok, () => Mentor.fetchText('wrong', { lang: S.lang, challenge: aiChal(c), answer: v }, c.wrong[v] || c.why));
}

// ── Behaviour-judged challenges (World 1): the code really runs, the challenge's checks judge what it did ──
const observe = (code, spec) => A.lang === 'py' ? observePython(code, spec) : observeJs(code, spec);
const plainName = s => String(s).replace(/`/g, '');
// The mentor's fallback when no mistake rule matched: point at the evidence, ask — never the fix.
function fallbackWhy(j) {
  if (j.error) return 'Read the **last line** of the error — it names the problem. Which word or symbol on that line looks different from what you meant?';
  const r = j.results.find(x => !x.pass);
  return r ? `"${plainName(r.name)}" expected **${r.expected}** but got **${r.actual}**. Work that case through by hand: what does your code produce, and why?` : 'Something isn\'t right yet. What did you expect to happen, and what happened instead?';
}
const failText = j => j.error || j.results.filter(r => !r.pass).map(r => `${plainName(r.name)}: expected ${r.expected}, got ${r.actual}`).join('; ');
// The runtime couldn't start (e.g. Python offline): nothing was judged, so nothing is recorded or charged.
function unavailable(tok) {
  cancelSubmission(A, tok);
  Mentor.say(A.lang === 'py' && pythonStatus() === 'loading' ? 'Python is still downloading (only the first time) — press RUN again in a moment. **No heart was used.**'
    : A.lang === 'py' ? 'Python couldn\'t start — check your internet connection and try again. **No heart was used.**' : 'The code runner couldn\'t start — try again. **No heart was used.**', { kind: 'fix', label: 'MENTOR' });
}

async function checkFill(inp, v, c, tok) {
  inp.disabled = true; $('#b-check').disabled = true;
  const code = fillCode(c, v);
  let obs;
  try { obs = await observe(code, c.observe); } catch (e) { obs = null; }
  if (!isCurrent(A, tok)) return; // left the vault while it ran
  inp.disabled = false; $('#b-check').disabled = false;
  if (!obs) return unavailable(tok);
  const j = judge(c, obs, { code, answer: v });
  if (j.passed) { inp.classList.remove('bad'); inp.classList.add('ok'); }
  else { inp.classList.add('bad'); inp.value = ''; A.view.drafts = { ...A.view.drafts, [G.ci]: '' }; wait(900).then(() => inp.classList.remove('bad')); }
  settle(tok, inp, 'blank', v, j.passed, () => Mentor.fetchText('wrong', { lang: S.lang, challenge: aiChal(c), answer: v, error: failText(j) }, j.why || fallbackWhy(j)), j.error, j.tags);
}

async function runCode() {
  const tok = begin(); if (!tok) return;
  const c = chal(), code = $('#ed').value, cons = $('#cons'), btn = $('#b-run'), head = `<span class="dim">$ ${cmd()}</span>`;
  btn.disabled = true; A.view.drafts = { ...A.view.drafts, [G.ci]: code };
  cons.innerHTML = head + '\n<span class="dim">running…</span>';
  let obs;
  try { [obs] = await Promise.all([observe(code, c.observe), wait(600)]); } catch (e) { obs = null; }
  if (!isCurrent(A, tok)) return; // left the vault while it ran
  btn.disabled = false;
  if (!obs) { cons.innerHTML = `${head}\n<span class="err">${A.lang === 'py' ? (pythonStatus() === 'loading' ? 'Python is still downloading (first time only)' : 'Python couldn\'t start (no connection?)') : 'The code runner couldn\'t start'} — no heart used.</span>`; return unavailable(tok); }
  const j = judge(c, obs, { code }), printed = [...(obs.logs ?? []), ...(obs.callLogs ?? [])];
  cons.innerHTML = `${head}\n${printed.length ? esc(printed.join('\n')) + '\n' : ''}${j.error ? `<span class="err">${esc(j.error)}</span>\n` : ''}` +
    j.results.map(r => r.pass ? `<span class="okl">✓ ${esc(plainName(r.name))}</span>` : `<span class="err">✗ ${esc(plainName(r.name))} — expected ${esc(r.expected)}, got ${esc(r.actual)}</span>`).join('\n');
  if (j.passed) { if (c.kind === 'fix') award('debug'); settle(tok, cons, 'code', code, true); return; }
  settle(tok, cons, 'code', code, false, () => Mentor.fetchText('wrong', { lang: S.lang, challenge: aiChal(c), answer: code, error: failText(j) }, j.why || fallbackWhy(j)), j.error, j.tags);
}

// ── Pro vault (older format): real output + structure checks ──
const regexFail = (c, code) => c.checks.find(k => (k.bad && k.bad.test(code)) || (k.need && !k.need.test(code)));
const outputOk = (out, ok) => out === ok || out.endsWith('\n' + ok);

// Runs the user's code for real (Pyodide worker / sandboxed JS worker). Falls back to regex checks
// if the runtime can't load. A run is a submission like any other: new failing code costs a heart,
// re-running code that already failed doesn't.
async function runFix() {
  const tok = begin(); if (!tok) return;
  const c = chal(), code = $('#ed').value, cons = $('#cons'), btn = $('#b-run'), head = `<span class="dim">$ ${cmd()}</span>`;
  btn.disabled = true; A.view.drafts = { ...A.view.drafts, [G.ci]: code };
  cons.innerHTML = head + '\n<span class="dim">running…</span>';
  let res;
  try { [res] = await Promise.all([S.lang === 'py' ? runPython(code) : runJsChallenge(code), wait(600)]); }
  catch (e) { res = null; }
  if (!isCurrent(A, tok)) return; // left or restarted the vault while the code ran
  // The runtime couldn't start: nothing ran, so nothing is shown as output, judged or charged.
  if (!res) { cons.innerHTML = `${head}\n<span class="err">${S.lang === 'py' ? (pythonStatus() === 'loading' ? 'Python is still downloading (first time only)' : 'Python couldn\'t start (no connection?)') : 'The code runner couldn\'t start'} — no heart used.</span>`; btn.disabled = false; return unavailable(tok); }
  const out = res.stdout.trim(), err = res.stderr.trim();
  const f = regexFail(c, code);
  if (!err && outputOk(out, c.ok) && !f) {
    cons.innerHTML = `${head}\n${esc(out)}\n<span class="okl">✓ All checks passed</span>`;
    award('debug'); settle(tok, cons, 'code', code, true); return;
  }
  const msg = err || (outputOk(out, c.ok) ? '✗ Right output, but the bug is still in the code' : `✗ Expected output: ${c.ok}`);
  cons.innerHTML = `${head}\n${out ? esc(out) + '\n' : ''}<span class="err">${esc(msg)}</span>`;
  btn.disabled = false;
  const fallback = f ? f.why : err ? 'Read the **last line** of the error — it names the problem. Which word or symbol on that line looks different from what Python/JS expects?' : `It runs, but prints \`${out.split('\n').pop() || 'nothing'}\` instead of \`${c.ok.split('\n').pop()}\`. Which line produces the output?`;
  settle(tok, cons, 'code', code, false, () => Mentor.fetchText('wrong', { lang: S.lang, challenge: aiChal(c), answer: code, error: err || `wrong output: ${out}` }, fallback), err);
}

async function correct(el, tok) {
  G.lock = true; const p = ctr(el); G.combo++;
  const gain = reward(rk(G.li, G.ci), chal().xp ?? 50 + (G.combo - 1) * 10, A.run); updHud(); // 0 on replay
  persist({ ci: G.ci + 1 }); // solved: a refresh during the pause continues with the next challenge
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
  if (out.duplicate) { persist(); return Mentor.say(DUPLICATE, { label: 'MENTOR' }); }
  G.mistakes++;
  shake($('#app'));
  anim($('#vign'), [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }], { duration: 800, fill: 'none' });
  loseHeart();
  if (out.exhausted) G.lock = true; // nothing more can be answered until Recovery
  persist(); // saved at once: a refresh with 0 hearts lands in Recovery
  await Mentor.say(why(), { kind: 'fix' });
  if (out.exhausted) outOfHearts(tok);
}

// Zero hearts — the single place this is handled, for every language: Syntax Recovery. Nothing happens
// if the player has left the vault in the meantime (the saved, locked attempt reopens in Recovery).
function outOfHearts(tok) {
  return whenExhausted(() => A, tok, {
    announce: () => Mentor.say(`Out of hearts. Your ${A.approach ? 'plan, ' : ''}answers, code and XP are saved — **Syntax Recovery** wins your hearts back.`, { kind: 'fix' }),
    pause: () => wait(1200),
    next: enterRecovery
  });
}

// Opens Syntax Recovery for the current (locked) attempt. Recovery never restarts the vault or takes XP:
// it ends by returning to the same challenge with three hearts.
function enterRecovery() {
  const a = A, L = LANGS[a.lang];
  startRecovery(a); persist();
  return openRecovery({
    attempt: a, lang: a.lang, langName: L.name, title: vaultName(a.lang, a.vault), challenge: G.ci, place: L.levels[a.vault].boss ? 'the Mini Boss' : null,
    save: () => { if (a === A) persist(); },
    leave: () => { if (a === A) leaveLevel(); },
    back: () => { if (a === A) startLevel(a.vault, { afterRecovery: true }); }
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
  const i = G.li, stars = G.mistakes <= 1 ? 3 : G.mistakes <= 3 ? 2 : 1, boss = !!lvl().boss;
  const free = freeOf(S.lang), wasDone = i < free ? i < S.done[S.lang] : !!S.stars[S.lang + i];
  const prevXp = S.xp, bonus = reward(rk(i, 'bonus'), lvl().bonusXp ?? 150 + i * 50 + stars * 30, A.run); // once per vault; better stars on replay pay nothing
  delete S.attempts[attemptKey(A.curriculum, i)]; endAttempt(A); // cracked: the attempt is finished
  S.stars[S.lang + i] = Math.max(S.stars[S.lang + i] || 0, stars);
  if (!wasDone && i < free) S.done[S.lang] = i + 1;
  save();
  // WORLD 1 CLEARED (the Mini Boss is the last FREE node): the next step is PRO — the upgrade for FREE
  // students, the project for PRO students — or back to the map.
  const proVault = roles(LANGS[S.lang]).proVault;
  const choice = await playVaultCinematic({ kick: boss ? 'MINI BOSS DEFEATED · WORLD 1' : `VAULT 0${i + 1} CRACKED`, title: boss ? 'WORLD 1 CLEARED' : 'UNLOCKED', stars, bonus, prevXp, lvBefore: lvlOf(prevXp), mistakes: G.mistakes, first: i === 0,
    actions: boss ? { next: S.pro ? `NEXT: PRO VAULT 0${proVault + 1}` : 'UNLOCK PRO', pro: true, alt: 'BACK TO THE MAP' } : null });
  if (boss) award('boss');
  if (G.mistakes === 0) award('clean');
  if (G.hints === 0) award('hintfree');
  if (S.done[S.lang] >= free) award('legend');
  save();
  // After World 1: the next step is the PRO Vault — on the map for PRO students, the checkout for FREE ones.
  if (boss && choice === 'next') { if (!S.pro) return openPro(); setSel(proVault); renderMap(); await go('s-map'); return; } // rendered first: no stale map during the fade
  // A PRO step done: the map highlights the next one (PRO Vault → Project → Final Boss).
  setSel(i >= free ? nextStep(S, S.lang, LANGS[S.lang]) : i); await go('s-map'); renderMap();
  if (!wasDone && i + 1 < free && rewindForTravel(i)) { await wait(500); await travel(i); }
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
    if (A && !A.over && A.approach && !A.approach.accepted) { const r = answerApproach(A, v, chal().approach.rules); if (r) return planReply(r); } // answers count toward the plan
    Mentor.ask('ask', { lang: S.lang, challenge: aiChal(chal()), question: v }, localAnswer(v), { label: 'MENTOR' });
  };
  $('#btn-hint').onclick = () => {
    if (!A || A.over || G.lock || inRecovery(A) || inPlanning(A)) return; // not while the card changes, the vault is locked, or while planning
    const c = chal(); if (G.hintIdx >= c.hints.length) return;
    const n = ++G.hintIdx; G.hints++; updHint(); persist(); // hints are always free
    Mentor.ask('hint', { lang: S.lang, challenge: aiChal(c), hintLevel: n }, c.hints[n - 1], { kind: 'hint', label: `HINT ${n}/3` });
  };
  $('#btn-explain').onclick = () => Mentor.ask('explain', { lang: S.lang, concept: lvl().concept, challenge: aiChal(chal()) }, lvl().concept, { label: 'CONCEPT' });
  $('#lv-back').onclick = leaveLevel;
  addEventListener('pagehide', flushDraft); // keep half-typed code across a refresh
}
