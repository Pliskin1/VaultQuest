// Behaviour-based judging — one function for every language. The language runner only observes
// (run/js-observe.js, run/py-observe.js); the challenge content decides with its `checks`, and its `mistakes`
// name what went wrong, so any correct solution passes and no test code ever runs in the student's sandbox.
//  challenge.checks:   [{ id, name, test(obs) → { pass, expected, actual } }]
//  challenge.mistakes: [{ tag, when({ code, answer, obs, error }) → bool, why }]  (first match = main mistake)
export const BLANK = '___';
export const fillCode = (challenge, answer) => challenge.code.replace(BLANK, answer);

// → { passed, results, error, tags, why } (why: the content's question for the main mistake, if any).
export function judge(challenge, obs, { code, answer = null }) {
  if (obs.timedOut) {
    const error = 'Timeout: the code kept running and was stopped (an endless loop?)';
    return { passed: false, error, tags: ['loop-timeout'], why: null, results: challenge.checks.map(c => ({ id: c.id, name: c.name, pass: false, expected: '', actual: 'timed out' })) };
  }
  const error = obs.loadError?.message ?? obs.calls?.find(c => c.error)?.error ?? '';
  const results = challenge.checks.map(c => {
    let r;
    try { r = c.test(obs); } catch (e) { r = { pass: false, expected: '', actual: 'could not be checked' }; }
    return { id: c.id, name: c.name, pass: !!r.pass, expected: r.expected ?? '', actual: r.actual ?? '' };
  });
  const passed = !obs.loadError && results.every(r => r.pass);
  const ctx = { code, answer: answer ?? '', obs, error };
  const hits = passed ? [] : (challenge.mistakes ?? []).filter(m => { try { return m.when(ctx); } catch (e) { return false; } });
  return { passed, results, error, tags: [...new Set(hits.map(m => m.tag))], why: hits[0]?.why ?? null };
}
