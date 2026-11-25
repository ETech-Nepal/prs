import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { getPatientRecord, searchPatients } from './client.js';

const logger = pino({ level: 'info' });
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(pinoHttp({ logger }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', config.CORS_ORIGIN);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
// No sign-in, so cap how fast anyone can page through patients.
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

function forward(err, res, what) {
  const status = err.response?.status ?? 502;
  logger.error({ status, what, err: err.message }, 'prs upstream failed');
  const body = err.response?.data;
  res.status(status).json({ error: (typeof body === 'object' && body?.error) || 'could not reach the record system' });
}

// The PRS backend is a thin, authenticated pass-through: it signs the OpenHIM call (private_key_jwt + DPoP)
// and returns the FHIR the mediator returns, untouched. Reshaping for screens lives in ui/src/fhir.js.

// GET /prs/search?hid=… | ?nid=… | ?imis=…   (several allowed; results merged)
app.get('/prs/search', async (req, res) => {
  const params = {};
  for (const k of ['hid', 'nid', 'imis']) if (typeof req.query[k] === 'string' && req.query[k].trim()) params[k] = req.query[k].trim();
  if (Object.keys(params).length === 0) return res.status(400).json({ error: 'enter a Health ID, National ID or IMIS number' });
  try { res.type('application/fhir+json').json(await searchPatients(params)); } catch (err) { forward(err, res, 'search'); }
});

app.get('/prs/patients/:id', async (req, res) => {
  try { res.type('application/fhir+json').json(await getPatientRecord(req.params.id)); } catch (err) { forward(err, res, 'record'); }
});

app.listen(config.PORT, () => logger.info(`PRS API listening on :${config.PORT}`));
