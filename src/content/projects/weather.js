// FINAL BOSS (JavaScript): Weather App. Same machinery as the To-Do project (run/sandbox/harness.js): the
// HTML and CSS are given, the student writes app.js, and every check runs the code in its own sandboxed
// frame with its own SAMPLE data from `loadWeather()` (never live weather — no network, no API key). The data
// changes with the code (seeded), so hardcoded cities or temperatures fail. Checks judge what the page does,
// never how the code is written. `run`, `helpers` and `prelude` must be self-contained arrow functions.
//   city record: { city, temp (°C), condition, forecast: [{ day, temp (°C), condition } × 3] }
import { ERROR_ASK } from './todo.js';

export const HTML = '<div class="wx"><h3>Weather <span class="wx-tag">SAMPLE DATA · NOT LIVE</span></h3><div class="wx-row"><input id="city" placeholder="City, e.g. Paris" aria-label="City" autocomplete="off"><button id="search">Show</button><button id="unit" aria-label="Switch °C / °F">°C ⇄ °F</button></div><p id="msg"></p><div id="now"><h4 id="name"></h4><p id="temp"></p><p id="cond"></p></div><ul id="forecast"></ul></div>';

export const CSS = `* { box-sizing: border-box; }
body { margin: 0; padding: 16px; background: #0F1626; color: #E8ECF5; font: 14px/1.4 Inter, -apple-system, "Segoe UI", system-ui, sans-serif; }
.wx h3 { margin: 0 0 10px; font-size: 20px; display: flex; align-items: center; gap: 8px; }
.wx-tag { font: 600 10px ui-monospace, Menlo, monospace; letter-spacing: .08em; color: #F2B544; border: 1px solid #5A4A22; border-radius: 6px; padding: 2px 6px; }
.wx-row { display: flex; gap: 6px; }
.wx-row input { flex: 1; min-width: 0; height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid #2E3A55; background: #0A0F1A; color: #E8ECF5; font: inherit; outline: none; }
.wx-row button { height: 34px; padding: 0 10px; border-radius: 8px; border: 0; background: #4FD8C4; color: #07090F; font: 600 13px inherit; cursor: pointer; }
.wx-row #unit { background: #1E2840; color: #E8ECF5; }
#msg { min-height: 18px; margin: 8px 0 0; color: #FF9B7A; font-size: 13px; }
#now h4 { margin: 6px 0 0; font-size: 18px; }
#temp { margin: 2px 0 0; font-size: 30px; font-weight: 700; }
#cond { margin: 0; color: #A3ABBE; }
#forecast { list-style: none; margin: 10px 0 0; padding: 0; display: flex; gap: 6px; }
#forecast li { flex: 1; padding: 8px; border-radius: 8px; background: #161F33; border: 1px solid #23304C; font-size: 12.5px; text-align: center; }`;

export const FILES = {
  'index.html': `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <div class="wx">
      <h3>Weather <span class="wx-tag">SAMPLE DATA · NOT LIVE</span></h3>
      <div class="wx-row">
        <input id="city" placeholder="City, e.g. Paris">
        <button id="search">Show</button>
        <button id="unit">°C ⇄ °F</button>
      </div>
      <p id="msg"></p>
      <div id="now">
        <h4 id="name"></h4>
        <p id="temp"></p>
        <p id="cond"></p>
      </div>
      <ul id="forecast"></ul>
    </div>
    <script src="app.js"></script>
  </body>
</html>
`,
  'style.css': CSS + '\n'
};

// Globals for the student's code: `$` and `loadWeather()` (a copy of the sample data).
export const prelude = (W, data) => {
  W.$ = sel => W.document.querySelector(sel);
  W.loadWeather = () => JSON.parse(JSON.stringify((data && data.cities) || []));
};

// Helpers for the checks (inside the frame).
export const helpers = t => {
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const read = sel => { const el = t.qs(sel); return el ? clean(el.textContent) : null; };
  // every temperature written in a text, e.g. "18°C", "-2 °F", "64.4F"
  const temps = s => { const out = [], re = /(-?\d+(?:\.\d+)?)\s*°?\s*([CF])\b/gi; let m; while ((m = re.exec(String(s)))) out.push({ v: +m[1], u: m[2].toUpperCase() }); return out; };
  const f = c => c * 9 / 5 + 32;
  return {
    read, temps, f,
    near: (got, want) => !!got && Math.abs(got.v - want) <= 0.5,
    async search(name) {
      const input = t.qs('#city'), btn = t.qs('#search');
      if (!input || !btn) throw t.missing('#city or #search');
      input.value = name; input.dispatchEvent(new Event('input', { bubbles: true }));
      t.click(btn); await t.tick();
    },
    async toggle() { const b = t.qs('#unit'); if (!b) throw t.missing('#unit'); t.click(b); await t.tick(); },
    days: () => t.qsa('#forecast li').map(li => clean(li.textContent)),
    city: k => t.data.cities[k]
  };
};

