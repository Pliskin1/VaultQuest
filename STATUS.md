# VaultQuest — stanje projekta

**Ukratko:** aplikacija je kompletna i radi od početka do kraja: login, igra, Pro, projekti i demo snimci. Cijeli tok je provjeren u browseru bez grešaka. Za pravi AI mentor fali samo API ključ; bez njega mentor koristi unaprijed napisane odgovore i sve i dalje radi.

---

## Kako se pokreće

Treba Node 20+.

```bash
npm install
cp .env.example .env        # pa upiši ANTHROPIC_API_KEY=... (opciono, vidi ispod)
npm run dev
```

Otvori adresu koju Vite ispiše u terminalu (obično `http://localhost:5173`). API server se diže sam na portu 8787.

| Komanda | Šta radi |
|---|---|
| `npm run dev` | Frontend + API, za rad |
| `npm run build` | Pravi produkcijski build u `dist/` |
| `npm start` | Build, pa frontend i API na jednom portu (za deploy) |
| `npm test` | Automatski testovi za leaderboard (rangiranje, sedmični XP, server, offline rezim) |

**Demo snimci za pitch:** dodaj `?demo=1` na adresu za besplatni dio, odnosno `?demo=pro` za Pro dio. Pušta se sam, sa kursorom i natpisima, oko 1,5 minut. Demo ne dira sačuvani napredak.

**Bez API ključa** sve radi: mentor daje odgovore napisane u sadržaju igre, a korisnik ne vidi razliku.

---

## Šta je urađeno

### Igra
- **Title ekran** sa animiranim podom, amblemom i dugmetom PRESS START.
- **Login (VAULT ACCESS):** upišeš ime (2–16 znakova) i dobiješ animaciju "ACCESS GRANTED". Pogrešan unos daje "ACCESS DENIED" i shake ekrana. Svako ime ima svoj sačuvan napredak, nedavni profili se nude kao dugmad.
- **Izbor jezika:** Python i JavaScript. Java i C++ su označeni kao "Coming soon".
- **Mapa:** 8 čvorova po jeziku (4 besplatna, 4 Pro) i PRO "kapija" između njih. Avatar putuje zlatnom stazom, a katanac sljedećeg čvora se razbije kad pređeš nivo.
- **Nivo:** 3 izazova po vaultu.
  - Tri tipa zadataka: biranje odgovora, popunjavanje praznine i popravka buga u editoru.
  - Igrač ima 3 srca, combo i XP. Vault se na kraju ocjenjuje sa 1–3 zvjezdice.
  - Mentor panel nudi hint, objašnjenje koncepta i slobodno pitanje.
- **Pravo izvršavanje koda:**
  - JavaScript se izvršava izolovano i prekida se nakon 1 sekunde.
  - Python se izvršava kroz Pyodide (pravi Python u browseru) i prekida se nakon 3 sekunde.
  - Korisnik vidi pravu poruku o grešci. Varanje tipa `print("Hello, Ana")` se ne prihvata.
- **Animacija otključavanja vaulta** sa trezorom, bravama, eksplozijom, zvjezdicama i brojanjem XP-a.
- **Profil:** nivo, statistike, streak po danima, portfolio, napredak po jezicima, 10 achievementa, Log out i Reset progress.
- **Leaderboard:** dugme LEADERBOARD (sa tvojim mjestom) u profilu vodi na rang listu: podijum za top 3, mjesta 4–10, tvoja pozicija i koliko XP fali do igrača iznad, tabovi "All time" i "This week". Rezultati se čuvaju na serveru (`server/data/leaderboard.json`), a lista je dopunjena izmišljenim igračima da nikad nije prazna. Bez servera se prikazuju profili sa ovog uređaja.
- **Telefon:** sve se slaže u kolonu, mapa se skroluje horizontalno. Glavni fokus je desktop 1280×720.

### Pro
- **Paywall:** mjesečni plan €4,99 ili godišnji €39,99, uz tabelu Free vs Pro.
- **Lažni checkout** sa natpisom "DEMO CHECKOUT · NO REAL PAYMENT". Novac se nigdje ne naplaćuje.
- **Pro animacija** (ključ i brava), zatim se Pro čvorovi na mapi otključavaju jedan po jedan.
- **Projekti:**
  - **JavaScript, To-Do App:** pišeš `app.js`, aplikacija radi uživo u previewu, a 4 automatska testa provjeravaju milestone-e.
  - **Python, Guess the Number:** pišeš `game.py`, testovi idu kroz Pyodide, a preview je terminal.
