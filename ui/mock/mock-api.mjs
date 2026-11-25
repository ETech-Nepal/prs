// Stand-in for the PRS backend so the UI can be built with no stack, no key and no real
// patients. Same routes and FHIR responses as the live API (docs/API.md). All data is synthetic.
//   npm run mock          -> http://localhost:4300
// Search values that trigger cases:  multi (2 hits) · none (0 hits) · sparse (only demographics,
// no name) · partial (a section failed + a section truncated) · anything else (full record).
import http from 'node:http';
import { records, searchBundle, searches } from './fixtures.mjs';

function search(q) {
  const v = [q.get('hid'), q.get('nid'), q.get('imis')].find(Boolean) || '';
  return searches[Object.keys(searches).find((k) => v.includes(k)) || 'full'];
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/fhir+json');
  const send = (code, body) => { res.statusCode = code; res.end(JSON.stringify(body)); };
  if (url.pathname === '/prs/search') {
    if (!['hid', 'nid', 'imis'].some((k) => url.searchParams.get(k))) return send(400, { error: 'one of hid, nid, imis is required' });
    return setTimeout(() => send(200, searchBundle(search(url.searchParams))), 250);
  }
  const m = url.pathname.match(/^\/prs\/patients\/(.+)$/);
  if (m) return setTimeout(() => (records[m[1]] ? send(200, records[m[1]]) : send(404, { error: 'patient not found' })), 250);
  send(404, { error: 'not found' });
}).listen(4300, () => console.log('PRS mock API on http://localhost:4300 (search values: multi, none, sparse, partial)'));
