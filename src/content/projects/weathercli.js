// FINAL BOSS (Python): Weather CLI — a terminal weather report. The map already promised "Boss: Weather CLI",
// so the boss keeps that title. The student writes game-style functions in weather.py; the checks are Python
// snippets run by run/project-py.js (Pyodide in the browser, python3 in the tests) against fresh copies of
// the program, with SAMPLE data generated per run (seeded) so fixed answers fail. The terminal preview prints
// a real report from the student's own functions. `expect(actual, expected, label)` comes from the harness.
import { ERROR_ASK } from './guess.js';

const CITIES = ['Paris', 'Oslo', 'Cairo', 'Tokyo', 'Lima', 'Nairobi', 'Toronto', 'Sydney', 'Madrid', 'Reykjavik'];
const CONDS = ['Sunny', 'Cloudy', 'Rain', 'Snow', 'Windy', 'Fog', 'Storm'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const n = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, list) => list[Math.floor(r() * list.length)];
function cities(r, count, { negative = false } = {}) {
  const pool = [...CITIES], out = [];
  while (out.length < count) {
    const city = pool.splice(Math.floor(r() * pool.length), 1)[0], d0 = n(r, 0, 6), temp = negative && !out.length ? n(r, -12, -1) : n(r, -6, 34);
    out.push({ city, temp, condition: pick(r, CONDS), forecast: [0, 1, 2].map(k => ({ day: DAYS[(d0 + k) % 7], temp: temp + n(r, -4, 4), condition: pick(r, CONDS) })) });
  }
  return out;
}
// Python source for the data (only strings and numbers, so JSON is valid Python) + a temperature reader.
const lit = v => JSON.stringify(v);
const PRE = 'import re as _re\ndef _t(s):\n    return [(float(a), b.upper()) for a, b in _re.findall(r"(-?\\d+(?:\\.\\d+)?)\\s*°?\\s*([CFcf])\\b", str(s))]\n';
const near = (expr, want) => `abs(${expr} - (${want})) <= 0.5`;

