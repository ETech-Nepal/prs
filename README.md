# Patient Record System (PRS)

Search a patient by Health ID, National ID or IMIS number and read their record with encounters,
live from the HIE. Staff-facing, read-only, **no sign-in** (private by hostname; demo only).

```
browser ──► ui/ (React) ──► backend/ ──► OpenHIM /prs/* ──► patient-portal mediator ──► HAPI (FHIR)
                            signs the call,   auth + audit    reads HAPI, bundles it
                            passes FHIR on
```

| Folder | What | Who works on it |
| --- | --- | --- |
| `ui/` | the screens, a mock API and the FHIR→screen adapter. Runs alone with `npm run mock` + `npm run dev`. See `ui/README.md` | the UI team |
| `backend/` | ~100 lines: signs the OpenHIM call as Keycloak client `prs-portal` (private_key_jwt + DPoP) and returns the mediator's FHIR untouched | us |
| `docker-compose.yml` | runs both on the VPS | us |

The API returns **FHIR R4** (`ui/docs/API.md` is the contract). The server side that builds those
Bundles is the `/prs` routes of `openhie/services/patient-portal-mediator`.

## Host it (etech-vm1)

1. `openhim_single`: onboard the client (`./scripts/onboard-client.sh prs-portal "PRS staff portal BFF" prs-portal`) and deploy the mediator image that has `/prs`.
2. `cp backend/.env.example backend/.env` and fill in the hostnames and URLs; set `VITE_API_BASE` in `.env`.
3. `docker compose up -d --build`
4. `caddy_vps/.env`: set `PRS_HOST` and `PRS_API_HOST` to unguessable names, then `docker compose up -d` there.
5. **After the demo:** `docker compose down` here, remove the two hostnames from `caddy_vps/.env`, `docker compose up -d` there.

Anyone with the URL can read real patient records and the API is rate-limited to 60 requests a minute
per address: share the hostnames only with the demo audience.
