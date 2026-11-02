# DESIGN — VaultQuest
Dark "vault-tech" game UI. Gold = progress/free, cyan = correct/AI, coral = error, violet = Pro. Tokens in `src/styles/tokens.css`. Ligatures disabled globally.
Easing: out (.2,.8,.2,1) · back (.2,1.4,.3,1) · inout (.65,0,.35,1) · in (.6,0,.9,.4) · door (.75,0,.2,1). Screen change: out 320ms, in 420ms.
Every success = sparks + ring. Every failure = shake + vignette. Never silent.
Cinematic timings live in `src/cine/*.js` (ported 1:1 from the prototype `cinematic()`, `proCinematic()`, `proChain()`, `shipCinematic()`, `travel()`).
Layout at 1280×720: level mentor 390px, card ≤760px; project 270 / editor / 380; map height `min(430px, 100vh−300px)`, aspect 1200/460.
