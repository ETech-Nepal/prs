// Marks the identifiers in a FHIR resource so they stand out in the raw JSON view.
// The text is exactly JSON.stringify(resource, null, 2); only the spans differ.
const BY_SYSTEM = {
  'http://mohp.gov.np/fhir/NamingSystem/jempi-golden-uid': 'golden',
  'http://fhir.digitalhealth.gov.np/core/NamingSystem/nepal-health-id': 'hid',
  'http://donidcr.gov.np': 'nid',
  'http://hib.gov.np': 'imis',
  'http://nhfr.digitalhealth.gov.np': 'facility',
  'http://mohp.gov.np/fhir/NamingSystem/nhfr': 'facility',
};
const BY_PREFIX = [
  ['http://mohp.gov.np/fhir/NamingSystem/hospital-mrn', 'mrn'], // + /<NHFR code>
  ['http://nhfr.digitalhealth.gov.np/', 'visit'],               // + <NHFR code>: encounter numbers
];

export const KINDS = { golden: 'Golden ID', hid: 'Health ID', nid: 'National ID', imis: 'IMIS no.', mrn: 'MRN', visit: 'Encounter no.', facility: 'Facility code' };

const kindOf = (system) => BY_SYSTEM[system] || BY_PREFIX.find(([prefix]) => system.startsWith(prefix))?.[1];

// Private-use characters fence the marked strings; JSON.stringify leaves them unescaped.
const fence = (kind, text) => `${kind}${text}`;

// -> [{ text, kind }] in order; kind is null for ordinary JSON.
export function highlight(resource) {
  const json = JSON.stringify(resource, (_key, v) => {
    const kind = typeof v?.system === 'string' && typeof v.value === 'string' && kindOf(v.system);
    return kind ? { ...v, system: fence(`${kind}-system`, v.system), value: fence(kind, v.value) } : v;
  }, 2);
  const parts = json.split(/([a-z-]+)(.*?)/);
  // split() with two groups yields: plain, kind, marked, plain, kind, marked, ... plain
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    out.push({ text: parts[i], kind: null });
    if (i + 1 < parts.length) out.push({ text: parts[i + 2], kind: parts[i + 1] });
  }
  return out;
}
