// The Final Boss for both languages, against real runs: JavaScript (Weather App) through the real sandbox
// harness and checks, Python (Weather CLI) through the real harness and python3. Correct and alternative
// solutions pass every check; typical mistakes fail exactly where they should; the starter and hardcoded
// answers never win; the explain-first plan gates the code; every mistake tag has a Recovery question.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { LANGS } from '../src/content/languages.js';
import { RECOVERY_BANKS } from '../src/content/recovery.js';
import { runJsProject } from '../src/run/project-js.js';
import { pyProjectHarness, parsePyProject, pyChecks } from '../src/run/project-py.js';
import { reviewApproach } from '../src/learn/approach.js';
import { newAttempt, beginSubmission, explainApproach, startCoding, inPlanning, toSave, fromSave } from '../src/learn/attempt.js';
import { verifyForShip } from '../src/learn/ship.js';
import { seedOf } from '../src/run/seed.js';
import { vmFrame } from './helpers/frame.js';

const jsLv = LANGS.js.levels[7], pyLv = LANGS.py.levels[7];
const js = code => runJsProject(code, jsLv, { seed: seedOf(code), runFrame: vmFrame });
const py = code => {
  const src = pyProjectHarness(code, pyLv.demo, pyChecks(pyLv, seedOf(code)));
  try { return parsePyProject({ stdout: execFileSync('python3', ['-I', '-c', src], { timeout: 5000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), stderr: '' }, pyLv.checks); }
  catch (e) { return parsePyProject({ stdout: e.stdout ?? '', stderr: e.signal ? 'TimeoutError: ran longer than 5 seconds' : e.stderr ?? '' }, pyLv.checks); }
};
const failing = r => r.checks.filter(c => !c.pass).map(c => c.id);
const tagsOf = r => [...new Set(r.checks.flatMap(c => [...(c.tags ?? [])]))];

const JS_GOOD = `const cities = loadWeather();
let unit = "C";
let current = null;
const show = c => unit === "F" ? Math.round(c * 9 / 5 + 32) + "°F" : c + "°C";
function clear() { $("#name").textContent = ""; $("#temp").textContent = ""; $("#cond").textContent = ""; $("#forecast").innerHTML = ""; }
function draw() {
  if (!current) return;
  $("#msg").textContent = "";
  $("#name").textContent = current.city;
  $("#temp").textContent = show(current.temp);
  $("#cond").textContent = current.condition;
  $("#forecast").innerHTML = "";
  for (const d of current.forecast) {
    const li = document.createElement("li");
    li.textContent = d.day + " " + show(d.temp) + " " + d.condition;
    $("#forecast").appendChild(li);
  }
}
$("#search").onclick = () => {
  const typed = $("#city").value.trim().toLowerCase();
  if (!typed) { current = null; clear(); $("#msg").textContent = "Type a city first."; return; }
  current = cities.find(c => c.city.toLowerCase() === typed) || null;
  if (!current) { clear(); $("#msg").textContent = "City not found."; return; }
  draw();
};
$("#unit").onclick = () => { unit = unit === "C" ? "F" : "C"; draw(); };
`;
// Different structure: state object, addEventListener, a counting loop, one-decimal °F, innerHTML + map.
const JS_ALT = `const data = loadWeather();
const state = { f: false, rec: undefined };
const deg = c => state.f ? (c * 1.8 + 32).toFixed(1) + " °F" : c.toFixed(1) + " °C";
function render() {
  const r = state.rec;
  document.querySelector("#name").textContent = r ? r.city : "";
  document.querySelector("#temp").textContent = r ? deg(r.temp) : "";
  document.querySelector("#cond").textContent = r ? r.condition : "";
  document.querySelector("#forecast").innerHTML = r ? r.forecast.map(d => "<li>" + d.day + ": " + deg(d.temp) + ", " + d.condition + "</li>").join("") : "";
}
document.querySelector("#search").addEventListener("click", () => {
  const q = document.querySelector("#city").value.trim();
  let rec;
  for (let i = 0; i < data.length; i++) if (data[i].city.toUpperCase() === q.toUpperCase()) rec = data[i];
  state.rec = q && rec ? rec : undefined;
  document.querySelector("#msg").textContent = !q ? "Please enter a city name" : rec ? "" : "Unknown city: " + q;
  render();
});
document.querySelector("#unit").addEventListener("click", () => { state.f = !state.f; render(); });
`;
const PY_GOOD = `def find_city(data, name):
    key = name.strip().lower()
    for c in data:
        if c["city"].lower() == key:
            return c
    return None


def to_fahrenheit(celsius):
    return celsius * 9 / 5 + 32


def fmt(c, unit):
    return f"{round(to_fahrenheit(c))}°F" if unit == "F" else f"{c}°C"


def report(data, name, unit="C"):
    if not name.strip():
        return "Please enter a city."
    c = find_city(data, name)
    if c is None:
        return f"Unknown city: {name.strip()}"
    return f"{c['city']}: {fmt(c['temp'], unit)}, {c['condition']}"


def forecast(data, name, unit="C"):
    c = find_city(data, name)
    if c is None:
        return []
    return [f"{d['day']}: {fmt(d['temp'], unit)}, {d['condition']}" for d in c["forecast"]]
`;
// Different structure: next() lookup, a shared formatter with one decimal, a loop with append.
const PY_ALT = `def find_city(data, name):
    wanted = name.lower().strip()
    return next((rec for rec in data if rec["city"].lower() == wanted), None)


def to_fahrenheit(celsius):
    return round(celsius * 1.8 + 32, 1)


def temp_text(celsius, unit):
    return str(to_fahrenheit(celsius)) + " °F" if unit.upper() == "F" else str(celsius) + " °C"


def report(data, name, unit="C"):
    if name.strip() == "":
        return "No city entered"
    rec = find_city(data, name)
    if not rec:
        return "City not found: " + name
    return rec["city"] + " - " + temp_text(rec["temp"], unit) + " - " + rec["condition"]


def forecast(data, name, unit="C"):
    rec = find_city(data, name)
    lines = []
    if rec:
        for day in rec["forecast"]:
            lines.append(day["day"] + " " + temp_text(day["temp"], unit) + " " + day["condition"])
    return lines
`;

test('js: the correct solution and a structurally different alternative pass all 14 checks', async () => {
  for (const code of [JS_GOOD, JS_ALT]) {
    const r = await js(code);
    assert.equal(r.error, null); assert.deepEqual(failing(r), []);
    assert.equal(verifyForShip(jsLv, r).ok, true);
  }
});

test('js: four milestones, each with at least three real behavioural checks', () => {
  assert.equal(jsLv.ms.length, 4);
  for (let k = 0; k < 4; k++) assert.ok(jsLv.checks.filter(c => c.ms === k).length >= 3);
});

test('js: the starter, a hardcoded page and typical mistakes never pass — and fail where they should', async () => {
  const starter = await js(jsLv.starter);
  assert.equal(verifyForShip(jsLv, starter).ok, false); assert.equal(starter.checks.filter(c => c.pass).length, 0);
  const hard = await js('$("#name").textContent = "Paris"; $("#temp").textContent = "18°C"; $("#cond").textContent = "Cloudy";');
  assert.equal(verifyForShip(jsLv, hard).ok, false);
  const cases = [
    [JS_GOOD.replace('.trim().toLowerCase()', '').replace('c.city.toLowerCase()', 'c.city'), ['find-ignores-case'], 'case-sensitive'],
    [JS_GOOD.replace('c * 9 / 5 + 32', 'c * 2 + 30'), ['unit-now', 'unit-forecast', 'unit-negative', 'edge-keeps-unit'], 'conversion'],
    [JS_GOOD.replace('if (!current) { clear(); $("#msg").textContent = "City not found."; return; }', 'if (!current) return;'), ['edge-unknown'], 'unknown-city'],
    [JS_GOOD.replace('  $("#forecast").innerHTML = "";\n  for', '  for'), ['forecast-replaced'], 'stale-ui'],
    [JS_GOOD.replace('$("#unit").onclick = () => { unit = unit === "C" ? "F" : "C"; draw(); };', '$("#unit").onclick = () => { unit = unit === "C" ? "F" : "C"; draw(); unit = unit; };').replace('let unit = "C";', 'let unit = "C";\nconst reset = () => { unit = "C"; };').replace('  draw();\n};\n$("#unit")', '  reset(); draw();\n};\n$("#unit")'), ['edge-keeps-unit'], 'unit-reset']
  ];
  for (const [code, mustFail, tag] of cases) {
    const r = await js(code);
    for (const id of mustFail) assert.ok(failing(r).includes(id), `${id} should fail (${failing(r)})`);
    assert.ok(tagsOf(r).includes(tag), `${tag} in ${tagsOf(r)}`);
    assert.equal(verifyForShip(jsLv, r).ok, false);
  }
});

test('js: a loop that never ends while searching is stopped, not a win', async () => {
  const few = { ...jsLv, checks: jsLv.checks.slice(0, 2) };
  const r = await runJsProject(JS_GOOD.replace('draw();\n};\n$("#unit")', 'while (true) {}\n};\n$("#unit")'), few, { seed: 1, runFrame: vmFrame });
  assert.equal(r.timeout, true); assert.equal(verifyForShip(few, r).ok, false);
});

test('py: the correct solution and a structurally different alternative pass all checks with real terminal output', () => {
  for (const code of [PY_GOOD, PY_ALT]) {
    const r = py(code);
    assert.equal(r.error, null, JSON.stringify(r.error)); assert.deepEqual(failing(r), [], JSON.stringify(r.checks.filter(c => !c.pass)));
    assert.equal(verifyForShip(pyLv, r).ok, true);
    assert.match(r.output, /Sample weather \(not live\)/); assert.match(r.output, /Paris/); assert.match(r.output, /Atlantis/);
  }
  assert.match(py(PY_GOOD).output, /Paris: 18°C, Cloudy\n {2}Mon: 17°C, Rain/);
});

test('py: four milestones, each with at least three real behavioural checks', () => {
  assert.equal(pyLv.ms.length, 4);
  for (let k = 0; k < 4; k++) assert.ok(pyLv.checks.filter(c => c.ms === k).length >= 3);
});

test('py: the starter and typical mistakes never pass — and fail where they should', () => {
  const s = py(pyLv.starter);
  assert.equal(verifyForShip(pyLv, s).ok, false); assert.ok(s.checks.filter(c => c.pass).length <= 1);
  const cases = [
    [PY_GOOD.replace('name.strip().lower()', 'name').replace('c["city"].lower()', 'c["city"]'), ['find-ignores-case'], 'case-sensitive'],
    [PY_GOOD.replace('* 9 / 5 + 32', '* 2 + 30'), ['f-formula', 'f-forecast', 'f-negative'], 'conversion'], // (×2+30 equals ×9/5+32 at exactly 10 °C, so a single sampled report can match)
    [PY_GOOD.replace('        return f"Unknown city: {name.strip()}"', '        return ""'), ['report-unknown'], 'unknown-city'],
    [PY_GOOD.replace('for d in c["forecast"]]', 'for d in c["forecast"][:2]]'), ['forecast-three', 'forecast-days'], 'forecast-count'],
    // an empty name answered with some city's weather instead of a message
    [PY_GOOD.replace('        return "Please enter a city."', '        return report(data, data[0]["city"], unit)'), ['report-empty'], 'empty-input'],
    [PY_GOOD.replace('return f"{c[\'city\']}: {fmt(c[\'temp\'], unit)}, {c[\'condition\']}"', 'print(c["city"])'), ['report-line'], 'report-wrong']
  ];
  for (const [code, mustFail, tag] of cases) {
    const r = py(code);
    for (const id of mustFail) assert.ok(failing(r).includes(id), `${id} should fail (${failing(r)})`);
    assert.ok(tagsOf(r).includes(tag), `${tag} in ${tagsOf(r)}`);
    assert.equal(verifyForShip(pyLv, r).ok, false);
  }
  const fixed = py('def find_city(data, name):\n    return {"city": "Paris"}\n\ndef to_fahrenheit(c):\n    return 64.4\n\ndef report(data, name, unit="C"):\n    return "Paris: 18°C, Cloudy"\n\ndef forecast(data, name, unit="C"):\n    return ["Mon: 17°C, Rain", "Tue: 19°C, Sunny", "Wed: 16°C, Cloudy"]\n');
  assert.equal(verifyForShip(pyLv, fixed).ok, false); // fixed answers don't match the generated data
});

test('py: a report that never finishes is stopped and reported as a timeout', () => {
  const r = py(PY_GOOD.replace('def to_fahrenheit(celsius):\n    return', 'def to_fahrenheit(celsius):\n    while True:\n        pass\n    return'));
  assert.equal(r.timeout, true); assert.equal(verifyForShip(pyLv, r).ok, false);
});

for (const [lang, lv] of [['js', jsLv], ['py', pyLv]]) {
  test(`${lang}: explain first — vague plans get one question, a complete plan unlocks coding, and code can't run before`, () => {
    const rules = lv.approach.rules;
    for (const t of ['', 'idk', 'weather app city temp', 'I like pizza and the beach in the summer, honestly it is great.']) assert.equal(reviewApproach({ text: t, answers: [] }, rules).accepted, false, t);
    const partial = reviewApproach({ text: 'I will look through the list of cities to find the one the user typed and then show its temperature and condition on the screen.', answers: [] }, rules);
    assert.equal(partial.accepted, false); assert.equal(partial.rule, 'forecast'); assert.ok(partial.question.endsWith('?'));
    const full = lang === 'js'
      ? 'When Show is pressed I look through the cities to find the one typed, ignoring capitals, and show its temperature and condition plus the three days of forecast. The unit button switches to Fahrenheit with ×9/5+32, and an unknown city or empty box shows a message.'
      : 'find_city loops through the data to find the city ignoring capitals, report returns a line with the temperature and condition, forecast returns the three days, I convert to Fahrenheit with *9/5+32 for unit F, and an unknown city or empty name returns a message.';
    const a = newAttempt(lang, 7, lang + '-2', { workspace: 4, approach: true });
    assert.equal(inPlanning(a), true); assert.equal(beginSubmission(a), null);
    assert.equal(explainApproach(a, full, rules).accepted, true, full);
    assert.ok(beginSubmission(a)); assert.equal(startCoding(a), true); assert.equal(inPlanning(a), false);
    const back = fromSave(JSON.parse(JSON.stringify(toSave(a))), { lang, vault: 7, curriculum: lang + '-2', challenges: 1, workspace: 4, approach: true });
    assert.equal(back.approach.started, true); assert.equal(back.approach.text, full);
  });

  test(`${lang}: every mistake the Final Boss can report has a Recovery question; the boss has its own refreshers`, () => {
    const bank = RECOVERY_BANKS[lang + '-2'];
    const tags = lang === 'py' ? [...new Set(lv.checks.flatMap(c => c.tags()))] : ['city-not-shown', 'temp-wrong', 'condition-wrong', 'case-sensitive', 'stale-ui', 'forecast-count', 'forecast-content', 'unit-not-switched', 'conversion', 'forecast-unit', 'unknown-city', 'empty-input', 'unit-reset'];
    for (const t of [...tags, 'syntax-error', 'loop-timeout']) assert.ok(bank.questions.some(q => q.tags.includes(t)), `${lang}: no question for ${t}`);
    assert.ok(bank.questions.filter(q => q.vault === 7).length >= 3);
  });

  test(`${lang}: the Final Boss is labelled as sample data, never live weather`, () => {
    assert.match(lv.brief, /sample/i); assert.match(lv.url, /sample/i);
    if (lang === 'js') assert.match(lv.html, /SAMPLE DATA · NOT LIVE/); else assert.match(lv.demo, /Sample weather \(not live\)/);
    assert.ok(!/api[_-]?key|fetch\(|https?:\/\//i.test(JSON.stringify(lv.checks.map(c => String(c.run ?? c.py))) + (lv.starter ?? '')));
  });
}