const C = (id, ms, py, tag, [ask, ask2]) => ({ id, ms, py, tags: () => [tag], ask, ask2 });
const ASK = {
  find: ['How does `find_city` go through the data, and what does it compare?', 'What should happen to capitals and spaces in the name before you compare it with each city?'],
  missing: ['What should `find_city` give back when no city matches?', 'If the loop finishes without a match, which line runs next?'],
  report: ['Once `report` has the record, which fields go into the line it returns?', 'Does `report` return the text — or only print it?'],
  edge: ['What should `report` say when the city is unknown, or the name is empty?', 'Which check comes first in your `report`: an empty name, or looking the city up?'],
  forecast: ['The record has a "forecast" list. What should each item become in the list `forecast` returns?', 'How many lines does your `forecast` give back for one city?'],
  unit: ['What is 0°C in °F — and does `to_fahrenheit` give the same?', 'Where does `report` use the unit parameter to choose °C or °F?']
};
export const CHECKS = [
  C('find-exact', 0, r => { const d = cities(r, 4), c = d[1].city; return `data = ${lit(d)}\nrec = find_city(data, ${lit(c)})\nexpect(rec["city"] if isinstance(rec, dict) else rec, ${lit(c)}, 'find_city(data, ${lit(c)})["city"]')`; }, 'missing-return', ASK.find),
  C('find-ignores-case', 0, r => { const d = cities(r, 3), c = d[0].city, typed = '  ' + c.toLowerCase() + ' '; return `data = ${lit(d)}\nrec = find_city(data, ${lit(typed)})\nexpect(rec["city"] if isinstance(rec, dict) else rec, ${lit(c)}, 'find_city(data, ${lit(typed)})["city"]')`; }, 'case-sensitive', ASK.find),
  C('find-unknown', 0, r => `data = ${lit(cities(r, 3))}\nexpect(find_city(data, "Atlantis"), None, 'find_city(data, "Atlantis")')`, 'unknown-city', ASK.missing),
  C('report-line', 1, r => { const d = cities(r, 3), c = d[2]; return `${PRE}data = ${lit(d)}\ns = report(data, ${lit(c.city)})\nexpect(isinstance(s, str), True, 'report(data, ${lit(c.city)}) returns text')\nexpect(${lit(c.city)} in s and ${lit(c.condition)} in s, True, 'report(data, ${lit(c.city)}) contains the city and "${c.condition}"')\nexpect([round(v) for v, u in _t(s)][:1] + [u for v, u in _t(s)][:1], [${c.temp}, "C"], 'the temperature in report(data, ${lit(c.city)})')`; }, 'report-wrong', ASK.report),
  C('report-unknown', 1, r => `data = ${lit(cities(r, 3))}\ns = str(report(data, "Atlantis")).lower()\nexpect("unknown" in s or "not found" in s, True, 'report(data, "Atlantis") says the city is unknown')`, 'unknown-city', ASK.edge),
  C('report-empty', 1, r => `${PRE}data = ${lit(cities(r, 3))}\ns = report(data, "   ")\nexpect(isinstance(s, str) and len(s.strip()) > 0 and not _t(s), True, 'report(data, "   ") gives a message, not weather')`, 'empty-input', ASK.edge),
  C('forecast-three', 2, r => { const d = cities(r, 3), c = d[0].city; return `data = ${lit(d)}\nf = forecast(data, ${lit(c)})\nexpect(len(f) if isinstance(f, list) else f, 3, 'len(forecast(data, ${lit(c)}))')`; }, 'forecast-count', ASK.forecast),
  C('forecast-days', 2, r => { const d = cities(r, 3), c = d[1]; return `${PRE}data = ${lit(d)}\nf = forecast(data, ${lit(c.city)})\nrec = ${lit(c)}\nok = isinstance(f, list) and len(f) == 3 and all(x["day"] in str(line) and x["condition"] in str(line) and [round(v) for v, u in _t(line)][:1] == [x["temp"]] for x, line in zip(rec["forecast"], f))\nexpect(ok, True, 'each line of forecast(data, ${lit(c.city)}) has its day, °C temperature and condition')`; }, 'forecast-content', ASK.forecast),
  C('forecast-unknown', 2, r => `data = ${lit(cities(r, 3))}\nexpect(forecast(data, "Atlantis"), [], 'forecast(data, "Atlantis")')`, 'unknown-city', ASK.missing),
  C('f-formula', 3, r => { const cs = [0, 100, -40, n(r, -20, 40)]; return `cs = ${lit(cs)}\nexpect(all(isinstance(to_fahrenheit(c), (int, float)) and ${near('to_fahrenheit(c)', 'c * 9 / 5 + 32')} for c in cs), True, 'to_fahrenheit for ${cs.join(', ')} °C')`; }, 'conversion', ASK.unit),
  C('f-report', 3, r => { const d = cities(r, 3), c = d[1]; const f = c.temp * 9 / 5 + 32; return `${PRE}data = ${lit(d)}\nt = _t(report(data, ${lit(c.city)}, "F"))\nexpect(bool(t) and t[0][1] == "F" and ${near('t[0][0]', f)}, True, 'report(data, ${lit(c.city)}, "F") shows ${Math.round(f)}°F')`; }, 'unit-not-switched', ASK.unit),
  C('f-forecast', 3, r => { const d = cities(r, 3), c = d[2]; return `${PRE}data = ${lit(d)}\nf = forecast(data, ${lit(c.city)}, "F")\nrec = ${lit(c)}\nok = isinstance(f, list) and len(f) == 3 and all(_t(line) and _t(line)[0][1] == "F" and ${near('_t(line)[0][0]', 'x["temp"] * 9 / 5 + 32')} for x, line in zip(rec["forecast"], f))\nexpect(ok, True, 'forecast(data, ${lit(c.city)}, "F") shows every day in °F')`; }, 'forecast-unit', ASK.unit),
  C('f-negative', 3, r => { const d = cities(r, 3, { negative: true }), c = d[0]; const f = c.temp * 9 / 5 + 32; return `${PRE}data = ${lit(d)}\nt = _t(report(data, ${lit(c.city)}, "F"))\nexpect(bool(t) and ${near('t[0][0]', f)}, True, 'report(data, ${lit(c.city)}, "F") for ${c.temp}°C shows ${Math.round(f)}°F')`; }, 'conversion', ASK.unit)
];

export const APPROACH = {
  prompt: 'Before you code the Final Boss, explain your plan: how will your functions find a city in the data, what will the report say, and how do you handle °F and a city that isn\'t there?',
  short: 'Tell me a bit more, in your own words: how will you find the city, what will `report` and `forecast` give back, and what happens with °F and with an unknown city?',
  accepted: 'That\'s a plan: find the city ignoring capitals, return the report and three forecast lines, convert with ×9/5+32 for °F, and answer unknown or empty names. **Coding is unlocked.**',
  rules: [
    { id: 'find', covered: s => /\b(find\w*|look\w* (up|for|through)|search\w*|match\w*|go(es|ing)? through|loop\w*|each|for)\b/i.test(s), question: 'How will `find_city` find the right record in the data?' },
    { id: 'show', covered: s => /\b(return\w*|give\w* back|report|line|text|string|show\w*)\b/i.test(s), question: 'What will `report` give back for a city it found?' },
    { id: 'forecast', covered: s => /\b(forecast|three days|3 days|next days|each day|days)\b/i.test(s), question: 'Each city has a three-day forecast. What will `forecast` give back?' },
    { id: 'unit', covered: s => /\b(fahrenheit|°f|convert\w*|unit|9 ?\/ ?5|1\.8|\+ ?32|celsius)\b/i.test(s), question: 'How do you turn °C into °F — and when does your report use it?' },
    { id: 'edge', covered: s => /\b(unknown|not found|missing|doesn'?t exist|no match|isn'?t there|empty|none|invalid|wrong city)\b/i.test(s), question: 'What should happen when the city isn\'t in the data, or the name is empty?' }
  ]
};

