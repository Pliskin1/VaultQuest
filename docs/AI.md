# AI — Mentor & Code Review
The mentor **guides, never solves**. Every call falls back to content text (no key, error, 6s timeout, rate limit, demo mode). The UI can't tell the difference.

## Endpoints
`POST /api/mentor` `{ mode: wrong|hint|explain|ask, lang, challenge:{type,q,code}, answer, error, hintLevel, question, concept, fallback }` → `{ text, source: ai|fallback }`
`POST /api/review` `{ lang, project, milestones, code, failing:[{milestone,message}], final, fallback, fallbackScore }` → `{ text, score|null, source }`
`GET /api/health` → `{ ok, ai }`
`fallback` = client's content text; the server echoes it when AI is unavailable.

## Limits
Model `claude-haiku-5-5`; max_tokens mentor 220 / review 350; temperature 0.3 (auto-retried without if the model rejects it). System prompt with `cache_control`. Stateless. 30 req / 10 min / IP. In-memory memo of identical bodies (500 entries). Code truncated to 4,000 chars.

## Prompts
See `server/prompts.js` (MENTOR, REVIEWER).

## Client (`src/ui/mentor.js`)
`say(textOrPromise)` shows dots until the text resolves, then types. `fetchText(mode, payload, fallback)`, `ask(...)` = say(fetchText). `review(payload, fallback, score)` → `{text, score}`.
Fallbacks: wrong → option why / `wrong[answer]` / `why` / regex `check.why`; hint → `hints[n-1]`; explain → `concept`; ask → keyword answers; review → `project.review(code, firstFail)`; final → 92/100 text.
