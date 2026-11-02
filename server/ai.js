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
    b.question && `learner asks: ${s(b.question, 500)}`
  ].filter(Boolean);
  return complete(MENTOR, lines.join('\n'), 220);
}

export async function review(b) {
  const failing = Array.isArray(b.failing) ? b.failing.slice(0, 4).map(f => `milestone ${f.milestone}: ${s(f.message, 200)}`).join('\n') : '';
  const user = [`project: ${s(b.project, 80)} (${s(b.lang, 4)})`, `milestones: ${(b.milestones || []).map(m => s(m, 80)).join(' | ')}`, `final=${!!b.final}`, failing ? `failing tests:\n${failing}` : 'all tests pass', `code:\n${s(b.code)}`].join('\n');
  const text = await complete(REVIEWER, user, 350);
  const m = text.match(/Final review:\s*(\d{1,3})\s*\/\s*100/i);
  return { text, score: m ? Math.min(100, +m[1]) : null };
}