// ── data (outside the frame): sample cities with seeded temperatures ──
const CITIES = ['Paris', 'Oslo', 'Cairo', 'Tokyo', 'Lima', 'Nairobi', 'Toronto', 'Sydney', 'Madrid', 'Reykjavik'];
const CONDS = ['Sunny', 'Cloudy', 'Rain', 'Snow', 'Windy', 'Fog', 'Storm'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const n = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, list) => list[Math.floor(r() * list.length)];
function cities(r, count, { negative = false } = {}) {
  const pool = [...CITIES], out = [];
  while (out.length < count) {
    const city = pool.splice(Math.floor(r() * pool.length), 1)[0], d0 = n(r, 0, 6);
    const temp = negative && out.length === 0 ? n(r, -12, -1) : n(r, -6, 34);
    out.push({ city, temp, condition: pick(r, CONDS), forecast: [0, 1, 2].map(k => ({ day: DAYS[(d0 + k) % 7], temp: temp + n(r, -4, 4), condition: pick(r, CONDS) })) });
  }
  return out;
}

// ── checks (inside the frame) ──
const showsCity = async t => {
  const c = t.city(1); await t.search(c.city);
  const name = t.read('#name') || '', tp = t.temps(t.read('#temp'))[0], cond = t.read('#cond') || '';
  if (!name.includes(c.city)) return t.fail('after Show, #name should show the city that was typed', { expected: '"' + c.city + '"', actual: name ? '"' + name + '"' : 'nothing', tags: ['city-not-shown'] });
  if (!tp || tp.u !== 'C' || !t.near(tp, c.temp)) return t.fail('#temp should show that city\'s temperature in °C', { expected: c.temp + '°C', actual: t.read('#temp') || 'nothing', tags: ['temp-wrong'] });
  if (!cond.includes(c.condition)) return t.fail('#cond should show that city\'s condition', { expected: '"' + c.condition + '"', actual: cond ? '"' + cond + '"' : 'nothing', tags: ['condition-wrong'] });
  return t.pass();
};
const ignoresCase = async t => {
  const c = t.city(0); await t.search('  ' + c.city.toLowerCase() + ' ');
  const name = t.read('#name') || '', tp = t.temps(t.read('#temp'))[0];
  return name.toLowerCase().includes(c.city.toLowerCase()) && tp && t.near(tp, c.temp) ? t.pass()
    : t.fail('typing "' + c.city.toLowerCase() + '" with extra spaces should still find ' + c.city, { expected: c.city + ', ' + c.temp + '°C', actual: name || t.read('#msg') || 'nothing', tags: ['case-sensitive'] });
};
const replacesCity = async t => {
  const a = t.city(0), b = t.city(2);
  await t.search(a.city); await t.search(b.city);
  const name = t.read('#name') || '', tp = t.temps(t.read('#temp'))[0];
  return name.includes(b.city) && !name.includes(a.city) && tp && t.near(tp, b.temp) ? t.pass()
    : t.fail('a second search should replace the first city on screen', { expected: b.city + ', ' + b.temp + '°C', actual: name || 'nothing', tags: ['stale-ui'] });
};
const forecastCount = async t => {
  const c = t.city(0); await t.search(c.city);
  const d = t.days();
  return d.length === 3 ? t.pass() : t.fail('#forecast should hold one <li> per forecast day — three of them', { expected: '3 days', actual: d.length + ' item' + (d.length === 1 ? '' : 's'), tags: ['forecast-count'] });
};
const forecastContent = async t => {
  const c = t.city(1); await t.search(c.city);
  const d = t.days(), bad = c.forecast.findIndex((f, k) => { const li = d[k] || '', tp = t.temps(li)[0]; return !li.includes(f.day) || !li.includes(f.condition) || !tp || tp.u !== 'C' || !t.near(tp, f.temp); });
  if (bad < 0 && d.length === 3) return t.pass();
  const f = c.forecast[Math.max(0, bad)];
  return t.fail('each forecast day should show its day, temperature and condition, in order', { expected: f.day + ' ' + f.temp + '°C ' + f.condition, actual: d[Math.max(0, bad)] ? '"' + d[Math.max(0, bad)] + '"' : 'nothing', tags: ['forecast-content'] });
};
const forecastReplaced = async t => {
  const a = t.city(0), b = t.city(2);
  await t.search(a.city); await t.search(b.city);
  const d = t.days();
  return d.length === 3 && d.every((li, k) => li.includes(b.forecast[k].day) && li.includes(b.forecast[k].condition)) ? t.pass()
    : t.fail('searching another city should replace the forecast, not add to it', { expected: '3 days of ' + b.city, actual: d.length + ' items', tags: ['stale-ui'] });
};
const unitNow = async t => {
  const c = t.city(1); await t.search(c.city); await t.toggle();
  const tp = t.temps(t.read('#temp'))[0];
  return tp && tp.u === 'F' && t.near(tp, t.f(c.temp)) ? t.pass()
    : t.fail('after #unit, #temp should show the same temperature in °F (°C × 9/5 + 32)', { expected: Math.round(t.f(c.temp)) + '°F', actual: t.read('#temp') || 'nothing', tags: tp && tp.u === 'F' ? ['conversion'] : ['unit-not-switched'] });
};
const unitForecast = async t => {
  const c = t.city(2); await t.search(c.city); await t.toggle();
  const d = t.days(), bad = c.forecast.findIndex((f, k) => { const tp = t.temps(d[k] || '')[0]; return !tp || tp.u !== 'F' || !t.near(tp, t.f(f.temp)); });
  return bad < 0 && d.length === 3 ? t.pass()
    : t.fail('after #unit, the forecast temperatures should switch to °F too', { expected: Math.round(t.f(c.forecast[Math.max(0, bad)].temp)) + '°F', actual: d[Math.max(0, bad)] ? '"' + d[Math.max(0, bad)] + '"' : 'nothing', tags: ['forecast-unit'] });
};
const unitBack = async t => {
  const c = t.city(1); await t.search(c.city); await t.toggle(); await t.toggle();
  const tp = t.temps(t.read('#temp'))[0];
  return tp && tp.u === 'C' && t.near(tp, c.temp) ? t.pass()
    : t.fail('pressing #unit twice should bring back the original °C temperature', { expected: c.temp + '°C', actual: t.read('#temp') || 'nothing', tags: ['unit-not-switched'] });
};
const unitNegative = async t => {
  const c = t.city(0); await t.search(c.city); await t.toggle();
  const tp = t.temps(t.read('#temp'))[0];
  return tp && tp.u === 'F' && t.near(tp, t.f(c.temp)) ? t.pass()
    : t.fail('below-zero temperatures convert with the same formula', { expected: c.temp + '°C → ' + Math.round(t.f(c.temp)) + '°F', actual: t.read('#temp') || 'nothing', tags: ['conversion'] });
};
const unknownCity = async t => {
  const c = t.city(0); await t.search(c.city); await t.search('Atlantis');
  const msg = t.read('#msg') || '', name = t.read('#name') || '', d = t.days();
  if (!msg) return t.fail('an unknown city should show a message in #msg', { expected: 'a message like "City not found"', actual: 'nothing', tags: ['unknown-city'] });
  return !name.includes(c.city) && d.length === 0 && !t.temps(t.read('#temp')).length ? t.pass()
    : t.fail('after an unknown city, the old city\'s weather should not stay on screen', { expected: 'only the message', actual: (name || '') + ' · ' + d.length + ' forecast items', tags: ['stale-ui'] });
};
const emptyInput = async t => {
  await t.search('   ');
  const msg = t.read('#msg') || '';
  return msg && !t.temps(t.read('#temp')).length ? t.pass()
    : t.fail('pressing Show with an empty box should show a message, not weather', { expected: 'a message like "Type a city"', actual: msg ? '"' + msg + '"' : 'nothing', tags: ['empty-input'] });
};
const keepsUnit = async t => {
  const a = t.city(0), b = t.city(1);
  await t.search(a.city); await t.toggle(); await t.search(b.city);
  const tp = t.temps(t.read('#temp'))[0];
  return tp && tp.u === 'F' && t.near(tp, t.f(b.temp)) ? t.pass()
    : t.fail('a new search should keep the unit the user chose', { expected: Math.round(t.f(b.temp)) + '°F', actual: t.read('#temp') || 'nothing', tags: ['unit-reset'] });
};
const clearsMessage = async t => {
  const c = t.city(1); await t.search('Atlantis'); await t.search(c.city);
  const msg = t.read('#msg') || '', name = t.read('#name') || '';
  return name.includes(c.city) && !msg ? t.pass()
    : t.fail('after a successful search, the old message should be gone', { expected: c.city + ' and an empty #msg', actual: 'msg: "' + msg + '"', tags: ['stale-ui'] });
};

