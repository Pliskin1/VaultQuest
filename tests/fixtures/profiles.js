// Saves as the teammate's app wrote them before versioning (v1: no `v`, `curriculum` or `awarded`).
export const V1 = {
  pyPartial: { name: 'PyPartial', lang: 'py', xp: 420, done: { py: 2, js: 0 }, stars: { py0: 3, py1: 2 }, ach: ['first', 'debug'], fresh: [], streak: 3, lastDay: '2026-11-01', questions: 2, pro: false, projects: [] },
  jsShipped: { name: 'JsShipped', lang: 'js', xp: 1990, done: { py: 0, js: 4 }, stars: { js0: 3, js1: 3, js2: 2, js3: 3, js4: 2, js5: 3 }, ach: ['first', 'curious', 'bounce', 'pro', 'builder', 'legend'], fresh: [], streak: 1, lastDay: '2026-11-03', questions: 5, pro: true, projects: ['To-Do App'], custom: { keep: 'me' } },
  proPy: { name: 'ProPy', lang: 'py', xp: 2600, done: { py: 4, js: 4 }, stars: { py0: 3, py1: 3, py2: 3, py3: 2, py4: 3, py5: 3, js0: 3, js1: 3, js2: 3, js3: 3 }, ach: ['first', 'pro', 'builder'], fresh: [], streak: 6, lastDay: '2026-11-04', questions: 9, pro: true, projects: [{ title: 'Guess the Number', lang: 'py', score: 90 }] },
  jsOne: { name: 'JsOne', lang: 'js', xp: 330, done: { py: 0, js: 1 }, stars: { js0: 2 }, ach: ['first'], fresh: [], streak: 1, lastDay: '2026-11-04', questions: 0, pro: false, projects: [] },
  // From the very first build: no projects/questions/ach yet.
  ancient: { name: 'Ancient', lang: 'py', xp: 90, done: { py: 0, js: 0 }, stars: {} }
};

export const LIVE_NOW = { py: 'py-1', js: 'js-1' };