const SAMPLE = [
  { city: 'Paris', temp: 18, condition: 'Cloudy', forecast: [{ day: 'Mon', temp: 17, condition: 'Rain' }, { day: 'Tue', temp: 19, condition: 'Sunny' }, { day: 'Wed', temp: 16, condition: 'Cloudy' }] },
  { city: 'Oslo', temp: -2, condition: 'Snow', forecast: [{ day: 'Mon', temp: -4, condition: 'Snow' }, { day: 'Tue', temp: -1, condition: 'Cloudy' }, { day: 'Wed', temp: 0, condition: 'Fog' }] },
  { city: 'Cairo', temp: 31, condition: 'Sunny', forecast: [{ day: 'Mon', temp: 33, condition: 'Sunny' }, { day: 'Tue', temp: 32, condition: 'Windy' }, { day: 'Wed', temp: 30, condition: 'Sunny' }] }
];

export const WEATHER_CLI = {
  title: 'Weather CLI', file: 'weather.py', cmd: 'pytest weather.py', url: 'python weather.py — terminal (sample data)',
  brief: 'The **Final Boss** of World 1. Write **weather.py**: functions that look up a city in **sample** weather data (not live), report its weather and three-day forecast, convert to °F, and answer cities that aren\'t there. The terminal shows a real report from your functions.',
  starter: '# Weather CLI — the Final Boss. SAMPLE weather (not live) is passed in as `data`:\n# [{"city": "Paris", "temp": 18, "condition": "Cloudy",\n#   "forecast": [{"day": "Mon", "temp": 17, "condition": "Rain"}, ...]}, ...]\n# Temperatures are in °C.\n\ndef find_city(data, name):\n    pass\n\n\ndef to_fahrenheit(celsius):\n    pass\n\n\ndef report(data, name, unit="C"):\n    # e.g. "Paris: 18°C, Cloudy" — or a message for an unknown city or an empty name\n    pass\n\n\ndef forecast(data, name, unit="C"):\n    # e.g. ["Mon: 17°C, Rain", "Tue: 19°C, Sunny", "Wed: 16°C, Cloudy"] — or [] for an unknown city\n    pass\n',
  ms: [
    { n: 'Look up a city', d: 'find_city(data, name) returns the matching record — capitals and spaces don\'t matter — or None.',
      hints: ['`find_city` gets the list and a name. What do you compare for each record?',
        'Make both names lowercase and strip the spaces before comparing. What should come back when the loop finds nothing?',
        'Return the record as soon as it matches; after the loop, return `None`. Does yours do both?'],
      alt: 'A `for` loop with an early `return` and `next((c for c in data if …), None)` are both fine.' },
    { n: 'Weather report', d: 'report() returns one line with the city, its temperature (like 18°C) and condition — or a message for an unknown city or an empty name.',
      hints: ['`report` can use `find_city`. What should it do when that gives back `None`?',
        'Check for an empty name first, then look the city up. An f-string can build the line from the record. Does it `return` the text?',
        'The temperature needs its unit: `f"{...}°C"`. Is every path through `report` ending in a `return`?'],
      alt: 'An f-string, `.format()` or joining pieces with `+` all pass — the checks read the text.' },
    { n: 'Three-day forecast', d: 'forecast() returns three lines — day, temperature and condition — or [] for an unknown city.',
      hints: ['The record\'s "forecast" is a list of three days. What should each one become?',
        'Build a new list: one string per day, in the same order. What does `forecast` return for an unknown city?',
        'A list comprehension or a loop with `.append` both work. Does yours return exactly three lines?'],
      alt: 'A list comprehension and a loop with `append` are equally good.' },
    { n: 'Fahrenheit', d: 'to_fahrenheit(c) = c × 9/5 + 32, and report() / forecast() with unit "F" show °F.',
      hints: ['What is 0°C in °F? And 100°C?',
        '`to_fahrenheit` is one line. Where do `report` and `forecast` use the `unit` parameter to choose?',
        'A small helper that formats one temperature for the chosen unit keeps `report` and `forecast` in step. Do both use it?'],
      alt: 'Rounding with `round()` or keeping one decimal both pass — the checks allow half a degree.' }
  ],
  checks: CHECKS, errorAsk: ERROR_ASK,
  demo: `SAMPLE = ${JSON.stringify(SAMPLE)}\nprint("Sample weather (not live)")\nprint(report(SAMPLE, "Paris"))\nfor line in forecast(SAMPLE, "Paris") or []:\n    print("  " + str(line))\nprint(report(SAMPLE, "oslo", "F"))\nprint(report(SAMPLE, "Atlantis"))`,
  approach: APPROACH,
  next: 'Next idea: read the city from `input()` in a loop until the player types "quit".',
  win: 'You beat the Final Boss: your weather report finds cities, prints the forecast, converts to °F and answers unknown names — all checked for real.'
};
