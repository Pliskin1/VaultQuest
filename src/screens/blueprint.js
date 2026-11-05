// Project Blueprint screen: five sections the student writes in their own words before a PRO project. One
// screen for both languages — the rules come from the project's content (content/blueprints/*.js), the
// verdicts from learn/blueprint.js. The mentor's wording may come from the AI; whether a section is clear is
// always decided by the rules, so nothing is accepted by an AI saying so. The plan is saved in the project's
// attempt (like the workspace), so refreshing, leaving or switching language resumes it exactly.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { FX } from '../core/fx.js';
import { esc, md } from '../core/md.js';
import { go } from '../core/router.js';
import { S, rk, reward } from '../core/state.js';
import { endAttempt } from '../learn/attempt.js';
import { setDraft, reviewSection, answerSection, keepSection, canKeep, canBuild, startBuilding, isDone, logBp, STATUS_LABEL } from '../learn/blueprint.js';
import { updHud } from '../ui/hud.js';
import { floatText } from '../ui/toast.js';
import { Mentor } from '../ui/mentor.js';
import { LANGS } from '../content/languages.js';
import { openMap } from './map.js';
import { openPro } from './pro.js';
import { startProject, loadProject, saveProject } from './project.js';

// i: project level · a: its attempt (the Blueprint lives in a.blueprint) · busy: a review is on its way.
export const BP = { i: 0, lv: null, spec: null, a: null, busy: false };
const bp = () => BP.a.blueprint;
const ids = () => BP.spec.sections.map(x => x.id);
const cur = () => BP.spec.sections[bp().current];
const live = a => a && a === BP.a && !a.over;
const BP_XP = 50;

function persist() { if (live(BP.a)) saveProject(BP.a); }
let draftTimer = null;
function flushDraft() { clearTimeout(draftTimer); draftTimer = null; if (live(BP.a) && setDraft(bp(), cur().id, $('#bp-ed').value)) persist(); }

// Opens the Blueprint of project level i (attempt: already loaded by the workspace, or loaded here).
export function openBlueprint(i, attempt = null) {
  flushDraft(); if (BP.a && BP.a !== attempt) endAttempt(BP.a); Mentor.cancel();
  if (!S.pro) return openPro({ next: () => startProject(i) });
  const L = LANGS[S.lang], lv = L.levels[i];
  Object.assign(BP, { i, lv, spec: lv.blueprint, a: attempt || loadProject(i).a, busy: false });
  if (bp().started || bp().waived) return startProject(i); // nothing left to plan
  Mentor.use('bp');
  $('#bp-kick').textContent = `PRO PROJECT · ${L.name.toUpperCase()}`;
  $('#bp-name').textContent = `${lv.title} · Blueprint`;
  $('#bp-brief').innerHTML = md(BP.spec.brief);
  $('#bp-msgs').innerHTML = ''; Mentor.restore(bp().chat);
  renderAll(); updHud();
  const first = !bp().chat.length && ids().every(id => !bp().sections[id].draft);
  const welcome = first ? `Before any code: your **Blueprint**. Five short sections, in your own words — start with **${cur().title}**. I'll read each one and ask about anything missing, but I won't write it for you.`
    : `Welcome back to your Blueprint. ${clearCount()} of 5 sections are clear — you're on **${cur().title}**, and everything you wrote is saved.`;
  Mentor.say(welcome, { label: 'MENTOR' }); // queued first: replies to early clicks follow it
  go('s-blueprint');
}

const clearCount = () => ids().filter(id => isDone(bp().sections[id])).length;

