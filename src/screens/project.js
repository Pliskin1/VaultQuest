// PRO Workspace: brief + milestones, editor (app.js / game.py, read-only HTML/CSS tabs), RUN & TEST against
// behaviour checks, Live Preview, hearts + Syntax Recovery, Socratic mentor, SUBMIT → final review + ship.
// One controller for both languages: project rules come from learn/workspace.js (on the shared attempt
// engine); a language adapter only runs the code — JavaScript in sandboxed frames (run/project-js.js),
// Python in Pyodide (run/project-py.js). Everything is saved in the attempt, so leaving or refreshing
// returns to the same milestone with the same code, hearts and conversation.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { esc, md } from '../core/md.js';
import { hl } from '../core/highlight.js';
import { go } from '../core/router.js';
import { S, save, rk, reward, lvlOf } from '../core/state.js';
import { verifyForShip, shipRecord, upsertProject, finalText } from '../learn/ship.js';
import { newAttempt, attemptKey, beginSubmission, cancelSubmission, endAttempt, isCurrent, whenExhausted, inRecovery, startRecovery, fromSave, toSave, explainApproach, answerApproach, startCoding, inPlanning } from '../learn/attempt.js';
import { MAX_CHARS } from '../learn/approach.js';
import { canEnter, lockReason } from '../learn/unlock.js';
import { playVaultCinematic } from '../cine/vault.js';
import { judgeRun, runTags, settleRun, canSubmit, nextHint, logChat, markShipped, reviewPayload, scriptedFeedback, MAX_CODE } from '../learn/workspace.js';
import { updHud } from '../ui/hud.js';
import { award, floatText } from '../ui/toast.js';
import { Mentor } from '../ui/mentor.js';
import { LANGS } from '../content/languages.js';
import { runJsProject, cancelChecks, guarded, syntaxError, envOf } from '../run/project-js.js';
import { runPyProject } from '../run/project-py.js';
import { preloadPython, pythonStatus } from '../run/py-runner.js';
import { createPreview } from '../run/sandbox/preview.js';
import { seedOf } from '../run/seed.js';
import { playShipCinematic } from '../cine/ship.js';
import { openMap, openMapAt } from './map.js';
import { openProfile } from './profile.js';
import { openRecovery } from './recovery.js';
import { openBlueprint } from './blueprint.js';
import { openPro } from './pro.js';
import { mayBuild, waive, linkPlan, planForReview } from '../learn/blueprint.js';
import { fetchBoard } from '../ui/board.js';

// i: level index · a: the attempt (hearts, Recovery, workspace state) · code: app.js / game.py (the editor
// can show the read-only tabs instead) · judged: the last run's verdict · gained: XP this session.
export const PJ = { i: 0, lv: null, a: null, tab: 'code', code: '', judged: null, gained: 0, logs: [], shipping: false, lastShip: null };
const isPy = () => PJ.lv?.kind === 'py';
const RUNNERS = { js: { run: runJsProject, cancel: cancelChecks }, py: { run: runPyProject, cancel: () => {} } };
const HEART = '<path d="M13 22S2 15 2 8a5.5 5.5 0 0 1 11-1.5A5.5 5.5 0 0 1 24 8c0 7-11 14-11 14z"';
let preview = null;

const ws = () => PJ.a.workspace;
const focusMs = () => PJ.judged?.focus ?? Math.max(0, ws().cleared.indexOf(false));
const allCleared = () => ws().cleared.every(Boolean);
const hearts = () => PJ.a?.session.hearts ?? 3;

export function pjRefresh() {
  const ta = $('#pj-ta');
  if (PJ.tab === 'code') PJ.code = ta.value;
  $('#pj-hl').innerHTML = (PJ.tab === 'code' ? hl(ta.value, isPy() ? 'py' : 'js') : esc(ta.value)) + '\n';
  $('#pj-gut').innerHTML = Array.from({ length: ta.value.split('\n').length }, (_, k) => k + 1).join('<br>');
}

// ── loading and saving ──
// The saved attempt for project level i in the current language (hearts, workspace, Blueprint), or a new one.
// A project carries a Blueprint; the Final Boss an explain-first plan instead.
export function loadProject(i) {
  const lv = LANGS[S.lang].levels[i], cur = S.curriculum[S.lang], ids = lv.blueprint ? lv.blueprint.sections.map(x => x.id) : null, approach = !!lv.approach;
  const saved = fromSave(S.attempts[attemptKey(cur, i)], { lang: S.lang, vault: i, curriculum: cur, challenges: 1, workspace: lv.ms.length, blueprint: ids, approach });
  return { saved, a: saved || newAttempt(S.lang, i, cur, { workspace: lv.ms.length, ...(ids ? { blueprint: ids } : {}), approach }) };
}
export function saveProject(a) { if (a && !a.over) { S.attempts[attemptKey(a.curriculum, a.vault)] = toSave(a); save(); } }
// Shipped before (in this language, any curriculum — also the old text-only portfolio entries).
const shippedBefore = (lv, lang) => (S.projects || []).some(p => (typeof p === 'string' ? p : p.title) === lv.title && (typeof p === 'string' ? 'js' : p.lang) === lang);

