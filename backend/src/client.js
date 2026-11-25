import axios from 'axios';
import https from 'node:https';
import { config } from './config.js';
import { createServiceToken } from './serviceToken.js';

// Staff PRS reads go to OpenHIM's /prs channel as the Keycloak client `prs-portal`
// (private_key_jwt + DPoP; OpenHIM accepts nothing else). The browser never sees it.
const client = axios.create({
  baseURL: config.OPENHIM_TX_URL,
  timeout: config.UPSTREAM_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
  httpsAgent: config.OPENHIM_TRUST_SELF_SIGNED ? new https.Agent({ rejectUnauthorized: false }) : undefined,
});

const authHeaders = createServiceToken({
  tokenUrl: config.KEYCLOAK_TOKEN_URL,
  audience: config.KEYCLOAK_ISSUER,
  clientId: config.PRS_CLIENT_ID,
  keyPath: config.PRS_CLIENT_KEY_PATH,
});

// OpenHIM checks the DPoP proof's htu against its public URL, not the internal one used here.
client.interceptors.request.use(async (cfg) => {
  const url = `${config.OPENHIM_PUBLIC_BASE_URL.replace(/\/$/, '')}${cfg.url}`;
  Object.assign(cfg.headers, await authHeaders(cfg.method ?? 'get', url));
  return cfg;
});

// OpenHIM unwraps the mediator envelope only when the reply is application/json+openhim;
// unwrap here too so a lost header shows data instead of blank screens.
client.interceptors.response.use((res) => {
  const d = res.data;
  if (d && typeof d === 'object' && d['x-mediator-urn'] && d.response) {
    const body = d.response.body;
    res.data = typeof body === 'string' ? JSON.parse(body) : body;
  }
  return res;
});


// `params` holds one of { hid, nid, imis }.
export async function searchPatients(params) {
  const { data } = await client.get('/prs/search', { params, headers: { 'X-PRS-User': 'demo' } });
  return data;
}

export async function getPatientRecord(id) {
  const { data } = await client.get(`/prs/patients/${encodeURIComponent(id)}`, { headers: { 'X-PRS-User': 'demo' } });
  return data;
}