const ASK = {
  find: ['When the user presses Show, how does your code go from the typed text to one record in the data?', 'What should happen to capitals and spaces in what the user typed before you compare it with each city?'],
  show: ['Once you have the record, which of its fields go into #name, #temp and #cond?', 'Which line writes the temperature — and does it add the °C?'],
  stale: ['What happens to what is already on screen when a new search runs?', 'Does your code clear or overwrite every part of the old result before showing a new one?'],
  forecast: ['The record has a forecast array. How do you turn each day into one list item?', 'Is #forecast emptied before the new days are added?'],
  unit: ['Where does your app remember which unit is chosen — and who reads it when temperatures are written?', 'What is °F for 0°C, and does your code get the same?'],
  edge: ['What should the screen show when no city matches — or nothing was typed?', 'After a bad search, which parts of the old result could still be visible?']
};
const C = (id, ms, data, run, [ask, ask2]) => ({ id, ms, data, run, ask, ask2 });
export const CHECKS = [
  C('find-city', 0, r => ({ cities: cities(r, 4) }), showsCity, ASK.show),
  C('find-ignores-case', 0, r => ({ cities: cities(r, 3) }), ignoresCase, ASK.find),
  C('find-replaces', 0, r => ({ cities: cities(r, 3) }), replacesCity, ASK.stale),
  C('forecast-three', 1, r => ({ cities: cities(r, 3) }), forecastCount, ASK.forecast),
  C('forecast-days', 1, r => ({ cities: cities(r, 3) }), forecastContent, ASK.forecast),
  C('forecast-replaced', 1, r => ({ cities: cities(r, 3) }), forecastReplaced, ASK.forecast),
  C('unit-now', 2, r => ({ cities: cities(r, 3) }), unitNow, ASK.unit),
  C('unit-forecast', 2, r => ({ cities: cities(r, 3) }), unitForecast, ASK.unit),
  C('unit-back', 2, r => ({ cities: cities(r, 3) }), unitBack, ASK.unit),
  C('unit-negative', 2, r => ({ cities: cities(r, 3, { negative: true }) }), unitNegative, ASK.unit),
  C('edge-unknown', 3, r => ({ cities: cities(r, 3) }), unknownCity, ASK.edge),
  C('edge-empty', 3, r => ({ cities: cities(r, 3) }), emptyInput, ASK.edge),
  C('edge-keeps-unit', 3, r => ({ cities: cities(r, 3) }), keepsUnit, ASK.unit),
  C('edge-clears-message', 3, r => ({ cities: cities(r, 3) }), clearsMessage, ASK.edge)
];

