# SPEC — VaultQuest

Pitch: "Learn to code. Crack the vaults." Every level is a locked vault. Solve handcrafted challenges, get guided by an AI mentor that never just gives the answer, watch high-end unlock animations. Free = basics; Pro = advanced vaults + guided projects that end in a portfolio.
Target: desktop 1280×720+. Must not break on mobile, desktop is the priority.

## Global
- HUD (map, profile, pro): logo, language chip, `LVL n` + XP bar + XP, streak, `GO PRO` (hidden when Pro), avatar → profile (PRO tag when Pro).
- Canvas FX layer above UI (pointer-events none). Floating code glyphs on title/lang.
- State (localStorage): `{lang, xp, done:{py,js}, stars:{[lang+i]:1-3}, ach:[], fresh:[], streak, questions, pro, projects:[]}`. Level = 1 + floor(xp/300).
- Achievements as toasts with shine sweep + sparks.

## Screens
1. **Title** — grid floor, rotating emblem, logo, tagline, pulsing PRESS START. AC: click → sparks + ring → language.
2. **Language** — 4 cards (Python, JavaScript; Java, C++ "Coming soon"), staggered 3D flip-in, hover tilt. AC: pick → pulse + sparks → map.
3. **Map** — 8 nodes; 1–4 free, 5–8 Pro. Free: done/current/locked. PRO gate between 4 and 5. Avatar bobs above current. Bottom panel with action (`ENTER VAULT`/`REPLAY`/`UNLOCK WITH PRO`/`START PROJECT`/Coming soon). AC: after a free level the avatar travels the gold path and the next lock shatters.
4. **Level** — header (back, title, 3 segments, combo, 3 hearts, LVL bar), challenge card, mentor (390px).
   - mcq / blank (Enter = check) / fix (editor, RUN, console).
   - Correct: glow, sparks + ring, `+XP`, combo slam from 2, card slides. Wrong: shake, screen shake, vignette, heart splits, mentor explains why. 0 hearts → level restarts. Running buggy code costs no heart.
   - XP 50 + 10×(combo−1). Stars: ≤1 mistake 3★, ≤3 2★, else 1★.
   - Mentor: welcome, dots + typewriter, labels; Hint (1st free, then −10 XP, Pro free), Explain concept, free-text ask.
5. **Level complete cinematic** — see DESIGN.md.
6. **Profile** — avatar + rank, 4 stats, portfolio, paths, 12-week heatmap, achievements (NEW glow).

## Pro
7. **Paywall** — from Pro node / UNLOCK WITH PRO / GO PRO. Monthly €4.99 / Yearly €39.99 (SAVE 33%, preselected), START 7-DAY FREE TRIAL, Free vs Pro table, Maybe later.
8. **Checkout (mock)** — €0.00 today, card •••• 4242, CONFIRM → PROCESSING… (1.3s) → ✓ YOU'RE PRO → Pro cinematic. "DEMO CHECKOUT · NO REAL PAYMENT".
9. **Pro cinematic** → map: gate shatters, Pro nodes unlock one by one, avatar moves to node 5.
10. **Project mode** — milestones, `app.js` editor, RUN & TEST, SUBMIT when all pass, console ✓/✗, live preview, mentor CODE REVIEW (AI, fallback `review()`).
11. **Ship cinematic** — SHIPPED!, stats (+500 XP, 4/4, AI score), `Pro Builder` toast, SHARE LIVE LINK + ADD TO PORTFOLIO → profile.

## Profiles (added)
Local profiles instead of accounts: title → VAULT ACCESS screen (handle 2–16 chars) → per-handle save `vaultquest:<handle>`, recent profiles as chips, Log out + Reset in profile. Daily streak.

## Leaderboard (added)
Profile → `LEADERBOARD #rank` button (outline) → leaderboard screen: podium (top 3), rankings 4–10 (rank + ▲/▼ since last week, level, vaults, streak, XP; your row highlighted, pinned under `···` if outside the top 10), YOUR POSITION (rank, XP, XP to overtake the player above, PLAY NEXT VAULT), HOW TO CLIMB. Tabs ALL TIME / THIS WEEK (XP since Monday UTC, `S.wk` baseline).
Scores are self-reported to `POST /api/leaderboard` (no accounts) on profile open, leaderboard open, vault cracked, project shipped. Made-up rivals (`content/leaderboard.js`) fill the board; offline/demo → local profiles + rivals.

## Out of scope
Server accounts/passwords, real payments, multiplayer, admin, i18n.
