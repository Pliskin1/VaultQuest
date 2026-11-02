// Server-side fallback. The client sends its own content-based fallback text; we echo it so the
// response shape is identical with or without a key. Generic text only if the client sent none.
const GENERIC = {
  wrong: 'Not quite. Compare what you expected with what the code actually does — which part behaves differently?',
  hint: 'Re-read the task and the code line by line. Which single symbol or word looks out of place?',
  explain: 'Break the concept into one tiny example, run it in your head, and watch how the value changes.',
  ask: 'Let\'s reason it out together: what do you expect this code to do, and where could reality differ?',
  review: 'Run the checks, then fix the first failing milestone — one step at a time.'
};

export const mentorFallback = b => ({ text: (typeof b.fallback === 'string' && b.fallback) || GENERIC[b.mode] || GENERIC.ask, source: 'fallback' });
export const reviewFallback = b => ({ text: (typeof b.fallback === 'string' && b.fallback) || GENERIC.review, score: Number.isFinite(b.fallbackScore) ? b.fallbackScore : null, source: 'fallback' });
