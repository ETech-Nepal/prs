// Synthetic FHIR R4, shaped like what the live PRS API returns (see docs/API.md).
// Used by the mock API and by test/fhir.test.mjs. No real patients.
const HID = 'http://fhir.digitalhealth.gov.np/core/NamingSystem/nepal-health-id';
const MRN = 'http://mohp.gov.np/fhir/NamingSystem/hospital-mrn/';
const NHFR = 'http://nhfr.digitalhealth.gov.np/';
const wrap = (type, resources, extra = {}) => ({
  resourceType: 'Bundle', type, ...extra,
  entry: resources.map((resource) => ({ fullUrl: `${resource.resourceType}/${resource.id}`, resource })),
});

export const patient = (o = {}) => ({
  resourceType: 'Patient', id: 'p-full', active: true, gender: 'female', birthDate: '1990-01-02',
  name: [{ use: 'official', given: ['Sita'], family: 'Rai' }],
  telecom: [{ system: 'phone', value: '9800000000' }],
  address: [{ line: ['Bharatpur-10'], district: 'Chitwan' }],
  identifier: [
    { system: HID, value: 'EL1234567' },
    { system: 'http://donidcr.gov.np', value: '99-88-77' },
    { system: 'http://hib.gov.np', value: '818485780' },
    { system: `${MRN}3130400221`, value: '2480575' },
    { system: `${MRN}3060800011`, value: '26073216' },
  ],
  ...o,
});

const org = (id, name, code) => ({ resourceType: 'Organization', id, name, identifier: [{ system: 'http://mohp.gov.np/fhir/NamingSystem/nhfr', value: code }] });
const ref = (r) => ({ reference: r });
const enc = (id, o) => ({ resourceType: 'Encounter', id, ...o });

const fullRecord = () => [
  patient(),
  org('o-g', 'Shahid Gangalal National Heart Center', '3060800011'),
  org('o-b', 'Bharatpur Hospital', '3130400221'),
  enc('e3', { status: 'arrived', class: { code: 'AMB', display: 'ambulatory' }, type: [{ text: 'INS' }], period: { start: '2026-11-25T00:00:00+05:45' }, serviceProvider: ref('Organization/o-g'), identifier: [{ system: `${NHFR}3060800011`, value: '26073216-20261125' }] }),
  enc('e2', { status: 'finished', class: { code: 'IMP', display: 'inpatient' }, type: [{ text: 'Inpatient' }], reasonCode: [{ text: 'Chest pain' }], period: { start: '2026-03-12T08:30:00Z', end: '2026-03-14T10:00:00Z' }, serviceProvider: ref('Organization/o-g'), identifier: [{ system: `${NHFR}3060800011`, value: 'G-221' }] }),
  enc('e1', { status: 'finished', class: { code: 'AMB', display: 'ambulatory' }, type: [{ text: 'Outpatient' }], reasonCode: [{ text: 'Cough' }], period: { start: '2026-01-05T09:00:00Z', end: '2026-01-05T09:40:00Z' }, serviceProvider: ref('Organization/o-b'), identifier: [{ system: `${NHFR}3130400221`, value: 'B-7' }] }),
  { resourceType: 'Condition', id: 'c2', code: { text: 'Angina pectoris' }, clinicalStatus: { coding: [{ code: 'active' }] }, onsetDateTime: '2026-03-12', encounter: ref('Encounter/e2') },
  { resourceType: 'Condition', id: 'c1', code: { text: 'Bronchitis' }, clinicalStatus: { coding: [{ code: 'active' }] }, onsetDateTime: '2026-01-05', encounter: ref('Encounter/e1') },
  { resourceType: 'Observation', id: 'ob-pulse', code: { text: 'Pulse' }, valueQuantity: { value: 96, unit: 'bpm' }, referenceRange: [{ text: '60 – 100 bpm' }], effectiveDateTime: '2026-03-12', encounter: ref('Encounter/e2') },
  { resourceType: 'Observation', id: 'ob-hb', code: { text: 'Haemoglobin' }, valueQuantity: { value: 9.1, unit: 'g/dL' }, interpretation: [{ coding: [{ display: 'Low' }] }], referenceRange: [{ text: '12 – 16 g/dL' }], effectiveDateTime: '2026-01-05' },
  { resourceType: 'Observation', id: 'ob-wbc', code: { text: 'WBC' }, valueQuantity: { value: 6.2, unit: 'x10^9/L' }, referenceRange: [{ low: { value: 4 }, high: { value: 11 } }], effectiveDateTime: '2026-01-05' },
  { resourceType: 'DiagnosticReport', id: 'r1', status: 'final', code: { text: 'Complete blood count' }, category: [{ text: 'Hematology' }], conclusion: 'Mild anaemia.', issued: '2026-01-05T11:00:00Z', effectiveDateTime: '2026-01-05', encounter: ref('Encounter/e1'), performer: [ref('Organization/o-b')], result: [ref('Observation/ob-hb'), ref('Observation/ob-wbc')] },
  { resourceType: 'DocumentReference', id: 'd1', description: 'Discharge summary', date: '2026-03-14', content: [{ attachment: { contentType: 'application/pdf' } }] },
];

const outcome = (issue) => ({ resourceType: 'OperationOutcome', id: 'outcome', issue });

export const searchBundle = (patients) => wrap('searchset', patients, { total: patients.length });

export const records = {
  'p-full': wrap('collection', fullRecord()),
  'p-second': wrap('collection', [patient({ id: 'p-second', name: [{ use: 'official', given: ['Sita'], family: 'Rai Magar' }], birthDate: '1991-05-20', identifier: [{ system: HID, value: 'EL7654321' }, { system: 'http://hib.gov.np', value: '818485781' }] })]),
  // a record as sparse as real ones: no name, phone, address, nothing clinical
  'p-sparse': wrap('collection', [patient({ id: 'p-sparse', name: undefined, telecom: undefined, address: undefined, gender: 'male', birthDate: '1975-08-09', identifier: [{ system: HID, value: 'EL0000001' }] })]),
  // a section failed and one was cut at 100
  'p-partial': wrap('collection', [
    ...fullRecord().filter((r) => r.resourceType !== 'Condition').map((r) => (r.resourceType === 'Patient' ? patient({ id: 'p-partial', name: [{ use: 'official', given: ['Partial'], family: 'Example' }] }) : r)),
    outcome([
      { severity: 'warning', code: 'incomplete', expression: ['Condition'], diagnostics: 'Condition could not be loaded; this record is incomplete' },
      { severity: 'information', code: 'too-long', expression: ['Encounter'], diagnostics: 'Encounter: only the latest 100 are included' },
    ]),
  ]),
};

export const searches = {
  full: [patient()],
  multi: [patient(), records['p-second'].entry[0].resource],
  none: [],
  sparse: [records['p-sparse'].entry[0].resource],
  partial: [records['p-partial'].entry[0].resource],
};