- **Ship animacija** kad predaš projekat, nakon čega projekat završi u portfoliju sa ocjenom AI review-a.

### AI mentor
- Server u folderu `server/` zove Claude (model `claude-haiku-5-5`).
- Pravilo mentora: objasni *zašto* je pogrešno i postavi pitanje, a nikad ne daj gotovo rješenje.
- **Zaštite:**
  - limit od 30 zahtjeva na 10 minuta po korisniku;
  - keširanje identičnih pitanja;
  - timeout od 6 sekundi;
  - fallback na pripremljen tekst kad nešto ne radi.

### Testirano
Cijeli tok je prošao u headless Chromiumu bez ijedne greške na stranici:
- login → nivo → animacija → mapa → profil;
- GO PRO → checkout → Pro → Python projekat → ship → portfolio;
- oba demo moda;
- prikaz na telefonu.

---

## Šta nedostaje / šta treba dodati

### Mora se uraditi prije demoa
1. **API ključ.** Napraviti `.env` sa `ANTHROPIC_API_KEY=...` (ključ se dobija na console.anthropic.com) i provjeriti kako zvuče pravi AI odgovori. Sa pravim ključem ovo još niko nije probao.
2. **Snimiti pitch video** preko `?demo=1` i `?demo=pro` u 1280×720.
3. **Deploy (opciono, ali poželjno za žiri).** Render ili Railway, jedan Node servis: build komanda `npm install && npm run build`, start komanda `node server/index.js`, a `ANTHROPIC_API_KEY` se postavlja kao environment varijabla.

### Sadržaj (najveća rupa)
U `src/content/languages.js` trenutno postoji:
- **Python:** 4 besplatna vaulta, 1 Pro vault ("Loops & Lists") i 1 Pro projekat ("Guess the Number").
- **JavaScript:** 4 besplatna vaulta, 1 Pro vault ("Arrays & Loops") i 1 Pro projekat ("To-Do App").

Fali:
- Python projekat "Expense Tracker" i boss "Weather CLI";
- JS projekat "Pomodoro Timer" i boss "Weather App";
- Java i C++ (trenutno "Coming soon").

Novi sadržaj se dodaje **samo u `src/content/languages.js`**. Format je opisan na vrhu fajla i ne treba dirati ništa drugo.

### Poznata ograničenja
- **Profili su samo lokalni** (po browseru, bez lozinke). Pravi nalozi bi tražili bazu i server; to je namjerno van scope-a za hackathon.
- **Plaćanje je lažno.** Stripe test mode bi bio sljedeći korak ako žiri traži.
- **Python se učitava sa CDN-a** (~10 MB pri prvom Python zadatku). Bez interneta Python zadaci padaju na jednostavnije provjere.
- **Petlja bez vitičastih zagrada u JS projektu** može zamrznuti tab. Petlje sa `{ }` imaju zaštitu.
- **Heatmap aktivnosti** u profilu je dekorativan, ne prati stvarnu aktivnost.
- **Leaderboard vjeruje klijentu.** Bez pravih naloga svako može prijaviti bilo koje ime i XP. Na Renderu/Railwayu se `leaderboard.json` briše pri svakom redeployu, osim ako se doda disk. Izmišljeni igrači su u `src/content/leaderboard.js` (staviti `[]` za samo prave igrače).

### Ideje za roadmap (za pitch, ne za izradu)
Pravi nalozi, multiplayer dueli, više jezika (Java, C++), certifikati koji se mogu verifikovati, Stripe plaćanje.

---

## Gdje je šta u kodu

```
index.html             sav HTML ekrana
src/content/           SADRŽAJ: zadaci, hintovi, projekti, achievementi
src/screens/           ekrani (login, mapa, nivo, profil, pro, projekat)
src/cine/              animacije (vault, pro, ship)
src/run/               izvršavanje JS i Python koda
src/ui/mentor.js       sve AI komunikacije (sa fallbackom)
src/ui/cursor.js       demo režimi za snimanje
server/                Express + Claude API, promptovi u server/prompts.js
docs/                  SPEC, DESIGN, AI, TASKS, PROGRESS
```

Pravila za rad sa Claude Code agentom su u `CLAUDE.md`.
