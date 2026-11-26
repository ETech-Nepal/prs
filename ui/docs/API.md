# PRS API

The UI calls two read-only endpoints on the PRS backend (`VITE_API_BASE`, default
`http://localhost:4300`). **They return FHIR R4**, exactly as HAPI holds it. Nothing is reshaped
on the server. Turning FHIR into what the screens show is the UI's job, and all of it is in one
file: `src/fhir.js` (pure functions, tested by `npm test`).

```
browser ──► PRS backend (signs the call) ──► OpenHIM /prs/* ──► patient-portal mediator ──► HAPI (FHIR)
              passes FHIR through              auth + audit        reads HAPI, bundles it      the data
```

* **Designers** change `App.jsx`, `prs.css`, `Results.jsx`. They never touch FHIR: the components
  receive the view-model at the bottom of this file.
* **To show a new field**, read it in `src/fhir.js`, add it to the view-model, add a test, then use it in a component.
* **No sign-in.** Anyone who can reach the backend can read patients. Private by hostname only.

Both calls also send an `X-HIE-Trace` response header (URL-encoded JSON) for the "Request" view in the
FHIR drawer: `{ "hie": { "method", "url", "headers" }, "fhir": ["GET <FHIR query>", ...] }`.
Credentials in `headers` are placeholders, never real values. The header may be missing.

Errors are not FHIR: `{ "error": "message" }` with status 400 (bad input), 404 (no such patient) or 502 (upstream failed).
Responses use `Content-Type: application/fhir+json`.

## `GET /prs/search?hid=…&nid=…&imis=…`

One or more of `hid` (Health ID), `nid` (National ID), `imis` (IMIS / insurance number); 3 to 40
letters, digits, `.` `_` `-`. Hits from several parameters are merged. A patient that was merged into
another is replaced by the surviving record.

Returns a `Bundle` of type `searchset` whose entries are `Patient` resources (`total` = count).
Identifier systems the UI reads:

| What | `Patient.identifier.system` |
| --- | --- |
| Health ID | `http://fhir.digitalhealth.gov.np/core/NamingSystem/nepal-health-id` |
| National ID | `http://donidcr.gov.np` |
| IMIS number | `http://hib.gov.np` |
| MRN at one hospital | `http://mohp.gov.np/fhir/NamingSystem/hospital-mrn/<NHFR facility code>` |

## `GET /prs/patients/:id`

`:id` is `Patient.id` from a search hit. Returns a `Bundle` of type `collection` holding:

| Resource | Notes |
| --- | --- |
| `Patient` | exactly one |
| `Encounter` | the latest 100, newest first. `serviceProvider` → an `Organization` below. Encounter number: `identifier` with system `http://nhfr.digitalhealth.gov.np/<code>` |
| `Condition` | diagnoses; `encounter` links one to its encounter |
| `DiagnosticReport` | `result` → `Observation`s below; `encounter` links it |
| `Observation` | lab results and vitals; vitals have `encounter` and are in no report |
| `DocumentReference` | documents |
| `Organization` | the facilities the above point at (`name`, and `identifier` = NHFR code) |
| `OperationOutcome` | **only when the record is not the whole story** (below) |

**The `OperationOutcome` must be shown to the user.** A clinical record that is silently incomplete is worse than an error.

| `issue.code` | `issue.expression[0]` | Meaning |
| --- | --- | --- |
| `incomplete` | resource type, e.g. `Condition` | HAPI failed to return that type: there is a hole in this record |
| `too-long` | resource type, e.g. `Encounter` | more than 100 exist; only the latest 100 are included |

Real data is sparse: no name, no phone, no encounter reason, no diagnoses, no reports. Today's live
records usually have only demographics and encounters. Every screen must cope.

## View-model (what `src/fhir.js` returns to the components)

`prsApi.search(params)` → `{ patients: Patient[] }`, `prsApi.patient(id)` → `Record`.

```jsonc
// Patient
{ "id": "…", "name": "Sita Rai"|null, "gender": "female"|null, "birthDate": "1990-01-02"|null, "active": true,
  "phone": null, "address": null,
  "identifiers": { "healthId": "…"|null, "nationalId": null, "imis": null },
  "mrns": [ { "facilityCode": "3130400221", "facilityName": "Bharatpur Hospital"|null, "mrn": "2480575" } ] }

// Record
{ "patient": Patient,
  "facilities": [ { "name": "…" } ],
  "encounters": [ { "id", "status", "visitNumber", "class", "type", "reason", "start", "end", "date", "hospital",
                    "diagnoses": [Condition], "observations": [Result], "reports": [Report] } ],
  "conditions": [ { "id", "name", "status", "onset", "date", "encounterId" } ],
  "reports":    [ { "id", "status", "code", "category", "conclusion", "issued", "date", "encounterId", "hospital", "results": [Result] } ],
  "documents":  [ { "id", "title", "date", "contentType" } ],
  "partial":   ["Condition"],     // from OperationOutcome: show "this record is incomplete"
  "truncated": ["Encounter"] }    // from OperationOutcome: show "latest 100 only"

// Result
{ "name", "value", "unit", "interpretation": "Low"|null, "referenceRange", "performer", "date" }
```

Any field may be `null`. Dates are ISO strings. `status` values are FHIR codes
(`planned`, `arrived`, `in-progress`, `finished`, `cancelled`, `active`, `final` …).