// Explain first (Mini Boss engine, learn/approach.js): the plan must cover finding the city, showing it,
// the forecast, the unit switch and the unknown/empty cases — in the student's own words.
const has = re => s => re.test(s);
export const APPROACH = {
  prompt: 'Before you code the Final Boss, explain your plan: when someone types a city and presses Show, what does your app do — and what changes when they switch the unit?',
  short: 'Tell me a bit more, in your own words: how will you find the city, what will you show, and what happens with the unit and with a city that isn\'t there?',
  accepted: 'That\'s a plan: find the city ignoring capitals, show its weather and three days of forecast, remember the unit and convert with ×9/5+32, and handle unknown or empty input. **Coding is unlocked.**',
  rules: [
    { id: 'find', covered: has(/\b(find\w*|look\w* (up|for|through)|search\w*|match\w*|go(es|ing)? through|loop\w*|each|filter\w*)\b/i), question: 'How will your app find the right city in the data when someone presses Show?' },
    { id: 'show', covered: has(/\b(show\w*|display\w*|write\w*|put\w*|render\w*|textcontent|fill\w*)\b/i), question: 'Once you have found the city, what will you put on the screen — and where?' },
    { id: 'forecast', covered: has(/\b(forecast|three days|3 days|next days|each day|days)\b/i), question: 'The data has a three-day forecast for each city. How will it appear?' },
    { id: 'unit', covered: has(/\b(fahrenheit|°f|convert\w*|unit|9 ?\/ ?5|1\.8|\+ ?32|celsius)\b/i), question: 'What happens when someone presses the °C ⇄ °F button — and how do you turn °C into °F?' },
    { id: 'edge', covered: has(/\b(unknown|not found|missing|doesn'?t exist|no match|isn'?t there|empty|nothing typed|invalid|wrong city)\b/i), question: 'What should your app do when the city isn\'t in the data, or the box is empty?' }
  ]
};

