// Made-up rival players that keep the leaderboard from looking empty (server and offline fallback).
// xp = total XP, wk = XP earned this week, vaults = free vaults cracked (0–8).
// A real player who picks one of these handles replaces the rival. Set to [] to show only real players.
export const RIVALS = [
  { name: 'NeoByte', xp: 4870, wk: 310, pro: true, vaults: 8, streak: 21 },
  { name: 'kira_dev', xp: 4310, wk: 520, pro: false, vaults: 8, streak: 9 },
  { name: 'PyPanda', xp: 3925, wk: 180, pro: true, vaults: 7, streak: 15 },
  { name: 'luka-codes', xp: 3140, wk: 705, pro: false, vaults: 6, streak: 6 },
  { name: 'Mira', xp: 2780, wk: 260, pro: true, vaults: 6, streak: 12 },
  { name: 'bitwise_ana', xp: 2550, wk: 95, pro: false, vaults: 5, streak: 4 },
  { name: 'stack_tom', xp: 1985, wk: 410, pro: false, vaults: 4, streak: 3 },
  { name: 'Ivo', xp: 1620, wk: 150, pro: false, vaults: 3, streak: 1 },
  { name: 'nullpointer', xp: 1340, wk: 870, pro: false, vaults: 3, streak: 8 },
  { name: 'tea_and_code', xp: 860, wk: 240, pro: false, vaults: 2, streak: 5 },
  { name: 'pixelmara', xp: 420, wk: 120, pro: false, vaults: 1, streak: 2 }
];
