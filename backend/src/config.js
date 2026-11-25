import 'dotenv/config';
import { z } from 'zod';

// PRS demo server: no patient/OTP/Redis config, and no sign-in. Whoever can reach the
// URL can read patient records, so deploy it on an unguessable hostname and take it
// down after the demo.
const schema = z.object({
  PORT: z.coerce.number().default(4300),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  OPENHIM_TX_URL: z.string().url(),            // e.g. http://openhim-core:5001 (inside the openhim network)
  OPENHIM_PUBLIC_BASE_URL: z.string().url(),   // PUBLIC_BASE_URL of the stack; DPoP proofs name it
  OPENHIM_TRUST_SELF_SIGNED: z.enum(['true', 'false', '1', '0']).default('false').transform((s) => s === 'true' || s === '1'),
  KEYCLOAK_TOKEN_URL: z.string().url(),
  KEYCLOAK_ISSUER: z.string().url(),
  PRS_CLIENT_ID: z.string().default('prs-portal'),
  PRS_CLIENT_KEY_PATH: z.string().default('/run/secrets/prs-portal.key.pem'),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().default(30000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid env config:', parsed.error.format());
  process.exit(1);
}
export const config = parsed.data;
