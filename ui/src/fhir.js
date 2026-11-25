// FHIR R4 -> the view-model the screens use. Pure functions, no React, no network.
// The PRS API returns FHIR (docs/API.md); everything the UI knows about FHIR is in this file.
// The shapes this file returns are documented at the bottom of docs/API.md.

const SYS = {
  healthId: 'http://fhir.digitalhealth.gov.np/core/NamingSystem/nepal-health-id',
  nationalId: 'http://donidcr.gov.np',
  imis: 'http://hib.gov.np',
  mrnPrefix: 'http://mohp.gov.np/fhir/NamingSystem/hospital-mrn/', // + NHFR facility code
  nhfrPrefix: 'http://nhfr.digitalhealth.gov.np/',                 // encounter numbers: + NHFR code
};

const resources = (bundle, type) =>
  (bundle?.entry || []).map((e) => e.resource).filter((r) => r?.resourceType === type);
const refId = (ref) => (ref ? String(ref).split('/').pop() : null);
const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
const idOf = (p, system) => (p.identifier || []).find((i) => i.system === system)?.value || null;
const text = (cc) => cc?.text || cc?.coding?.[0]?.display || cc?.coding?.[0]?.code || null;

function formatName(p) {
  const n = (p.name || []).find((x) => x.use === 'official') || p.name?.[0];
  if (!n) return null;
  return n.text || [(n.given || []).join(' '), n.family].filter(Boolean).join(' ').trim() || null;
}

function formatAddress(a) {
  if (!a) return null;
  return a.text || [a.line?.join(', '), a.city, a.district, a.state, a.country].filter(Boolean).join(', ') || null;
}

// facilities: Map of NHFR code -> Organization name, used to name each MRN
export function toPatient(p, facilityNames = new Map()) {
  return {
    id: p.id,
    name: formatName(p),
    gender: p.gender || null,
    birthDate: p.birthDate || null,
    active: p.active !== false,
    phone: (p.telecom || []).find((t) => t.system === 'phone')?.value || null,
    address: formatAddress(p.address?.[0]),
    identifiers: { healthId: idOf(p, SYS.healthId), nationalId: idOf(p, SYS.nationalId), imis: idOf(p, SYS.imis) },
    mrns: (p.identifier || [])
      .filter((i) => i.system?.startsWith(SYS.mrnPrefix))
      .map((i) => {
        const facilityCode = i.system.slice(SYS.mrnPrefix.length);
        return { facilityCode, facilityName: facilityNames.get(facilityCode) || null, mrn: i.value };
      }),
  };
}

// GET /prs/search -> Bundle(searchset) of Patient  ->  [patient]
export function patientsFromSearch(bundle) {
  return resources(bundle, 'Patient').map((p) => toPatient(p));
}

function formatRange(rr) {
  if (!rr) return null;
  // EMRs put filler like "." or "-" where there is no range; show nothing rather than that.
  if (rr.text && /[0-9a-z]/i.test(rr.text)) return rr.text;
  const lo = rr.low?.value, hi = rr.high?.value, unit = rr.low?.unit || rr.high?.unit || '';
  if (lo != null && hi != null) return `${lo} – ${hi} ${unit}`.trim();
  if (lo != null) return `> ${lo} ${unit}`.trim();
  if (hi != null) return `< ${hi} ${unit}`.trim();
  return null;
}

function toResult(o) {
  const q = o.valueQuantity;
  return {
    name: text(o.code) || 'Result',
    value: q?.value ?? o.valueString ?? o.valueCodeableConcept?.text ?? null,
    unit: q?.unit || null,
    interpretation: o.interpretation?.[0]?.coding?.[0]?.display || o.interpretation?.[0]?.coding?.[0]?.code || null,
    referenceRange: formatRange(o.referenceRange?.[0]),
    performer: o.performer?.[0]?.display || null,
    date: o.effectiveDateTime || null,
  };
}

