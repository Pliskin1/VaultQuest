# Progress log
- 2026-11-02 · Phases 0–5 done in one autonomous session. Kit docs/content were missing from the folder; restored from the brief.
- Real execution: JS in Worker (1s kill), Python via Pyodide CDN (3s kill), regex `checks` as fallback.
- AI: server echoes client-provided content fallback when no key / error / rate limit; demo mode always uses fallback (deterministic recordings).
- Known issues: project code (`execApp`) runs on the main thread — an infinite loop there freezes the tab. Fix challenges accept any program with the right output (e.g. `print("Hello, Ana")`).
