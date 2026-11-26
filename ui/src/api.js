// The only file that talks to the backend. The API returns FHIR; fhir.js turns it into what the
// screens use. See docs/API.md. No sign-in (private deployment).
import { patientsFromSearch, recordFromBundle } from './fhir.js';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4300';

async function request(path) {
  const res = await fetch(`${BASE}${path}`);
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(data?.error || `request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  // What the browser asked, plus what the backend says it asked the HIE (X-HIE-Trace header).
  let upstream = {};
  try { upstream = JSON.parse(decodeURIComponent(res.headers.get('X-HIE-Trace'))) || {}; } catch { /* none sent */ }
  return { data, trace: { browser: { method: 'GET', url: `${BASE}${path}` }, ...upstream } };
}

export const prsApi = {
  // params: one or more of { hid, nid, imis } -> { patients: [...], fhir: the Bundle as received, trace }
  search: async (params) => {
    const { data: fhir, trace } = await request(`/prs/search?${new URLSearchParams(params)}`);
    return { patients: patientsFromSearch(fhir), fhir, trace };
  },
  // id from a search hit -> the record (view-model, see docs/API.md), plus the Bundle as received and the trace
  patient: async (id) => {
    const { data: fhir, trace } = await request(`/prs/patients/${encodeURIComponent(id)}`);
    return { ...recordFromBundle(fhir), fhir, trace };
  },
};