// ── rendering ──
function renderAll() { renderList(); renderSection(); renderGate(); }
function renderList() {
  const b = bp();
  $('#bp-list').innerHTML = BP.spec.sections.map((sec, k) => {
    const s = b.sections[sec.id], cls = isDone(s) ? 'ok' : s.status === 'incomplete' || s.status === 'changed' ? 'q' : '';
    return `<li class="${cls} ${k === b.current ? 'on' : ''}"><button data-k="${k}" aria-current="${k === b.current ? 'step' : 'false'}"><span class="mn">${isDone(s) ? '✓' : k + 1}</span><span><b>${esc(sec.title)}</b><em>${STATUS_LABEL[s.status]}</em></span></button></li>`;
  }).join('');
  $$('#bp-list button').forEach(btn => { btn.onclick = () => go2(+btn.dataset.k); });
  $('#bp-segs').innerHTML = BP.spec.sections.map((sec, k) => `<i class="${isDone(b.sections[sec.id]) ? 'on' : k === b.current ? 'now' : ''}"></i>`).join('');
  $('#bp-clear').textContent = `${clearCount()} / 5 clear`;
}
function renderSection() {
  const b = bp(), k = b.current, sec = cur(), s = b.sections[sec.id], ed = $('#bp-ed');
  $('#bp-sk').textContent = `SECTION ${k + 1} OF 5 · ${sec.title.toUpperCase()}`;
  $('#bp-title').textContent = sec.title; $('#bp-purpose').textContent = sec.purpose;
  $('#bp-q').textContent = sec.question;
  if (ed.value !== s.draft) ed.value = s.draft;
  $('#bp-open').innerHTML = s.status === 'incomplete' && s.question ? `<span class="lab">YOUR MENTOR ASKS</span><p>${md(s.question)}</p>` : '';
  renderStatus();
  $('#bp-prev').disabled = k === 0; $('#bp-next').disabled = k === BP.spec.sections.length - 1;
}
function renderStatus() {
  const s = bp().sections[cur().id], st = $('#bp-status'), len = $('#bp-ed').value.length;
  st.textContent = STATUS_LABEL[s.status]; st.className = 'bp-st ' + (isDone(s) ? 'ok' : s.status === 'incomplete' ? 'q' : s.status === 'changed' ? 'ch' : '');
  $('#bp-chars').textContent = `${len} / 1500`;
  $('#bp-ask').disabled = BP.busy || !$('#bp-ed').value.trim() || isDone(s);
  $('#bp-ask').textContent = s.status === 'changed' ? 'ASK MENTOR AGAIN' : 'ASK MENTOR ABOUT THIS';
  $('#bp-keep').style.display = canKeep(bp(), cur().id) ? '' : 'none';
  $('#bp-in').placeholder = s.status === 'incomplete' ? 'Answer the mentor\'s question…' : 'Ask about this section…';
}
function renderGate() {
  const ok = canBuild(bp(), BP.spec);
  $('#bp-start').disabled = !ok;
  $('#bp-gate').textContent = ok ? 'Your plan is complete. Time to build it.' : `${5 - clearCount()} section${5 - clearCount() === 1 ? '' : 's'} still need${5 - clearCount() === 1 ? 's' : ''} to be clear.`;
}
function go2(k) {
  if (!live(BP.a) || k < 0 || k >= BP.spec.sections.length || k === bp().current) return;
  flushDraft(); bp().current = k; persist(); renderAll();
  anim($('#bp-card'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE.out, fill: 'none' });
  $('#bp-ed').focus();
}

// ── mentor ──
// Says a reply and saves it with the plan. The AI may only re-word the rules' verdict (labelled · SCRIPTED
// when the scripted text is used); a reply that arrives after the student left is dropped.
function say(textOrReply, o, section) {
  const a = BP.a;
  const p = Promise.resolve(textOrReply).then(r => {
    const x = r && typeof r === 'object' ? r : { text: r };
    if (live(a)) { logBp(bp(), { w: 'm', text: x.text, label: x.label ?? o.label, kind: x.kind ?? o.kind, section }); persist(); }
    return x;
  });
  return Mentor.say(p, o);
}
const worded = (r, sec, text) => Mentor.fetchReply('blueprint', {
  lang: S.lang, challenge: { type: 'blueprint', q: `${BP.lv.title} — ${sec.title}: ${sec.question}` }, answer: text.slice(0, 1500),
  context: r.verdict === 'accepted' ? 'verdict: accepted. Praise in one sentence what this section already covers. Add no new requirements.'
    : `verdict: ${r.verdict}. The plan is missing something. Ask exactly this follow-up (you may re-word it, keep its meaning, one question only, no answer): ${r.text}`
}, r.text).then(x => ({ text: x.text, label: `BLUEPRINT${x.ai ? '' : ' · SCRIPTED'}`, kind: r.verdict === 'accepted' ? 'good' : 'hint' }));

async function ask() {
  const a = BP.a, sec = cur();
  if (!live(a) || BP.busy || bp().started) return;
  flushDraft();
  const r = reviewSection(bp(), BP.spec, sec.id);
  if (!r) return;
  persist(); renderAll();
  if (r.verdict === 'empty') return say(r.text, { label: 'BLUEPRINT' }, sec.id);
  BP.busy = true; renderStatus();
  const s = bp().sections[sec.id];
  await say(worded(r, sec, [s.draft, ...s.answers].join('\n')), { label: 'BLUEPRINT', kind: r.verdict === 'accepted' ? 'good' : 'hint' }, sec.id);
  if (!live(a)) return;
  BP.busy = false; renderStatus();
  afterVerdict(r, sec);
}
function afterVerdict(r, sec) {
  if (r.verdict === 'accepted') {
    const li = $$('#bp-list li')[BP.spec.sections.indexOf(sec)];
    if (li) { const c = ctr(li.querySelector('.mn')); FX.spark(c.x, c.y, 24, '#4FD8C4', .5); FX.ring(c.x, c.y, 70, '#4FD8C4', 2); }
    if (r.done) say('Every part of your plan is clear. **START BUILDING** is unlocked — your Blueprint stays with you in the workspace.', { kind: 'good', label: 'BLUEPRINT' });
    else { const next = BP.spec.sections.findIndex(x => !isDone(bp().sections[x.id])); if (next >= 0 && next !== bp().current) setTimeout(() => go2(next), 900); }
  } else if (r.escape) say('You\'ve worked on this section through two rounds of questions. If you\'re sure it says what you mean, you can **keep your answer** and move on — or answer my question.', { label: 'BLUEPRINT' });
}

