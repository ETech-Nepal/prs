import test from 'node:test';
import assert from 'node:assert/strict';
import { highlight } from '../src/highlight.js';
import { records } from '../mock/fixtures.mjs';

test('highlighting leaves the JSON as it is and marks each identifier by its system', () => {
  const golden = { resourceType: 'Patient', identifier: [{ system: 'http://mohp.gov.np/fhir/NamingSystem/jempi-golden-uid', value: 'a"b\\c' }] };
  const bundle = { ...records['p-full'], entry: [...records['p-full'].entry, { resource: golden }] };
  const parts = highlight(bundle);
  assert.equal(parts.map((p) => p.text).join(''), JSON.stringify(bundle, null, 2));
  const marked = (kind) => parts.filter((p) => p.kind === kind).map((p) => p.text);
  assert.deepEqual(marked('hid'), ['EL1234567']);
  assert.deepEqual(marked('imis'), ['818485780']);
  assert.deepEqual(marked('mrn'), ['2480575', '26073216']);
  assert.deepEqual(marked('visit'), ['26073216-20261125', 'G-221', 'B-7']);
  assert.deepEqual(marked('facility'), ['3060800011', '3130400221']);
  assert.deepEqual(marked('golden'), [JSON.stringify('a"b\\c').slice(1, -1)]);
});
