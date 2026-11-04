# Progress log
- 2026-11-02 · Phases 0–5 done. Kit docs/content were missing from the folder; restored from the brief.
- Real execution: JS in Worker (1s kill), Python via Pyodide CDN (3s kill), regex `checks` as fallback. Project JS gets an injected loop guard.
- AI: server echoes client-provided content fallback when no key / error / rate limit; demo mode always uses fallback (deterministic recordings).
- Session 2: local profiles login (`screens/login.js`, per-handle saves, streak), Python Pro project "Guess the Number", mobile layout, fix challenges must pass output AND structure checks, accurate ship XP, no XP farming on retry. Verified end-to-end in headless Chromium (free flow, Pro flow, Python project, both demo modes, mobile) — no page errors.
- Bugs found by browser testing and fixed: `.m-map svg` rule blew up all map icons (prototype bug), floor overflow shifted login screen on focus.
- Known limits: profiles are local (no password, per device). AI untested against a real key (needs `.env`).
- 2026-11-04 · Reset button on blank/fix challenges (restores the blank field, or the buggy code + console).
