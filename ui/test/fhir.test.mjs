import test from 'node:test';
import assert from 'node:assert/strict';
import { patientsFromSearch, recordFromBundle } from '../src/fhir.js';
import { records, searchBundle, searches } from '../mock/fixtures.mjs';

test('search bundle -> patients with identifiers and per-facility MRNs', () => {
  const [p] = patientsFromSearch(searchBundle(searches.full));
  assert.equal(p.name, 'Sita Rai');
  assert.deepEqual(p.identifiers, { healthId: 'EL1234567', nationalId: '99-88-77', imis: '818485780' });
  assert.deepEqual(p.mrns.map((m) => [m.facilityCode, m.mrn]), [['3130400221', '2480575'], ['3060800011', '26073216']]);
  assert.equal(p.address, 'Bharatpur-10, Chitwan');
  assert.equal(patientsFromSearch(searchBundle([])).length, 0);
});

test('full record: encounters newest first with facility, diagnoses, loose observations and reports', () => {
  const r = recordFromBundle(records['p-full']);
  assert.deepEqual(r.encounters.map((e) => e.id), ['e3', 'e2', 'e1']);
  const [e3, e2, e1] = r.encounters;
  assert.equal(e3.hospital, 'Shahid Gangalal National Heart Center');
  assert.equal(e3.visitNumber, '26073216-20261125');
  assert.equal(e3.class, 'ambulatory');
  assert.equal(e3.type, 'INS');
  assert.equal(e3.reason, null);
  assert.deepEqual(e2.diagnoses.map((d) => d.name), ['Angina pectoris']);
  assert.deepEqual(e2.observations.map((o) => o.name), ['Pulse']);     // not in a report -> on the encounter
  assert.deepEqual(e1.reports[0].results.map((x) => x.name), ['Haemoglobin', 'WBC']);
  assert.equal(e1.reports[0].results[0].interpretation, 'Low');
  assert.equal(e1.reports[0].results[1].referenceRange, '4 – 11');
  assert.deepEqual(e1.observations, []);                                // report results are not repeated as loose
  assert.deepEqual(r.facilities.map((f) => f.name), ['Shahid Gangalal National Heart Center', 'Bharatpur Hospital']);
  assert.deepEqual(r.patient.mrns.map((m) => m.facilityName), ['Bharatpur Hospital', 'Shahid Gangalal National Heart Center']);
  assert.equal(r.documents[0].title, 'Discharge summary');
  assert.deepEqual([r.partial, r.truncated], [[], []]);
});

test('sparse record does not break: no name, no clinical data', () => {
  const r = recordFromBundle(records['p-sparse']);
  assert.equal(r.patient.name, null);
  assert.equal(r.patient.phone, null);
  assert.deepEqual([r.encounters, r.conditions, r.reports, r.documents], [[], [], [], []]);
});

test('OperationOutcome becomes partial / truncated', () => {
  const r = recordFromBundle(records['p-partial']);
  assert.deepEqual(r.partial, ['Condition']);
  assert.deepEqual(r.truncated, ['Encounter']);
});

test('a bundle with no Patient is an error, not an empty screen', () => {
  assert.throws(() => recordFromBundle({ resourceType: 'Bundle', entry: [] }), /no Patient/);
});
