// The order of World 1, one rule set for every language: FREE vaults → Mini Boss (World 1 cleared) → PRO
// checkout → PRO Vault → Project → Final Boss. Pure functions over the saved profile — no extra save fields:
// everything is derived from `done`, `stars`, `pro`, `projects` and `attempts`, so existing saves need no
// migration. The map, the vault screen and the project screen all ask these functions, so a node can't be
// entered by any route the map wouldn't allow.
//
// Grandfathering: a project that was already started or shipped under the earlier order (projects were open
// as soon as PRO was bought) stays open. The Final Boss always needs the PRO Vault cracked AND a verified ship
// of the current project — opening it, finishing its Blueprint or passing some milestones is not enough.
import { portfolioEntry } from './ship.js';

// The PRO levels of a language, by their role (indexes differ only if the curriculum changes).
export function roles(L) {
  const free = L.free, levels = L.levels;
  return {
    free, levels,
    proVault: levels.findIndex((l, k) => k >= free && !l.t && l.ch),
    project: levels.findIndex(l => l.t === 'project'),
    final: levels.findIndex(l => l.t === 'final')
  };
}

const attemptOf = (S, lang, i) => S.attempts?.[`${S.curriculum?.[lang]}:${i}`] ?? null;

// The current project shipped with evidence that every check passed: a verified portfolio record (Phase 9+),
// or — for ships recorded before records carried verification — a record in this curriculum whose saved
// workspace shows the project shipped with every milestone cleared (shipping always required a passing run).
export function projectVerified(S, lang, L) {
  const { project } = roles(L), lv = L.levels[project];
  if (!lv) return false;
  const cur = S.curriculum?.[lang], levels = { [lang]: L.levels };
  const mine = (S.projects ?? []).filter(p => p && typeof p === 'object' && p.lang === lang && p.title === lv.title && p.curriculum === cur);
  if (mine.some(p => portfolioEntry(p, { [lang]: cur }, levels).verified)) return true;
  const ws = attemptOf(S, lang, project)?.workspace;
  return mine.length > 0 && ws?.shipped === true && Array.isArray(ws.cleared) && ws.cleared.length === lv.ms.length && ws.cleared.every(c => c === true);
}

// Started or shipped before the PRO Vault came first (kept open, never revoked).
function projectGrandfathered(S, lang, L) {
  const { project } = roles(L), lv = L.levels[project], a = attemptOf(S, lang, project);
  const shipped = (S.projects ?? []).some(p => p && typeof p === 'object' && p.lang === lang && p.title === lv?.title && p.curriculum === S.curriculum?.[lang]);
  return shipped || a?.blueprint?.started === true || a?.blueprint?.waived === true || a?.workspace?.shipped === true || (a?.workspace?.runs ?? 0) > 0;
}

export function isDone(S, lang, L, i) {
  const { free, project, final } = roles(L);
  if (i < free) return i < (S.done?.[lang] ?? 0);
  if (i === project) return projectVerified(S, lang, L);
  if (i === final) return (S.stars?.[lang + i] ?? 0) > 0;
  return (S.stars?.[lang + i] ?? 0) > 0;
}

// Why level i can't be entered yet → text for the student, or null when it can.
export function lockReason(S, lang, L, i) {
  const { free, levels, proVault, project, final } = roles(L);
  const done = S.done?.[lang] ?? 0, title = k => L.titles[k]?.replace(/^(Mini Boss|Boss|Project): /, '');
  if (!levels[i]) return 'Coming soon.';
  if (i < free) return i <= done ? null : i === free - 1 ? 'Crack all four free vaults to face the Mini Boss.' : `Crack Vault 0${i} first.`;
  if (done < free) return 'Beat the Mini Boss to clear World 1 first.';
  if (!S.pro) return 'Unlock PRO to continue World 1.';
  if (i === proVault) return null;
  const vaultDone = isDone(S, lang, L, proVault);
  if (i === project) return vaultDone || projectGrandfathered(S, lang, L) ? null : `Crack PRO Vault 0${proVault + 1} · ${title(proVault)} first.`;
  if (i === final) {
    if (!vaultDone) return `Crack PRO Vault 0${proVault + 1} · ${title(proVault)} first.`;
    if (!projectVerified(S, lang, L)) return `Ship ${title(project)} first — every check has to pass.`;
    return null;
  }
  return null;
}
export const canEnter = (S, lang, L, i) => lockReason(S, lang, L, i) === null;

// The step to highlight after checkout or a completed PRO step: the first PRO level not done yet.
export function nextStep(S, lang, L) {
  const { free, proVault, project, final } = roles(L);
  for (const i of [proVault, project, final]) if (i >= 0 && !isDone(S, lang, L, i)) return i;
  return final >= 0 ? final : free;
}
