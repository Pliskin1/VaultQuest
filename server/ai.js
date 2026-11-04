import Anthropic from '@anthropic-ai/sdk';
import { MENTOR, REVIEWER } from './prompts.js';

const MODEL = 'claude-haiku-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
export const hasKey = () => !!client;

const s = (v, n = 4000) => (typeof v === 'string' ? v : '').slice(0, n);

async function complete(system, user, max_tokens) {
  const req = { model: MODEL, max_tokens, temperature: 0.3, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }] };
  const opts = { timeout: 5500, maxRetries: 0 };
  let r;
  try { r = await client.messages.create(req, opts); }
  catch (e) {
    // Some models reject sampling params; retry once without temperature.
    if (e?.status === 400 && /temperature/i.test(e.message)) { delete req.temperature; r = await client.messages.create(req, opts); }
    else throw e;
  }
  const text = r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!text) throw new Error('empty response');
  return text;
}

export function mentor(b) {
  const c = b.challenge || {};
  const lines = [
    `mode=${s(b.mode, 10)}`, `lang=${s(b.lang, 4)}`,
    c.type && `challenge type: ${s(c.type, 10)}`, c.q && `task: ${s(c.q, 500)}`, c.code && `code:\n${s(c.code)}`,
    b.answer && `learner's answer/code:\n${s(b.answer)}`, b.error && `error output:\n${s(b.error, 1000)}`,
    b.hintLevel && `hintLevel=${Number(b.hintLevel) || 1}`, b.concept && `concept: ${s(b.concept, 800)}`,
    b.question && `learner asks: ${s(b.question, 500)}`, b.context && `project context:\n${s(b.context, 800)}`
  ].filter(Boolean);
  return complete(MENTOR, lines.join('\n'), 220);
}

export async function review(b) {
  const failing = Array.isArray(b.failing) ? b.failing.slice(0, 6).map(f => `milestone ${Number(f?.milestone) || '?'}: ${s(f?.message, 200)}${f?.expected ? ` — expected ${s(f.expected, 120)}, got ${s(f.actual, 120) || 'nothing'}` : ''}`).join('\n') : '';
  const m = b.milestone && typeof b.milestone === 'object' ? `milestone in focus: ${Number(b.milestone.n) || '?'} "${s(b.milestone.name, 60)}" — ${s(b.milestone.goal, 160)}` : null;
  const user = [`project: ${s(b.project, 80)} (${s(b.lang, 4)})`, `milestones: ${(Array.isArray(b.milestones) ? b.milestones : []).slice(0, 8).map(x => s(x, 80)).join(' | ')}`, m, `final=${!!b.final}`, `runs so far: ${Number(b.runs) || 0}`,
    b.error && `error: ${s(b.error, 300)}`, failing ? `failing checks:\n${failing}` : 'all checks pass', `code:\n${s(b.code)}`].filter(Boolean).join('\n');
  const text = await complete(REVIEWER, user, 350);
  const sc = text.match(/Final review:\s*(\d{1,3})\s*\/\s*100/i);
  return { text, score: sc ? Math.min(100, +sc[1]) : null };
}
