// Module worker for JavaScript observation runs. Tells the page it's ready (so module loading isn't counted
// against the student's time limit), runs one job, and is then terminated by run/js-runner.js.
import { jsObserve } from './js-observe.js';

postMessage({ ready: true });
onmessage = e => {
  let r;
  try { r = jsObserve(e.data.code, e.data.spec); }
  catch (x) { r = { loadError: { message: String(x) }, globals: {}, calls: [], logs: [], callLogs: [] }; }
  try { postMessage(r); }
  catch (x) { postMessage({ loadError: { message: 'The result could not be read' }, globals: {}, calls: [], logs: r.logs || [], callLogs: [] }); }
};