function persist() {
  const a = PJ.a;
  if (!a || a.over) return;
  a.view = { ...a.view, drafts: { ...a.view.drafts, 0: PJ.code } };
  S.attempts[attemptKey(a.curriculum, a.vault)] = toSave(a); save();
}
let draftTimer = null;
function keepDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(flushDraft, 300); }
function flushDraft() {
  clearTimeout(draftTimer); draftTimer = null;
  const savedPlan = PJ.a ? S.attempts[attemptKey(PJ.a.curriculum, PJ.a.vault)]?.approach?.text : undefined;
  if (PJ.a && !PJ.a.over && (PJ.a.view.drafts[0] !== PJ.code || (PJ.a.approach && PJ.a.approach.text !== savedPlan))) persist();
}
// Stops everything still running for this workspace: pending check frames and the live preview.
function stopRuns() { RUNNERS.js.cancel(); preview?.clear(); }

// ── rendering ──
function renderMs() {
  const w = ws(), now = w.cleared.indexOf(false), lv = PJ.lv;
  $('#pj-ms').innerHTML = lv.ms.map((m, k) => {
    const total = lv.checks.filter(c => c.ms === k).length, rs = w.results.filter(r => r.ms === k);
    const tally = rs.length ? `${rs.filter(r => r.pass).length}/${total} checks passing` : `${total} checks`;
    return `<li class="${w.cleared[k] ? 'ok' : k === now ? 'now' : ''}"><span class="mn">${w.cleared[k] ? '✓' : k + 1}</span><div><b>${esc(m.n)}</b><span>${esc(m.d)}</span><em>${tally}</em></div></li>`;
  }).join('');
  $('#pj-segs').innerHTML = w.cleared.map((p, k) => `<i class="${p ? 'on' : k === now ? 'now' : ''}"></i>`).join('');
}
const heartSvg = on => on ? `<svg viewBox="0 0 26 24">${HEART} fill="#FF9B7A"/></svg>` : `<svg viewBox="0 0 26 24">${HEART} fill="none" stroke="#3A4256" stroke-width="2"/></svg>`;
function renderHearts() {
  $('#pj-hearts').innerHTML = [0, 1, 2].map(k => `<div class="heart" aria-hidden="true">${heartSvg(k < hearts())}</div>`).join('');
  $('#pj-hearts').setAttribute('aria-label', hearts() + ' hearts left');
}
function loseHeart() {
  const left = hearts(), h = $$('#pj-hearts .heart')[left]; if (!h) return; const p = ctr(h);
  h.innerHTML = `${heartSvg(false)}<svg class="hl" viewBox="0 0 26 24" style="clip-path:inset(0 50% 0 0)">${HEART} fill="#FF9B7A"/></svg><svg class="hr" viewBox="0 0 26 24" style="clip-path:inset(0 0 0 50%)">${HEART} fill="#FF9B7A"/></svg>`;
  anim(h.querySelector('.hl'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(-10px,26px) rotate(-35deg)', opacity: 0 }], { duration: 800, easing: EASE.in });
  anim(h.querySelector('.hr'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(10px,26px) rotate(35deg)', opacity: 0 }], { duration: 800, easing: EASE.in });
  FX.spark(p.x, p.y, 18, '#FF9B7A', .5);
  $('#pj-hearts').setAttribute('aria-label', left + ' hearts left');
}
const errLine = e => `${e.name}${e.line ? ` (line ${e.line})` : ''}: ${e.message}`;
// The console after a run (or the saved last run): one line per milestone, the failing checks under it.
function renderConsole(run = null) {
  const lv = PJ.lv, w = ws(), cons = $('#pj-cons'), head = `<span class="dim">$ ${lv.cmd}</span>`;
  const checks = run?.checks ?? w.results, error = run ? run.error : w.error, timeout = run ? run.timeout : w.timeout;
  if (!checks.length && !error && !timeout) { cons.innerHTML = `${head}   <span class="dim">— press RUN &amp; TEST to run ${lv.checks.length} checks on your milestones</span>`; return; }
  const out = [head];
  if (error) out.push(`<span class="err">${esc(errLine(error))}</span>`);
  if (timeout) out.push('<span class="err">Stopped: the code never finished (infinite loop?) — the app stayed responsive.</span>');
  lv.ms.forEach((m, k) => {
    const cs = checks.filter(c => c.ms === k), ok = cs.filter(c => c.pass).length;
    out.push(`<span class="${ok === cs.length ? 'okl' : 'err'}">${ok === cs.length ? '✓' : '✗'} ${esc(m.n)} — ${ok}/${cs.length} checks</span>`);
    cs.filter(c => !c.pass).slice(0, 3).forEach(c => {
      const exp = c.expected ?? c.exp, act = c.actual ?? c.act;
      out.push(`<span class="dim">    ✗ ${esc(c.msg)}${exp != null ? ` · expected ${esc(String(exp))}, got ${esc(String(act ?? 'nothing'))}` : ''}</span>`);
    });
  });
  if (!isPy() && PJ.logs.length) out.push('<span class="dim">— console.log —</span>', ...PJ.logs.slice(-8).map(l => esc(l)));
  cons.innerHTML = out.join('\n');
}
const term = html => { const a = $('#pv-app'); a.className = 'pv-app term'; a.innerHTML = html; };
function renderTerminal(src) {
  const out = [`<span class="dim">$ python ${esc(PJ.lv.file)}</span>`];
  if (src.output) out.push(esc(src.output.replace(/\n$/, '')));
  if (src.error) out.push(`<span class="err">${esc(errLine(src.error))}</span>`);
  if (src.timeout) out.push('<span class="err">Stopped: the program ran too long (infinite loop?)</span>');
  if (out.length === 1) out.push('<span class="dim">Press RUN &amp; TEST to play your game.</span>');
  term(out.join('\n'));
}
const pvErr = text => { const e = $('#pv-err'); e.textContent = text || ''; e.classList.toggle('on', !!text); };
// JavaScript: a fresh sandboxed frame with the app. Code that doesn't parse (or can't be guarded) isn't run.
function showPreview(code) {
  const box = $('#pv-app'); box.className = 'pv-app frame'; pvErr(''); PJ.logs = [];
  const bad = syntaxError(code);
  if (bad) { preview.clear(); return pvErr(`SyntaxError: ${bad} — fix it, then RUN & TEST.`); }
  const safe = guarded(code);
  if (!safe) { preview.clear(); return pvErr('This code could not be prepared for a safe run, so the preview is paused. Try simplifying the line you changed last.'); }
  preview.show(envOf(PJ.lv), safe, PJ.lv.preview);
}
function updSubmit() {
  const s = $('#pj-submit'), on = !!PJ.a && !PJ.a.over && canSubmit(PJ.a, PJ.code);
  if (on === (s.style.display !== 'none')) return;
  s.style.display = on ? 'inline-flex' : 'none';
}
function updHint() {
  const b = $('#pj-hint');
  if (!PJ.a || allCleared()) { b.style.display = 'none'; return; }
  const k = focusMs(), n = ws().hints[k] ?? 0, max = PJ.lv.ms[k].hints?.length ?? 0;
  b.style.display = max ? '' : 'none';
  b.textContent = n >= max ? 'No hints left' : n === 0 ? 'Hint · free' : `Hint ${n + 1}/${max} · free`;
  b.disabled = n >= max;
}
function setTab(t) {
  const ta = $('#pj-ta');
  if (PJ.tab === 'code' && t !== 'code') PJ.code = ta.value;
  PJ.tab = t;
  $$('.pj-tabs [data-tab]').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  const bp = t === 'blueprint';
  $('#pj-bpv').style.display = bp ? '' : 'none'; $('#pj-edw').style.display = bp ? 'none' : '';
  $('.pj-tabs').classList.toggle('ro', t !== 'code');
  if (bp) { renderPlan(); return; }
  ta.readOnly = t !== 'code';
  ta.value = t === 'code' ? PJ.code : PJ.lv.files?.[t] ?? '';
  $('#pj-edw').scrollTop = 0;
  pjRefresh();
}

// MY BLUEPRINT: the student's own five sections, read-only, while they code.
function renderPlan() {
  const bp = PJ.a.blueprint, spec = PJ.lv.blueprint;
  if (!spec) { const ap = PJ.a.approach; $('#pj-bpv').innerHTML = `<section><h4>MY PLAN <span>${ap?.accepted ? 'ACCEPTED' : 'IN PROGRESS'}</span></h4><p>${esc(ap?.text || '—')}</p>${ap?.answers?.length ? `<p class="bp-ans"><b>Your answers to the mentor:</b> ${ap.answers.map(esc).join(' · ')}</p>` : ''}</section>`; return; }
  $('#pj-bpv').innerHTML = !bp.started ? '<p class="bp-note">This project was shipped before Blueprints existed, so there is no saved plan for it.</p>'
    : spec.sections.map(sec => { const x = bp.sections[sec.id]; return `<section><h4>${esc(sec.title)} <span class="${x.status === 'kept' ? 'kept' : ''}">${x.status === 'kept' ? 'KEPT AS WRITTEN' : 'CLEAR'}</span></h4><p>${esc(x.accepted ?? x.draft)}</p>${x.answers.length ? `<p class="bp-ans"><b>Your answers to the mentor:</b> ${x.answers.map(esc).join(' · ')}</p>` : ''}</section>`; }).join('');
}

// ── Final Boss: plan first (the Mini Boss's explain-first engine, learn/approach.js) ──
// Until the plan is accepted and coding started, the editor is replaced by the plan card and nothing can run
// (attempt.js beginSubmission refuses). Explaining is free.
function renderPlanGate() {
  const a = PJ.a, ap = PJ.lv.approach, planning = !!ap && inPlanning(a);
  $('#pj-plan').style.display = planning ? '' : 'none';
  if (planning) { $('#pj-edw').style.display = 'none'; $('#pj-bpv').style.display = 'none'; }
  else if (PJ.tab !== 'blueprint') $('#pj-edw').style.display = '';
  $('#pj-run').disabled = planning; $('#pj-hint').style.display = planning ? 'none' : $('#pj-hint').style.display;
  $$('.pj-tabs [data-tab]').forEach(b => { b.disabled = planning; });
  if (!planning) return;
  $('#pj-plan-q').textContent = ap.prompt;
  if ($('#pj-ap').value !== a.approach.text) $('#pj-ap').value = a.approach.text;
  $('#pj-code').disabled = !a.approach.accepted;
  $('#pj-explain').disabled = a.approach.accepted;
  $('#pj-plan-st').textContent = a.approach.accepted ? 'Plan accepted — start coding when you are ready' : 'Explaining is free — no hearts';
}
const planReply = r => r.accepted ? PJ.lv.approach.accepted : r.rule === 'short' ? PJ.lv.approach.short : r.question;
function explainPlan() {
  const a = PJ.a; if (!a || a.over || !PJ.lv.approach || !inPlanning(a) || a.approach.accepted) return;
  const r = explainApproach(a, $('#pj-ap').value, PJ.lv.approach.rules);
  if (!r) return;
  persist(); renderPlanGate();
  say(planReply(r), { kind: r.accepted ? 'good' : 'hint', label: r.accepted ? 'PLAN ACCEPTED' : 'FINAL BOSS · PLAN' });
}
function startBossCoding() {
  const a = PJ.a; if (!a || a.over || !startCoding(a)) return;
  persist(); renderPlanGate(); setTab('code');
  say(`Coding is unlocked. Four milestones, ${PJ.lv.checks.length} checks — and your plan is under **MY PLAN**.`, { label: 'MENTOR' }, false);
}

// Mentor messages are saved with the attempt (unless `log` is false: greetings, status notes).
function say(text, o = {}, log = true) {
  const a = PJ.a;
  const p = Promise.resolve(text).then(t => {
    const r = t && typeof t === 'object' ? t : { text: t };
    if (log && a && a === PJ.a && !a.over) { logChat(a, { w: 'm', text: r.text, label: r.label ?? o.label, kind: r.kind ?? o.kind }); persist(); }
    return r;
  });
  return Mentor.say(p, o);
}
// AI replies keep their label; the scripted fallback says so.
const labelled = (p, label, kind) => p.then(r => ({ text: r.text, label: r.ai ? label : `${label} · SCRIPTED`, ...(kind ? { kind } : {}) }));

// ── open ──
// Opens the project. A saved attempt resumes exactly (code, milestones, hearts, conversation); a locked one
// goes straight to Syntax Recovery.
// The single way into a PRO project: PRO first (mock checkout), then the Blueprint, then the workspace.
// shipped: opened from the portfolio — a project shipped before Blueprints existed opens without one.
export function startProject(i, { afterRecovery = false, shipped = false } = {}) {
  flushDraft(); stopRuns(); endAttempt(PJ.a); Mentor.cancel();
  const L = LANGS[S.lang], lv = L.levels[i], n = lv.ms.length, boss = lv.t === 'final', historical = !boss && shipped && shippedBefore(lv, S.lang);
  // The order of World 1 is enforced here too (learn/unlock.js) — not only on the map.
  if (!historical && !canEnter(S, S.lang, L, i)) { Mentor.use('lv'); return S.pro ? openMapAt(i) : openPro(); }
  const { a } = loadProject(i);
  if (a.blueprint && !mayBuild(a.blueprint)) {
    if (!historical && !a.workspace.shipped) return openBlueprint(i, a);
    waive(a.blueprint); saveProject(a);
  }
  Mentor.use('pj');
  Object.assign(PJ, { i, lv, a, tab: 'code', code: a.view.drafts[0] ?? lv.starter, judged: null, gained: 0, logs: [] });
  const py = isPy(), w = ws();
  $('#pj-kick').textContent = `${boss ? 'FINAL BOSS' : 'PRO PROJECT'} · ${L.name.toUpperCase()}`;
  $('#pj-bptab').textContent = boss ? 'MY PLAN' : 'MY BLUEPRINT';
  $('#pj-submit').textContent = boss ? 'DEFEAT THE FINAL BOSS' : 'SUBMIT PROJECT';
  $('#pj-file').textContent = lv.file;
  $$('.pj-xtab').forEach(t => { t.style.display = lv.files ? '' : 'none'; });
  $('#pv-url').textContent = lv.url;
  $('#pj-name').textContent = lv.title; $('#pj-brief').innerHTML = md(lv.brief);
  $('#pj-count').textContent = `${lv.checks.length} automated checks`;
  setTab('code'); renderMs(); renderHearts(); renderConsole(); updSubmit(); updHint(); renderPlanGate();
  if (py) { renderTerminal(w); pvErr(''); preloadPython(); } else showPreview(PJ.code);
  $('#pj-msgs').innerHTML = ''; Mentor.restore(w.chat); updHud();
  if (inRecovery(a)) return enterRecovery(); // refreshing or reopening never skips Recovery
  const now = w.cleared.indexOf(false), h = hearts(), file = `**${lv.file}**`, first = !w.runs && !w.chat.length && !w.results.length;
  const plan = a.blueprint?.started ? ' Your plan is one click away under **MY BLUEPRINT**.' : boss && a.approach?.started ? ' Your plan is under **MY PLAN**.' : '';
  const welcome = boss && inPlanning(a) ? `**Final Boss: ${lv.title}.** ${a.approach.text ? 'Your plan so far is saved — keep explaining it.' : 'Explain your plan first — I\'ll ask about anything missing. The editor unlocks once your plan is complete.'}`
    : boss && w.shipped ? `You've already beaten this Final Boss. Replay it as much as you like — it won't pay XP twice.`
    : afterRecovery ? `**Syntax Recovery complete** · 3 hearts restored. You're back on **${lv.ms[Math.max(0, now)].n}** — your code is exactly as you left it.`
    : w.shipped ? `This is your shipped **${lv.title}**. ${py ? 'Run it to play' : 'Try it in the preview'} — you can keep improving it (it won't pay XP twice).`
    : !first && now === -1 ? `Welcome back. Every milestone is cleared — run the checks once more on your current code, then **SUBMIT**.`
    : !first ? `Welcome back to **${lv.title}**. You're on milestone ${now + 1}: **${lv.ms[now].n}**, with ${h} heart${h === 1 ? '' : 's'}. Your code${w.chat.length ? ' and our conversation are' : ' is'} saved.${plan}`
    : `Project time. You write ${file}: ${n} milestones on the left, ${lv.checks.length} automated checks. I review every run. A run that makes no progress costs a heart; running the same code again is free.${plan}`;
  say(welcome, afterRecovery ? { kind: 'good', label: 'SYNTAX RECOVERY' } : { label: 'MENTOR' }, false); // queued first: replies to early clicks follow it
  go('s-project');
}

// Leaving ends the attempt object: a run or reply still pending is ignored. The saved state stays.
function leaveProject() { flushDraft(); stopRuns(); endAttempt(PJ.a); Mentor.cancel(); Mentor.use('lv'); openMap(); }

// ── RUN & TEST ──
const SAME = 'Same code as your last try, so **no heart lost** — and the result won\'t change. What will you try differently?';
const SAME_PASS = 'Same code as before — still passing every check. Try it in the preview, then **SUBMIT** when you\'re happy.';

// Code over the workspace limit is never run, saved or shipped in part — the student is told instead.
const TOO_LONG = () => `Your ${PJ.lv.file} is longer than ${MAX_CODE.toLocaleString('en')} characters, so I can't run or ship it. Shorten it a little and try again — nothing was recorded.`;

async function run() {
  const a = PJ.a, lv = PJ.lv;
  if (!a || a.over || inRecovery(a)) return;
  if (PJ.tab !== 'code') setTab('code');
  if (PJ.code.length > MAX_CODE) return say(TOO_LONG(), { kind: 'fix', label: 'MENTOR' }, false);
  flushDraft();
  const tok = beginSubmission(a); // null while a run is in progress: rapid clicks are one run
  if (!tok) return;
  const b = $('#pj-run'), code = PJ.code;
  b.disabled = true;
  const loading = a.lang === 'py' && pythonStatus() !== 'ready';
  $('#pj-cons').innerHTML = `<span class="dim">$ ${lv.cmd}</span>\n<span class="dim">${loading ? 'loading Python — the first run downloads it and needs internet… then ' : ''}running ${lv.checks.length} checks…</span>`;
  anim($('.pv'), [{ boxShadow: '0 0 0 0 rgba(79,216,196,0)' }, { boxShadow: '0 0 0 3px rgba(79,216,196,.75), 0 0 40px rgba(79,216,196,.35)' }, { boxShadow: '0 0 0 0 rgba(79,216,196,0)' }], { duration: 900, fill: 'none' });
  const stale = () => !isCurrent(PJ.a, tok);
  const [res] = await Promise.all([RUNNERS[a.lang].run(code, lv, { seed: seedOf(code), isStale: stale }), wait(550)]);
  if (stale()) return; // left the workspace (or it was reopened) meanwhile: nothing is recorded
  b.disabled = false;
  if (res.cancelled || res.unavailable || res.unsafe) {
    cancelSubmission(a, tok); renderConsole();
    if (res.unavailable && pythonStatus() === 'loading') { term('<span class="dim">Python is still downloading (first time only)…</span>'); return say('Python is still downloading — only the first time. Nothing was run and **nothing was recorded**; press RUN & TEST again in a moment.', { label: 'MENTOR' }, false); }
    if (res.unavailable) { term('<span class="err">Python couldn\'t load — it needs an internet connection the first time.</span>'); return say('Python couldn\'t start, so nothing was run and **nothing was recorded**. Check your connection and press RUN & TEST again.', { label: 'MENTOR' }, false); }
    if (res.unsafe) return say('I couldn\'t prepare this code for a safe run, so nothing was run and **nothing was recorded**. Try simplifying the line you changed last.', { label: 'MENTOR' }, false);
    return;
  }
  const prev = ws().results;
  const judged = judgeRun(ws(), res, lv.ms.length);
  const out = settleRun(a, tok, { code, run: res, judged, tags: runTags(a.lang, res, judged), starter: lv.starter });
  if (!out) return;
  PJ.judged = judged;
  renderMs(); renderConsole(res); updSubmit(); updHint();
  if (a.lang === 'py') renderTerminal(res); else showPreview(code);
  let gained = false;
  judged.newly.forEach(k => {
    const li = $$('#pj-ms li')[k], c = ctr(li.querySelector('.mn'));
    FX.spark(c.x, c.y, 34, null, .6); FX.ring(c.x, c.y, 90, '#4FD8C4', 3);
    anim(li, [{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 450, fill: 'none' });
    const xp = reward(rk(PJ.i, 'm' + k), 50); // once per milestone — also across restarts, replays and shipping
    if (xp) { PJ.gained += xp; gained = true; floatText('+' + xp + ' XP', c.x + 90, c.y); }
  });
  if (gained) updHud();
  persist(); // saved at once: a refresh right now keeps hearts, milestones and Recovery
  if (out.duplicate) return say(judged.allPass ? SAME_PASS : SAME, { label: 'MENTOR' });
  if (out.heartLost) { loseHeart(); anim($('#vign'), [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }], { duration: 800, fill: 'none' }); }
  if (judged.allPass) {
    const s = $('#pj-submit'); anim(s, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: EASE.back, fill: 'none' });
    const c = ctr(s); FX.spark(c.x, c.y, 30, '#C9B8FF', .6);
    return say(`All ${lv.ms.length} milestones pass — ${lv.checks.length}/${lv.checks.length} checks. ${isPy() ? 'Check the output in the terminal' : 'Try your app in the preview'}, then ${lv.t === 'final' ? 'press **DEFEAT THE FINAL BOSS** — every check runs once more before it counts' : 'submit it for the full code review'}.`, { kind: 'good', label: 'CODE REVIEW' });
  }
  const again = c => prev.some(r => r.id === c?.id && !r.pass);
  // When the mistake contradicts the student's own plan, the question points back at that part of it.
  const link = linkPlan(a.blueprint, lv.blueprint, [...(res.timeout ? ['loop-timeout'] : []), ...judged.focusFailed.flatMap(c => c.tags ?? [])]);
  const socratic = scriptedFeedback({ lv, judged, run: res, errorAsk: lv.errorAsk, again: again(judged.focusFailed[0]), plan: link });
  let fallback = socratic, kind = 'fix';
  if (judged.newly.length) {
    const k = judged.newly[judged.newly.length - 1], next = judged.current;
    fallback = `**${lv.ms[k].n}** ✓ ${lv.ms[k].alt ?? ''}${next >= 0 ? ` Next: **${lv.ms[next].n}**. ${lv.ms[next].hints?.[0] ?? ''}` : ''}`;
    kind = 'good';
  } else if (judged.better) fallback = `More checks pass than before — **no heart lost**. ${socratic}`;
  const review = Mentor.review({ ...reviewPayload({ lang: a.lang, lv, judged, run: res, code, a }), plan: planForReview(a.blueprint, lv.blueprint), planHint: link?.question ?? null }, fallback);
  await say(labelled(review, 'CODE REVIEW', kind), { kind, label: 'CODE REVIEW' });
  if (out.exhausted) outOfHearts(tok);
}

// Zero hearts: Syntax Recovery, as in the vaults — nothing happens if the student left meanwhile.
function outOfHearts(tok) {
  return whenExhausted(() => PJ.a, tok, {
    announce: () => say('Out of hearts. Your code, milestones and XP are saved — **Syntax Recovery** wins your hearts back.', { kind: 'fix' }, false),
    pause: () => wait(1200),
    next: enterRecovery
  });
}
function enterRecovery() {
  const a = PJ.a, L = LANGS[a.lang], title = PJ.lv.title;
  stopRuns(); startRecovery(a); persist();
  return openRecovery({
    attempt: a, lang: a.lang, langName: L.name, title: `Pro project · ${title}`, challenge: 0, place: `the ${title} project`,
    save: () => { if (a === PJ.a) persist(); },
    leave: () => { if (a === PJ.a) leaveProject(); },
    back: () => { if (a === PJ.a) startProject(a.vault, { afterRecovery: true }); }
  });
}

// ── SUBMIT ──
// SUBMIT: a fresh verification run of the exact code being submitted — every check must pass again (a
// stale or forged "passed" state can't ship anything). Only then the final review, the portfolio record,
// XP and the achievement, all saved before the celebration plays (a refresh during it keeps the ship).
async function submit() {
  const a = PJ.a, lv = PJ.lv, s = $('#pj-submit');
  if (s.disabled || PJ.shipping || !a || a.over || !canSubmit(a, PJ.code)) return;
  if (PJ.code.length > MAX_CODE) return say(TOO_LONG(), { kind: 'fix', label: 'MENTOR' }, false);
  const tok = beginSubmission(a); // also blocks RUN & TEST while verifying
  if (!tok) return;
  PJ.shipping = true; s.disabled = true; $('#pj-run').disabled = true;
  const code = PJ.code, stale = () => a !== PJ.a || a.over;
  $('#pj-cons').innerHTML = `<span class="dim">$ ${lv.cmd}</span>\n<span class="dim">final verification before shipping — running all ${lv.checks.length} checks again…</span>`;
  const res = await RUNNERS[a.lang].run(code, lv, { seed: seedOf(code), isStale: stale });
  cancelSubmission(a, tok); // verification is not an attempt: no hearts, nothing recorded
  const done = () => { PJ.shipping = false; s.disabled = false; $('#pj-run').disabled = false; };
  if (stale()) { PJ.shipping = false; return; }
  const v = verifyForShip(lv, res);
  if (!v.ok) {
    done();
    if (res.unavailable) return say(pythonStatus() === 'loading' ? 'Python is still downloading, so nothing could be verified and **nothing was shipped** yet. Press SUBMIT again in a moment.' : 'Python couldn\'t start, so nothing could be verified and **nothing was shipped**. Check your connection and press SUBMIT again.', { label: 'MENTOR' }, false);
    renderConsole(res.checks ? res : null);
    a.workspace = { ...a.workspace, passKey: null }; persist(); updSubmit();
    return say(`**Not shipped.** On the final verification ${v.passed}/${v.total} checks pass${v.reason === 'timeout' ? ' — the code never finished' : v.reason === 'error' ? ' — the code stopped with an error' : ''}. Fix what the console shows, run the checks, then submit again.`, { kind: 'fix', label: 'FINAL REVIEW' });
  }
  const fb = finalText({ lv, verify: v, a });
  const r = Mentor.review({ ...reviewPayload({ lang: a.lang, lv, code, a, final: true }), plan: planForReview(a.blueprint, lv.blueprint) }, fb, null);
  await say(labelled(r, 'FINAL REVIEW', 'good'), { kind: 'good', label: 'FINAL REVIEW' });
  const review = await r;
  await wait(900);
  if (stale()) { PJ.shipping = false; return; } // left during the review: not shipped
  if (lv.t === 'final') return winBoss(a, done);
  const rec = shipRecord({ lv, lang: a.lang, curriculum: a.curriculum, a, code, run: res, verify: v, review });
  S.projects = upsertProject(S.projects, rec); // re-shipping replaces this project's record — never a duplicate
  PJ.gained += reward(rk(PJ.i, 'ship'), 300); // once per project, ever
  award('builder'); // once per profile
  S.stars[S.lang + PJ.i] = 3; markShipped(a); persist(); fetchBoard();
  PJ.lastShip = rec;
  endAttempt(a);
  await playShipCinematic({ xp: PJ.gained, title: lv.title, lang: LANGS[a.lang].name, milestones: rec.milestones, checks: rec.checks, review: rec.review?.score ?? null }); // flies a copy of the live preview
  PJ.shipping = false; done();
  stopRuns(); $('#s-holder').innerHTML = ''; // no app frame keeps running behind the profile
  updHud(); Mentor.use('lv'); openProfile();
}

// The Final Boss beaten (after the same fresh verification run as shipping). Completion, XP and the
// achievement are saved BEFORE the celebration plays, so a refresh during it loses nothing; beating it
// again pays nothing (reward keys) and never lowers the stars.
async function winBoss(a, done) {
  const lv = PJ.lv, i = PJ.i, prevXp = S.xp - PJ.gained, h = a.session.hearts, stars = h >= 3 ? 3 : h === 2 ? 2 : 1;
  const xp = reward(rk(i, 'win'), 300); PJ.gained += xp;
  S.stars[S.lang + i] = Math.max(S.stars[S.lang + i] || 0, stars);
  award('master');
  markShipped(a); persist(); save(); fetchBoard();
  endAttempt(a);
  await playVaultCinematic({ kick: 'FINAL BOSS DEFEATED · WORLD 1', title: 'WORLD 1 MASTERED', stars, bonus: PJ.gained, prevXp, lvBefore: lvlOf(prevXp), mistakes: 3 - h, first: false, actions: { next: 'BACK TO THE MAP', pro: true } });
  PJ.shipping = false; done();
  stopRuns(); updHud(); Mentor.use('lv'); openMapAt(i);
}

// ── hints and questions (free) ──
function hint() {
  const a = PJ.a;
  if (!a || a.over || inRecovery(a) || allCleared()) return;
  const k = focusMs(), h = nextHint(a, k, PJ.lv.ms[k].hints ?? []);
  if (!h) return;
  persist(); updHint();
  say(h.text, { kind: 'hint', label: `HINT ${h.level}/${PJ.lv.ms[k].hints.length} · ${PJ.lv.ms[k].n.toUpperCase()}` });
}

// Scripted answers: a short pointer and one question back — never the code.
function localAnswer(v) {
  const s = v.toLowerCase(), py = isPy(), k = focusMs(), lv = PJ.lv;
  if (/\b(answer|solution|solve it|full code|write it|give me the code|just tell)\b/.test(s)) return `I won't write it for you — but let's get there. ${lv.ms[k].hints?.[0] ?? 'What should happen first?'}`;
  if (py) return /return|none/.test(s) ? 'A function without `return` gives back `None`. Which paths through your function end without one?'
    : /loop|for|while|count/.test(s) ? 'Walk the guesses one at a time and keep a counter. At which guess should the loop stop?'
    : /if|elif|else|compare/.test(s) ? '`if` / `elif` / `else` let one function answer in three ways. With guess 3 and secret 7, which branch should run?'
    : `Look at the first red check in the console. What did it expect — and what did your function return?`;
  return /innerhtml/.test(s) ? '`innerHTML = …` replaces everything inside an element. When you add one task, what should happen to the ones already there?'
    : /append|createelement/.test(s) ? '`document.createElement("li")` makes an element; `appendChild` puts it on the page. Where does its text come from?'
    : /click|onclick|event|listener/.test(s) ? 'A click handler is a function the browser calls on every click. Which element should own it — and what should it change?'
    : /done|class|toggle/.test(s) ? '`classList.toggle("done")` flips a class. Where else should the task remember that it is done, so a redraw keeps it?'
    : /count|left/.test(s) ? 'Which tasks count as “left”? And after which actions does #count need to be written again?'
    : `Look at the first red check in the console. What does it expect the page to do — and what does yours do?`;
}
function context() {
  const w = ws(), k = focusMs(), lv = PJ.lv, failed = w.results.filter(r => !r.pass && r.ms === k).slice(0, 3);
  return [`milestone ${k + 1} "${lv.ms[k].n}": ${lv.ms[k].d}`, failed.length ? `failing checks: ${failed.map(r => r.msg).join('; ')}` : 'no failing checks on this milestone in the last run',
    w.error ? `last error: ${errLine(w.error)}` : '', `hearts: ${hearts()}`].filter(Boolean).join('\n');
}

// Drives the live preview (the ?demo=pro recording): see run/sandbox/preview.js act().
export const previewAct = cmd => preview?.act(cmd) ?? Promise.resolve(null);

export function mount() {
  const ta = $('#pj-ta');
  preview = createPreview($('#pv-app'), {
    error: (e, loop) => { if (!PJ.a || PJ.a.over) return; pvErr(loop ? 'Stopped: your code kept running without a break. The page is still usable — check your loops.' : `${errLine(e)}`); },
    log: line => { PJ.logs.push(line); if (PJ.logs.length > 60) PJ.logs.shift(); }
  });
  ta.maxLength = MAX_CODE; // typing and pasting stop at the limit; RUN and SUBMIT refuse anything longer
  ta.oninput = () => { pjRefresh(); if (PJ.tab === 'code') { keepDraft(); updSubmit(); } };
  ta.onkeydown = e => {
    if (e.key !== 'Tab' || ta.readOnly) return;
    e.preventDefault(); const n = isPy() ? 4 : 2, st = ta.selectionStart;
    ta.value = ta.value.slice(0, st) + ' '.repeat(n) + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = st + n; ta.oninput();
  };
  $$('.pj-tabs [data-tab]').forEach(b => { b.onclick = () => { if (PJ.lv && b.dataset.tab !== PJ.tab) setTab(b.dataset.tab); }; });
  $('#pj-back').onclick = leaveProject;
  $('#pj-run').onclick = run;
  $('#pj-submit').onclick = submit;
  $('#pj-hint').onclick = hint;
  $('#pj-explain').onclick = explainPlan;
  $('#pj-code').onclick = startBossCoding;
  $('#pj-ap').oninput = () => { const a = PJ.a; if (a && !a.over && a.approach && !a.approach.accepted) { a.approach = { ...a.approach, text: $('#pj-ap').value.slice(0, MAX_CHARS) }; keepDraft(); } };
  $('#pj-form').onsubmit = e => {
    e.preventDefault(); const i = $('#pj-in'), v = i.value.trim(), a = PJ.a; if (!v || !a || a.over) return;
    i.value = ''; Mentor.user(v); logChat(a, { w: 'u', text: v }); S.questions++; award('curious'); persist();
    if (PJ.lv.approach && inPlanning(a) && !a.approach.accepted) { // an answer to the mentor's question counts toward the plan
      const r = answerApproach(a, v, PJ.lv.approach.rules); persist(); renderPlanGate();
      return say(planReply(r), { kind: r.accepted ? 'good' : 'hint', label: r.accepted ? 'PLAN ACCEPTED' : 'FINAL BOSS · PLAN' });
    }
    const k = focusMs(), lv = PJ.lv;
    const reply = Mentor.fetchReply('ask', { lang: a.lang, challenge: { type: 'project', q: `${lv.title} — milestone ${k + 1}: ${lv.ms[k].n}. ${lv.ms[k].d}`, code: PJ.code.slice(0, 4000) }, question: v, context: context() }, localAnswer(v));
    say(labelled(reply, 'MENTOR'), { label: 'MENTOR' });
  };
  // There is no hosted deployment, so the honest thing to share is the shipped code itself.
  $('#s-share').onclick = () => { if (!PJ.lastShip) return; navigator.clipboard?.writeText(PJ.lastShip.code).catch(() => {}); $('#s-share').textContent = 'CODE COPIED ✓'; };
  addEventListener('pagehide', flushDraft); // keep half-typed code across a refresh
}
