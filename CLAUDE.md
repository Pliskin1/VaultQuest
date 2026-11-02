# VaultQuest — CLAUDE.md

Gamified learn-to-code web app (hackathon). Free basics per language, paid **Pro**: advanced vaults + guided mini-projects with AI code review.
Ported from the prototype into a modular Vite app with real AI (`/api/*`) and real code execution. Visuals/animations match the prototype.

## Stack (fixed)
- Vite + vanilla JS (ES modules), no framework. Plain CSS. Web Animations API + one canvas FX layer.
- Fonts via `@fontsource` (Chakra Petch, Inter, JetBrains Mono).
- Server: Node + Express in `server/` (port 8787), Vite proxies `/api`. AI = `@anthropic-ai/sdk`, model `claude-haiku-5-5`.
- Code execution: JS in a throwaway Worker (`run/js-runner.js`), Python via Pyodide in a Worker (`run/py-*.js`).
- Persistence: localStorage key `vaultquest`. Payments: mock checkout ("Demo checkout").

## Commands
- `npm run dev` (Vite + API) · `npm run build` · `npm run server` · `npm start` (build + serve dist + API on one port)
- Verify with `npm run build 2>&1 | tail -20`. Don't start dev servers/browsers unless asked.

## Docs
- `docs/TASKS.md` phases (all ticked) · `docs/SPEC.md` · `docs/DESIGN.md` · `docs/AI.md` · `docs/PROGRESS.md`

## Structure
```
index.html                    all screen + overlay markup
src/main.js                   fonts, css, mounts, clock, demo
src/core/  clock fx anim state router dom md highlight
src/ui/    hud toast(+award, floatText) mentor cursor(demo directors)
src/screens/ title lang map level profile pro project
src/cine/  vault pro ship     each returns a Promise that resolves on its CTA click
src/run/   js-runner py-worker py-runner
src/content/ languages.js achievements.js   (content only — edit here)
server/    index ai prompts fallback
```

## Conventions
- Screens export `mount()` (bind handlers) and `openX()/startX()`; router `go(id)` fades like the prototype.
- Animation timing via `core/clock.js` `wait(ms)` (frame-driven). Network timeouts use real `setTimeout`.
- Colors from CSS variables in `tokens.css`.
- AI only via `src/ui/mentor.js` → `/api/*`; every call has a content fallback (no key, error, 6s timeout, rate limit, demo mode).
- Secrets only in `.env` (`ANTHROPIC_API_KEY`). Never read or print `.env`.
