# TASKS — status

## Phase 0 — Setup
- [x] Vite project, deps (fontsource, express, anthropic sdk, dotenv, concurrently)
- [x] Scripts + `/api` proxy, folder structure, tokens/base CSS, fonts, `.env.example`, `.gitignore`
- [x] `npm run build` passes

## Phase 1 — Core engine
- [x] clock, anim/EASE, dom, fx (+bg glyphs), state (+pro, projects), md, highlight, router
- [x] hud (GO PRO + PRO avatar tag), toast + award, mentor (say/user/typewriter)

## Phase 2 — Screens & cinematics
- [x] Title, Language, Map (Pro version + travel), Level (mcq/blank/fix, hearts, combo), Profile (+portfolio)
- [x] `cine/vault.js` `playVaultCinematic`, `cine/pro.js` cinematic + proChain, `cine/ship.js`, `cine.css`
- [x] Server `/api/mentor` + `/api/review`, rate limit, memo cache, prompts, fallback
- [x] `run/js-runner.js` (execApp + Worker runner, 1s kill), Pyodide worker (3s kill, regex fallback)
- [x] Wiring: levelDone → vault cinematic → map travel

## Phase 3 — Pro
- [x] Paywall + plans + Maybe later, mock checkout → Pro cinematic → chain
- [x] Project mode (run & test, live preview, milestones, submit) → ship cinematic → portfolio; `pro`, `builder` achievements

## Phase 4 — Real AI + real execution
- [x] `Mentor.ask/fetchText/review` → `/api/*` with 6s timeout + fallback; all canned calls replaced
- [x] Fix challenges run real code; pass = expected stdout; real stderr shown and sent to mentor
- [x] Pro hints never cost XP

## Phase 5 — Polish & demo
- [x] QA pass on SPEC acceptance criteria
- [x] Persist/restore state, "Reset progress" in profile
- [x] `?demo=1` / `?demo=pro` directors
- [x] README; single-service deploy (`npm start` serves `dist/` + `/api`)