// A chat message: an answer to the section's open question, or a question to the mentor.
async function chat(text) {
  const a = BP.a, sec = cur(), s = bp().sections[sec.id];
  if (!live(a) || BP.busy || bp().started) return;
  Mentor.user(text); logBp(bp(), { w: 'u', text, section: sec.id }); persist();
  if (s.status === 'incomplete' || (!isDone(s) && s.draft.trim())) {
    flushDraft();
    const r = answerSection(bp(), BP.spec, sec.id, text);
    if (!r) return;
    persist(); renderAll();
    BP.busy = true; renderStatus();
    const now = bp().sections[sec.id];
    await say(worded(r, sec, [now.draft, ...now.answers].join('\n')), { label: 'BLUEPRINT', kind: r.verdict === 'accepted' ? 'good' : 'hint' }, sec.id);
    if (!live(a)) return;
    BP.busy = false; renderStatus(); afterVerdict(r, sec);
    return;
  }
  const fallback = /\b(answer|write it|do it for me|example|solution|give me)\b/i.test(text)
    ? `I won't write your plan — it has to be your thinking. Try one sentence for this: ${sec.question}`
    : `Good question. Think about it from the user's side first. ${sec.question}`;
  BP.busy = true;
  await say(Mentor.fetchReply('ask', { lang: S.lang, challenge: { type: 'blueprint', q: `${BP.lv.title} — ${sec.title}: ${sec.question}` }, question: text, context: 'The learner is planning, not coding. Never write their plan or any code; ask one guiding question.' }, fallback)
    .then(x => ({ text: x.text, label: `MENTOR${x.ai ? '' : ' · SCRIPTED'}` })), { label: 'MENTOR' }, sec.id);
  if (live(a)) BP.busy = false;
}

function keep() {
  const sec = cur();
  if (!live(BP.a) || !keepSection(bp(), BP.spec, sec.id)) return;
  persist(); renderAll();
  say(`Kept as written. Your **${sec.title}** stays exactly as you wrote it — you can see it any time under MY BLUEPRINT while you build.`, { label: 'BLUEPRINT' }, sec.id);
  const next = BP.spec.sections.findIndex(x => !isDone(bp().sections[x.id]));
  if (next >= 0) setTimeout(() => go2(next), 900);
  else say('Every part of your plan is done. **START BUILDING** is unlocked.', { kind: 'good', label: 'BLUEPRINT' });
}

// START BUILDING: only a complete plan starts the workspace (learn/blueprint.js startBuilding is the gate).
function start() {
  const a = BP.a, b = $('#bp-start');
  if (!live(a) || BP.busy) return;
  flushDraft();
  if (!startBuilding(bp(), BP.spec)) { renderGate(); return; }
  if (!bp().rewarded) {
    const xp = reward(rk(BP.i, 'bp'), BP_XP); // once per project, ever
    bp().rewarded = true;
    if (xp) { const c = ctr(b); floatText('+' + xp + ' XP', c.x, c.y - 30); FX.spark(c.x, c.y, 30, '#C9B8FF', .6); updHud(); }
  }
  persist();
  anim(b, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 400, fill: 'none' });
  Mentor.cancel(); endAttempt(a);
  setTimeout(() => startProject(BP.i), 500);
}

function leave() { flushDraft(); Mentor.cancel(); if (BP.a) endAttempt(BP.a); Mentor.use('lv'); openMap(); }

export function mount() {
  const ed = $('#bp-ed');
  ed.oninput = () => {
    if (!live(BP.a)) return;
    const s = bp().sections[cur().id];
    clearTimeout(draftTimer); draftTimer = setTimeout(flushDraft, 300);
    // editing a finished section shows "changed" at once (saved shortly after typing stops)
    if ((isDone(s) || s.status === 'changed') && setDraft(bp(), cur().id, ed.value)) { persist(); renderList(); renderGate(); }
    renderStatus();
  };
  $('#bp-ask').onclick = ask;
  $('#bp-keep').onclick = keep;
  $('#bp-start').onclick = start;
  $('#bp-prev').onclick = () => live(BP.a) && go2(bp().current - 1);
  $('#bp-next').onclick = () => live(BP.a) && go2(bp().current + 1);
  $('#bp-back').onclick = leave;
  $('#bp-form').onsubmit = e => { e.preventDefault(); const i = $('#bp-in'), v = i.value.trim(); if (!v || BP.busy) return; i.value = ''; chat(v.slice(0, 300)); };
  addEventListener('pagehide', flushDraft);
}
