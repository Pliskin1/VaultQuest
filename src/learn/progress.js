// Save versioning, curriculum tracking and once-only rewards — one set of rules for every language.
// Pure: functions take the save object (and the live curriculum ids) and never touch storage.
//
// Reward keys are `<curriculum>:<level index>:<part>`, part = challenge index | 'bonus' | 'm<k>' | 'ship'.
// `awarded[key]` holds the XP paid, or null for rewards earned before saves were versioned.
export const SAVE_VERSION = 4;

// Every save without `v` was made against the first curriculum of each language, whatever is live now.
export const V1_CURRICULA = { py: 'py-1', js: 'js-1' };
// Shape of the py-1/js-1 content: levels 0–4 are vaults of 3 challenges, level 5 is a 4-milestone project.
const V1_LEVELS = [3, 3, 3, 3, 3, 'project'], V1_FREE = 4, V1_MILESTONES = 4;

export const rewardKey = (curriculum, i, part) => `${curriculum}:${i}:${part}`;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const starKey = lang => new RegExp(`^${lang}\\d+$`);

// v1 → v2: mark everything a v1 profile already completed as paid, so replays can't pay it again.
function backfill(s) {
  for (const lang of Object.keys(V1_CURRICULA)) {
    const cur = V1_CURRICULA[lang], done = Number(s.done?.[lang]) || 0;
    V1_LEVELS.forEach((shape, i) => {
      if (!(i < Math.min(done, V1_FREE) || s.stars?.[lang + i])) return;
      const parts = shape === 'project' ? [...Array.from({ length: V1_MILESTONES }, (_, k) => 'm' + k), 'ship'] : [...Array.from({ length: shape }, (_, k) => k), 'bonus'];
      for (const p of parts) { const k = rewardKey(cur, i, p); if (!(k in s.awarded)) s.awarded[k] = null; }
    });
  }
}

// v4: World 1 gained its Mini Boss as level 4, so on the World 1 curricula the Pro vault and the project moved
// from levels 4 and 5 to 5 and 6. Their stars and unfinished attempts move with them (reward keys don't need
// to: those levels keep their own reward identity, content/languages.js `rewards`).
const BOSS_ADDED_AT = { 'py-2': 4, 'js-2': 4 };
function shiftForBoss(s) {
  for (const lang of Object.keys(V1_CURRICULA)) {
    const cur = s.curriculum[lang], from = BOSS_ADDED_AT[cur];
    if (from === undefined) continue;
    const stars = { ...s.stars };
    for (let i = 7; i >= from; i--) if (lang + i in stars) { stars[lang + (i + 1)] = stars[lang + i]; delete stars[lang + i]; }
    s.stars = stars;
    s.attempts = Object.fromEntries(Object.entries(s.attempts).map(([k, a]) => {
      const i = Number(k.slice(cur.length + 1));
      if (!k.startsWith(cur + ':') || !(i >= from)) return [k, a];
      return [`${cur}:${i + 1}`, isObj(a) ? { ...a, vault: i + 1 } : a];
    }));
  }
}

// A language's live curriculum replaced the one its progress belongs to: archive that progress
// (written once, never overwritten) and start the new path at its first vault. XP, achievements,
// Pro, projects and reward keys stay — keys are curriculum-specific, so old credit never counts as new.
function archive(s, lang, live, now) {
  const old = s.curriculum[lang], re = starKey(lang);
  const mine = Object.entries(s.attempts).filter(([k]) => k.startsWith(old + ':'));
  if (!s.legacy[old]) s.legacy[old] = { lang, done: Number(s.done?.[lang]) || 0, stars: Object.fromEntries(Object.entries(s.stars ?? {}).filter(([k]) => re.test(k))), attempts: Object.fromEntries(mine), archivedAt: now };
  s.attempts = Object.fromEntries(Object.entries(s.attempts).filter(([k]) => !k.startsWith(old + ':'))); // unfinished vaults of the old content
  s.done = { ...s.done, [lang]: 0 };
  s.stars = Object.fromEntries(Object.entries(s.stars ?? {}).filter(([k]) => !re.test(k)));
  s.curriculum = { ...s.curriculum, [lang]: live };
}

// raw: parsed save (any shape). live: { py: 'py-1', js: 'js-1' } — the curricula in the content now.
// Returns a new object (or null if raw isn't a save). Unknown fields are kept. Idempotent.
export function migrate(raw, live, now = new Date().toISOString()) {
  if (!isObj(raw)) return null;
  const s = structuredClone(raw);
  if ((s.v ?? 1) > SAVE_VERSION) return s; // from a newer build: leave it alone
  if (!s.v || s.v < 2) {
    s.v = 2;
    s.curriculum = { ...V1_CURRICULA, ...(isObj(s.curriculum) ? s.curriculum : {}) };
    s.awarded = isObj(s.awarded) ? s.awarded : {};
    s.legacy = isObj(s.legacy) ? s.legacy : {};
    backfill(s);
  }
  if (s.v < 3) s.v = 3; // v3: `attempts` — unfinished vault attempts, keyed `<curriculum>:<vault>` (learn/attempt.js)
  for (const f of ['curriculum', 'awarded', 'legacy', 'attempts']) if (!isObj(s[f])) s[f] = {};
  if (!isObj(s.stars)) s.stars = {};
  if (s.v < 4) { shiftForBoss(s); s.v = 4; }
  for (const lang of Object.keys(live)) {
    if (!s.curriculum[lang]) s.curriculum[lang] = live[lang];
    else if (s.curriculum[lang] !== live[lang]) archive(s, lang, live[lang], now);
  }
  return s;
}

// One attempt at a vault: the rewards it paid, so a reset can take back exactly those.
export const newRun = () => ({ paid: [] });

// Pays `amount` XP once per key → amount paid (0 if this reward was already earned).
export function grantReward(s, key, amount, run = null) {
  if (key in s.awarded) return 0;
  s.awarded[key] = amount; s.xp = (s.xp || 0) + amount;
  if (run) run.paid.push([key, amount]);
  return amount;
}

// Undoes only what `run` paid: subtracts that XP and makes those rewards earnable again.
// Rewards from earlier attempts or sessions are never touched. → XP taken back.
export function rollbackRun(s, run) {
  let back = 0;
  for (const [key, amount] of run.paid) {
    if (s.awarded[key] !== amount) continue;
    delete s.awarded[key]; s.xp = Math.max(0, s.xp - amount); back += amount;
  }
  run.paid = [];
  return back;
}

// Portfolio entries made before curricula were tracked: strings are JS To-Do apps, objects carry `lang`.
export const projectCurriculum = p => typeof p === 'string' ? V1_CURRICULA.js : p.curriculum ?? V1_CURRICULA[p.lang] ?? null;
export const isEarlierVersion = (p, live) => {
  const lang = typeof p === 'string' ? 'js' : p.lang, cur = projectCurriculum(p);
  return !!(cur && live[lang] && cur !== live[lang]);
};