const toCondition = (c) => ({
  id: c.id,
  name: text(c.code) || 'Condition',
  status: c.clinicalStatus?.coding?.[0]?.code || null,
  onset: c.onsetDateTime || c.recordedDate || null,
  date: c.onsetDateTime || c.recordedDate || null,
  encounterId: refId(c.encounter?.reference),
});

// GET /prs/patients/:id -> Bundle(collection)  ->  the record the screens render
export function recordFromBundle(bundle) {
  const orgs = new Map(resources(bundle, 'Organization').map((o) => [`Organization/${o.id}`, o]));
  const orgName = (ref) => ref?.display || orgs.get(ref?.reference)?.name || null;
  // NHFR code -> facility name, from each Organization's identifiers
  const facilityNames = new Map();
  for (const o of orgs.values()) for (const i of o.identifier || []) if (i.value) facilityNames.set(String(i.value), o.name);

  const patientRes = resources(bundle, 'Patient')[0];
  if (!patientRes) throw new Error('record has no Patient');

  const observations = new Map(resources(bundle, 'Observation').map((o) => [`Observation/${o.id}`, o]));
  const reports = resources(bundle, 'DiagnosticReport').map((r) => ({
    id: r.id,
    status: r.status || null,
    code: text(r.code) || 'Report',
    category: text(r.category?.[0]),
    conclusion: r.conclusion || null,
    issued: r.issued || null,
    date: r.effectiveDateTime || r.issued || null,
    encounterId: refId(r.encounter?.reference),
    hospital: orgName(r.performer?.[0]),
    results: (r.result || []).map((x) => observations.get(x.reference)).filter(Boolean).map(toResult),
  })).sort(byDateDesc);

  // Observations no report lists (vitals, bedside readings) hang off their encounter directly.
  const inReports = new Set(resources(bundle, 'DiagnosticReport').flatMap((r) => (r.result || []).map((x) => x.reference)));
  const loose = new Map();
  for (const o of observations.values()) {
    const enc = refId(o.encounter?.reference);
    if (!enc || inReports.has(`Observation/${o.id}`)) continue;
    loose.set(enc, [...(loose.get(enc) || []), toResult(o)]);
  }

  const conditions = resources(bundle, 'Condition').map(toCondition).sort(byDateDesc);
  const encounters = resources(bundle, 'Encounter').map((e) => ({
    id: e.id,
    status: e.status || null,
    visitNumber: (e.identifier || []).find((i) => i.system?.startsWith(SYS.nhfrPrefix))?.value || null,
    class: e.class?.display || e.class?.code || null,
    type: text(e.type?.[0]),
    reason: text(e.reasonCode?.[0]),
    start: e.period?.start || null,
    end: e.period?.end || null,
    date: e.period?.start || null,
    hospital: orgName(e.serviceProvider),
  })).sort(byDateDesc).map((e) => ({
    ...e,
    reports: reports.filter((r) => r.encounterId === e.id),
    diagnoses: conditions.filter((c) => c.encounterId === e.id),
    observations: loose.get(e.id) || [],
  }));

  // OperationOutcome: "incomplete" = HAPI failed to return that type, "too-long" = only the latest page.
  const issues = resources(bundle, 'OperationOutcome').flatMap((o) => o.issue || []);
  const expr = (code) => issues.filter((i) => i.code === code).map((i) => i.expression?.[0]).filter(Boolean);

  return {
    patient: toPatient(patientRes, facilityNames),
    facilities: [...new Set(encounters.map((e) => e.hospital).filter(Boolean))].map((name) => ({ name })),
    encounters,
    conditions,
    reports,
    documents: resources(bundle, 'DocumentReference').map((d) => ({
      id: d.id,
      title: d.description || text(d.type) || 'Document',
      date: d.date || null,
      contentType: d.content?.[0]?.attachment?.contentType || null,
    })).sort(byDateDesc),
    partial: expr('incomplete'),
    truncated: expr('too-long'),
  };
}
