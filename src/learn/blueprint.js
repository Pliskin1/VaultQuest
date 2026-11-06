// Project Blueprint — the plan a student writes before a PRO project, one engine for every language.
// Five sections (content/blueprints/*.js: features, data, logic, ui ↔ data, steps). The student writes each
// section in their own words; "Ask mentor" reviews it:
//   empty → nothing to review · too short / keyword list → "say more" · nothing about this project → "unrelated"
//   a gap (a project rule that applies and isn't resolved) → one follow-up question · no gap → accepted.
// Answers to a follow-up resolve that rule only if they actually answer it (rule.resolves). Nothing is accepted
// because the student replied, and the mentor never writes the plan.
// Escape hatch: after two rounds of feedback on the same open question, when the text has real substance
// (it passed the relevance check and only a project rule is open), the student may keep their answer — so imperfect rules
// can't trap anyone, while empty or meaningless text never passes.
// Gate: building starts only when every section is accepted or kept (startBuilding; attempt.js refuses runs
// before that). Pure apart from the blueprint object it's given.

export const MAX_TEXT = 1500, MAX_ANSWERS = 8, MAX_CHAT = 60, ESCAPE_ROUNDS = 2, MIN_WORDS = 6;

const words = s => String(s ?? '').match(/[\p{L}\p{N}_']+/gu) || [];
// Small words real sentences contain and keyword lists don't.
const GLUE = new Set(['the', 'a', 'an', 'and', 'then', 'if', 'it', 'its', 'each', 'every', 'of', 'to', 'i', 'we', 'will', 'that', 'which', 'when', 'with', 'is', 'are', 'in', 'for', 'from', 'at', 'by', 'how', 'so', 'my', 'them', 'they', 'can', 'should', 'be', 'on', 'or', 'as', 'this', 'what', 'there', 'until', 'after', 'before', 'once', 'has', 'have', 'do', 'does', 'one', 'all', 'their', 'his', 'her', 'user', 'player', 'someone']);
const sentences = s => String(s ?? '').split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean);

export const newSection = () => ({ draft: '', accepted: null, doneAs: null, status: 'empty', rule: null, question: null, resolved: [], answers: [], rounds: 0, asked: {}, revisions: 0 });
export const newBlueprint = ids => ({ current: 0, started: false, waived: false, rewarded: false, sections: Object.fromEntries(ids.map(id => [id, newSection()])), chat: [] });

// Status shown for a section: empty · draft (written, not reviewed yet) · incomplete (the mentor asked
// something) · accepted · kept (escape hatch) · changed (edited after being accepted or kept).
export const STATUS_LABEL = { empty: 'Not started', draft: 'Ready for review', incomplete: 'Mentor has a question', accepted: 'Clear', kept: 'Kept as written', changed: 'Changed — ask again' };
export const isDone = s => s.status === 'accepted' || s.status === 'kept';

// The text a section is judged on: what the student wrote plus their answers to the mentor's questions.
const ctxOf = (bp, id) => {
  const s = bp.sections[id], answers = s.answers.join('\n');
  const plan = Object.values(bp.sections).map(x => [x.draft, ...x.answers].join('\n')).join('\n');
  return { own: s.draft, answers, text: `${s.draft}\n${answers}`, plan, resolved: s.resolved };
};

// Draft typed in the editor. Editing a finished section reopens it ("changed") until it is reviewed again;
// typing it back exactly as it was accepted restores it.
export function setDraft(bp, id, text) {
  if (!bp || bp.started || !bp.sections[id]) return false;
  const s = bp.sections[id], t = String(text ?? '').slice(0, MAX_TEXT);
  if (t === s.draft) return false;
  const finished = s.doneAs && s.accepted !== null;
  const status = !t.trim() ? 'empty' : finished ? (t === s.accepted ? s.doneAs : 'changed') : s.status === 'incomplete' ? 'incomplete' : 'draft';
  bp.sections[id] = { ...s, draft: t, status };
  return true;
}

function judge(bp, spec, id) {
  const sec = spec.sections.find(x => x.id === id), c = ctxOf(bp, id);
  if (!c.own.trim()) return { verdict: 'empty' };
  const w = words(c.text), glue = words(c.text).filter(x => GLUE.has(x.toLowerCase())).length;
  if (w.length < MIN_WORDS || glue < 2) return { verdict: 'short', rule: `${id}-short`, question: `There isn't enough in your **${sec.title}** section for me to tell what you mean yet. Say it in a sentence or two, in your own words: ${sec.question}` };
  if (!sec.vocab.test(c.text)) return { verdict: 'unrelated', rule: `${id}-unrelated`, question: `I can't find the ${spec.project} in this answer yet. ${sec.question}` };
  const gap = sec.rules.find(r => !c.resolved.includes(r.id) && r.applies(c));
  if (gap) return { verdict: 'gap', rule: gap.id, gap };
  return { verdict: 'accepted' };
}

// Phrases the question so the same one is never repeated word for word.
function phrase(s, j) {
  const n = (s.asked[j.rule] ?? 0) + 1;
  const base = j.gap ? j.gap.question : j.question;
  if (n === 1) return base;
  if (n === 2) return `Let me ask it another way. ${j.gap?.retry ?? base}`;
  return `I've asked about this twice already. If you think your plan covers it, say how in a sentence — or keep your answer and move on. ${j.gap?.retry ?? base}`;
}

function apply(bp, spec, id, lead = '') {
  const s = bp.sections[id], j = judge(bp, spec, id), sec = spec.sections.find(x => x.id === id);
  if (j.verdict === 'empty') return { verdict: 'empty', text: `Write your **${sec.title}** in your own words first — then I'll read it.` };
  if (j.verdict === 'accepted') {
    bp.sections[id] = { ...s, status: 'accepted', doneAs: 'accepted', accepted: s.draft, rule: null, question: null, revisions: s.accepted !== null && s.accepted !== s.draft ? s.revisions + 1 : s.revisions };
    return { verdict: 'accepted', text: `${lead}${sec.accept}`, done: canBuild(bp, spec) };
  }
  const q = phrase(s, j);
  bp.sections[id] = { ...s, status: 'incomplete', doneAs: null, rule: j.rule, question: q, rounds: s.rounds + 1, asked: { ...s.asked, [j.rule]: (s.asked[j.rule] ?? 0) + 1 } };
  return { verdict: j.verdict, rule: j.rule, text: `${lead}${q}`, escape: canKeep(bp, id) };
}

// "Ask mentor about this" → { verdict, text, rule?, escape?, done? } (null if the blueprint can't change).
// Asking again without changing the text or answering costs nothing and counts no round (so the escape
// hatch can't be reached by clicking twice).
export function reviewSection(bp, spec, id) {
  if (!bp || bp.started || !bp.sections[id]) return null;
  const s = bp.sections[id], seen = `${s.draft}\u0000${s.answers.length}`;
  if (s.status === 'incomplete' && s.seen === seen && s.question) return { verdict: 'same', rule: s.rule, text: `Your answer hasn't changed since my question, so my question still stands — revise your text or answer me in the chat. ${s.question}`, escape: canKeep(bp, id) };
  const r = apply(bp, spec, id);
  if (bp.sections[id].status === 'incomplete') bp.sections[id] = { ...bp.sections[id], seen: `${bp.sections[id].draft}\u0000${bp.sections[id].answers.length}` };
  return r;
}

// A chat reply to the section's open question → same shape. It counts only if it really answers the rule.
export function answerSection(bp, spec, id, answer) {
  if (!bp || bp.started || !bp.sections[id]) return null;
  const s = bp.sections[id], a = String(answer ?? '').trim().slice(0, 300);
  if (!a) return null;
  const sec = spec.sections.find(x => x.id === id), rule = sec.rules.find(r => r.id === s.rule);
  const answers = [...s.answers, a].slice(-MAX_ANSWERS);
  if (rule) {
    if (rule.resolves(a, ctxOf(bp, id))) {
      bp.sections[id] = { ...s, answers, resolved: [...s.resolved, rule.id] };
      return mark(bp, id, apply(bp, spec, id, `${rule.ack} `));
    }
    bp.sections[id] = { ...s, answers };
    return mark(bp, id, apply(bp, spec, id, 'I\'m not sure that answers it yet. '));
  }
  // No rule open (or "say more" / "unrelated"): the answer is more of their explanation.
  bp.sections[id] = { ...s, answers };
  return mark(bp, id, apply(bp, spec, id));
}
const mark = (bp, id, r) => { const x = bp.sections[id]; if (x.status === 'incomplete') bp.sections[id] = { ...x, seen: `${x.draft}\u0000${x.answers.length}` }; return r; };

// Escape hatch: the same open question has had two rounds of feedback, and the text has substance (only a
// project rule is open — "too short" and "unrelated" never count).
export function canKeep(bp, id) {
  const s = bp?.sections[id];
  return !!s && !bp.started && s.status === 'incomplete' && !!s.rule && !/-(short|unrelated)$/.test(s.rule) && (s.asked[s.rule] ?? 0) >= ESCAPE_ROUNDS;
}
export function keepSection(bp, spec, id) {
  if (!canKeep(bp, id)) return false;
  const s = bp.sections[id];
  bp.sections[id] = { ...s, status: 'kept', doneAs: 'kept', accepted: s.draft, question: null };
  return true;
}

export const canBuild = (bp, spec) => !!bp && spec.sections.every(sec => isDone(bp.sections[sec.id]));
// The gate itself: building starts only from a complete plan.
export function startBuilding(bp, spec) {
  if (!canBuild(bp, spec) || bp.started) return false;
  bp.started = true;
  return true;
}
// A project shipped before Blueprints existed opens without one.
export function waive(bp) { if (bp && !bp.started) bp.waived = true; }
export const mayBuild = bp => !!bp && (bp.started || bp.waived);

export function logBp(bp, entry) {
  if (!bp) return;
  const e = { w: entry.w === 'u' ? 'u' : 'm', text: String(entry.text ?? '').slice(0, 1500), ...(entry.label ? { label: String(entry.label).slice(0, 40) } : {}), ...(entry.kind ? { kind: String(entry.kind).slice(0, 10) } : {}), ...(entry.section ? { section: String(entry.section).slice(0, 20) } : {}) };
  bp.chat = [...bp.chat, e].slice(-MAX_CHAT);
}

// The student's own sentence in a section (or in their answers to the mentor about it) that matches `re` —
// an exact quote, never invented. null if none.
export function planQuote(bp, id, re) {
  const s = bp?.sections[id];
  if (!s) return null;
  const hit = [...sentences(s.accepted ?? s.draft), ...s.answers.flatMap(sentences)].find(x => re.test(x));
  if (!hit) return null;
  return hit.length > 160 ? hit.slice(0, 157).replace(/\s+\S*$/, '') + '…' : hit;
}

// For a failed run: the part of the student's plan that this mistake contradicts → { section, title, quote,
// question } or null. spec.links: [{ tags, section, mentions, ask(quote), askNoQuote }].
export function linkPlan(bp, spec, tags) {
  if (!bp?.started || !spec?.links) return null;
  for (const l of spec.links) {
    if (!l.tags.some(t => tags.includes(t))) continue;
    const s = bp.sections[l.section];
    if (!s || !(s.accepted ?? s.draft).trim()) continue;
    const title = spec.sections.find(x => x.id === l.section).title, quote = planQuote(bp, l.section, l.mentions);
    return { section: l.section, title, quote, question: quote ? l.ask(quote) : l.askNoQuote };
  }
  return null;
}

// The plan as the AI reviewer sees it (the accepted text and the student's answers, trimmed).
export const planForReview = (bp, spec) => !bp?.started ? null : Object.fromEntries(spec.sections.map(sec => { const x = bp.sections[sec.id]; return [sec.title, [x.accepted ?? x.draft, ...x.answers].join(' ').slice(0, 300)]; }));

// ── saving ──
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const STATUSES = new Set(['empty', 'draft', 'incomplete', 'accepted', 'kept', 'changed']);
function cleanSection(s) {
  if (!isObj(s)) return newSection();
  const draft = str(s.draft, MAX_TEXT), accepted = typeof s.accepted === 'string' ? s.accepted.slice(0, MAX_TEXT) : null;
  let status = STATUSES.has(s.status) ? s.status : draft.trim() ? 'draft' : 'empty';
  // A finished section must match the text it was accepted with; anything else needs a new review.
  if ((status === 'accepted' || status === 'kept') && (accepted === null || accepted !== draft || s.doneAs !== status)) status = draft.trim() ? 'changed' : 'empty';
  if (!draft.trim()) status = 'empty';
  const asked = isObj(s.asked) ? Object.fromEntries(Object.entries(s.asked).filter(([k, v]) => typeof k === 'string' && Number.isInteger(v) && v > 0).slice(0, 40)) : {};
  const doneAs = (s.doneAs === 'accepted' || s.doneAs === 'kept') && accepted !== null ? s.doneAs : null;
  if (status === 'changed' && !doneAs) status = 'draft';
  const seen = typeof s.seen === 'string' && status === 'incomplete' ? s.seen.slice(0, MAX_TEXT + 20) : undefined;
  return { ...(seen ? { seen } : {}), draft, accepted, doneAs, status, rule: typeof s.rule === 'string' && status === 'incomplete' ? s.rule.slice(0, 40) : null, question: status === 'incomplete' ? str(s.question, 600) || null : null,
    resolved: Array.isArray(s.resolved) ? s.resolved.filter(x => typeof x === 'string').slice(0, 40) : [], answers: Array.isArray(s.answers) ? s.answers.filter(x => typeof x === 'string').map(x => x.slice(0, 300)).slice(-MAX_ANSWERS) : [],
    rounds: Number.isInteger(s.rounds) && s.rounds >= 0 ? Math.min(s.rounds, 1e4) : 0, asked, revisions: Number.isInteger(s.revisions) && s.revisions >= 0 ? s.revisions : 0 };
}
// Restores a saved blueprint for these section ids. A started blueprint stays started only if its plan
// really is complete (a damaged save can't skip the gate); `waived` (shipped before Blueprints) is kept.
export function cleanBlueprint(raw, ids) {
  if (!isObj(raw)) return newBlueprint(ids);
  const sections = Object.fromEntries(ids.map(id => [id, cleanSection(raw.sections?.[id])]));
  const complete = ids.every(id => isDone(sections[id]));
  const chat = (Array.isArray(raw.chat) ? raw.chat : []).filter(c => isObj(c) && typeof c.text === 'string').slice(-MAX_CHAT)
    .map(c => ({ w: c.w === 'u' ? 'u' : 'm', text: c.text.slice(0, 1500), ...(typeof c.label === 'string' ? { label: c.label.slice(0, 40) } : {}), ...(typeof c.kind === 'string' ? { kind: c.kind.slice(0, 10) } : {}), ...(typeof c.section === 'string' ? { section: c.section.slice(0, 20) } : {}) }));
  const current = Number.isInteger(raw.current) && raw.current >= 0 && raw.current < ids.length ? raw.current : 0;
  return { current, started: raw.started === true && complete, waived: raw.waived === true, rewarded: raw.rewarded === true, sections, chat };
}