export const WEATHER = {
  title: 'Weather App', file: 'app.js', cmd: 'npm test', url: 'localhost:3000 — weather-app (sample data)',
  brief: 'The **Final Boss** of World 1. Build a weather app in **app.js** — the HTML and CSS are ready. `loadWeather()` gives you **sample** weather (not live): find a city, show its weather and three-day forecast, switch between °C and °F, and handle cities that aren\'t there.',
  starter: '// The HTML is ready: #city, #search, #unit, #msg, #name, #temp, #cond, #forecast\n// loadWeather() gives you SAMPLE weather (not live):\n// [{ city, temp (°C), condition, forecast: [{ day, temp (°C), condition }, …3] }, …]\nconst cities = loadWeather();\nlet unit = "C";\n\n',
  ms: [
    { n: 'Find a city', d: 'Show: #name, #temp (like 18°C) and #cond for the typed city — capitals and extra spaces don\'t matter.',
      hints: ['When Show is pressed, you have the text from #city and a list of cities. What do you need to compare to find the right one?',
        'Make both sides lowercase and trim the spaces before comparing. Once you have the record, which three of its fields go on screen?',
        'Put the drawing in one function that takes a city record. Does a second search call it again with the new record?'],
      alt: 'Using `find` on the array is one way; a plain loop that stops at the match works just as well.' },
    { n: 'Three-day forecast', d: 'Show the city\'s three forecast days in #forecast: day, temperature and condition.',
      hints: ['The record has a `forecast` array. What should each of its items become on the page?',
        'For each day, create a list item with the day, the temperature with its unit and the condition. What must happen to #forecast first, so old days don\'t pile up?',
        'If your drawing function draws the forecast too, every search replaces it. Does yours empty #forecast first?'],
      alt: '`innerHTML` built with `map(...).join("")` and `createElement` + `append` are both fine — the checks only read the page.' },
    { n: 'Celsius ⇄ Fahrenheit', d: '#unit switches every temperature on screen between °C and °F (°F = °C × 9/5 + 32), and back.',
      hints: ['Where will your app remember which unit is chosen?',
        'Pressing #unit flips that choice and draws the current city again. How do you turn a °C number into °F?',
        'One small function that takes a °C number and gives back the text for the chosen unit keeps #temp and the forecast in step. Do both use it?'],
      alt: 'Rounding (`Math.round`) or one decimal both pass — the checks allow half a degree.' },
    { n: 'Edge cases', d: 'Unknown city or empty box: a message in #msg and no stale weather. A new search keeps the chosen unit.',
      hints: ['What should the screen show when nothing in the data matches what was typed?',
        'Write a message into #msg and clear #name, #temp, #cond and #forecast. When should #msg become empty again?',
        'Check for an empty box before searching at all. After a successful search, is the old message cleared?'],
      alt: 'Hiding the result box with a class or emptying each field are both fine.' }
  ],
  checks: CHECKS, html: HTML, css: CSS, files: FILES, prelude, helpers, errorAsk: ERROR_ASK,
  preview: { cities: [
    { city: 'Paris', temp: 18, condition: 'Cloudy', forecast: [{ day: 'Mon', temp: 17, condition: 'Rain' }, { day: 'Tue', temp: 19, condition: 'Sunny' }, { day: 'Wed', temp: 16, condition: 'Cloudy' }] },
    { city: 'Oslo', temp: -2, condition: 'Snow', forecast: [{ day: 'Mon', temp: -4, condition: 'Snow' }, { day: 'Tue', temp: -1, condition: 'Cloudy' }, { day: 'Wed', temp: 0, condition: 'Fog' }] },
    { city: 'Cairo', temp: 31, condition: 'Sunny', forecast: [{ day: 'Mon', temp: 33, condition: 'Sunny' }, { day: 'Tue', temp: 32, condition: 'Windy' }, { day: 'Wed', temp: 30, condition: 'Sunny' }] },
    { city: 'Tokyo', temp: 22, condition: 'Rain', forecast: [{ day: 'Mon', temp: 21, condition: 'Rain' }, { day: 'Tue', temp: 23, condition: 'Cloudy' }, { day: 'Wed', temp: 24, condition: 'Sunny' }] }
  ] },
  approach: APPROACH,
  next: 'Next idea: remember the last city and unit with `localStorage`.',
  win: 'You beat the Final Boss: your weather app finds cities, shows the forecast, switches units and survives bad input — all checked for real.'
};
