# VaultQuest
Learn to code. Crack the vaults. A gamified learn-to-code web app: handcrafted Python & JavaScript challenges, an AI mentor that explains *why* (never just the answer), real code execution, and cinematic unlocks. Pro adds advanced vaults and guided projects with AI code review.

## Run
```bash
npm i
cp .env.example .env      # optional: add ANTHROPIC_API_KEY=... (without it the mentor uses handcrafted answers)
npm run dev               # http://localhost:5173  (Vite + API on :8787)
```
Production / single service: `npm start` (builds, then serves `dist/` + `/api` on `PORT`, default 8787). Works on Render/Railway as one Node service.

Demo recordings: `http://localhost:5173/?demo=1` (free flow) and `?demo=pro` (Pro flow). Demo mode never touches saved progress.

## How it works
- Vite + vanilla JS, Web Animations API, one canvas FX layer.
- AI: `server/` Express → Claude (`claude-haiku-5-5`), rate-limited, cached, always with a content fallback.
- Code: JS runs in a sandboxed Worker; Python runs via Pyodide (loaded from CDN on first Python fix challenge).
- Progress in localStorage; "Reset progress" on the profile screen.
