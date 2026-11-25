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
  return data;
}

export const prsApi = {
  // params: one or more of { hid, nid, imis } -> { patients: [...] }
  search: async (params) => ({ patients: patientsFromSearch(await request(`/prs/search?${new URLSearchParams(params)}`)) }),
  // id from a search hit -> the record (view-model, see docs/API.md)
  patient: async (id) => recordFromBundle(await request(`/prs/patients/${encodeURIComponent(id)}`)),
};
