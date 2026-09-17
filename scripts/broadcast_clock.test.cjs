// Exercise the actual Broadcast renderer, with a minimal DOM adapter.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    textContent: '', innerHTML: '', childElementCount: 24, children: [],
    classList: { toggle() {}, remove() {} }, style: {},
  });
  return elements.get(id);
}
let render;
const context = {
  window: { ProtokolCore: {
    esc: String, mountCamera() {}, start(fn) { render = fn; },
  } },
  document: { getElementById: element, querySelectorAll() { return []; } },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../overlays/fennec-broadcast/hud.js'), 'utf8'), context);
assert.equal(typeof render, 'function');
const cases = [[65.2, '1:05'], [125.5, '2:05'], [3599.9, '59:59'],
  ['65.2', '1:05'], ['1:05', '1:05'], [0, '0:00'], [-2, '0:00'],
  [null, '--:--'], ['', '--:--'], ['invalid', '--:--']];
let failures = 0;
for (const [value, expected] of cases) {
  render({ snap: { round_time: value, round: 12, ct_score: 8, t_score: 4,
    ct_name: 'TEAM ALPHA', t_name: 'TEAM BRAVO', players: [] },
    ct: [], t: [], focused: null, options: { radar: false } });
  try {
    assert.equal(element('clock').textContent, expected);
    console.log(`PASS ${JSON.stringify(value)} -> ${expected}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${JSON.stringify(value)}: actual=${element('clock').textContent}, expected=${expected}`);
  }
}
console.log(`${cases.length - failures}/${cases.length} passed`);
process.exitCode = failures ? 1 : 0;
