# Patient Record System: UI

Search a patient by Health ID, National ID or IMIS number, then read their record: demographics,
identifiers, facilities and MRNs, and encounters with diagnoses, observations and lab results.
This is the front end only (React 18 + Vite, plain CSS, no UI library). **Your job: make it look
and feel good.** It works already; the design is a first pass.

## Run it (no backend, no keys, no real data)

```bash
npm install
npm run mock      # terminal 1: fake API on http://localhost:4300, synthetic data
npm run dev       # terminal 2: UI on http://localhost:5173
```

Type these into the search box to see each state:

| Search for | You get |
| --- | --- |
| anything, e.g. `818485780` | one full record (opens directly) |
| `multi` | two matches (a result list) |
| `none` | no match |
| `sparse` | a patient with no name, phone or address and no encounters |
| `partial` | a record where one section failed to load and one was cut at 100 |

Design the empty, sparse, loading and error states too: real records are often like `sparse`.

## What is where

| File | What |
| --- | --- |
| `src/App.jsx` | all screens: nav, search, patient panel, tabs and list, detail |
| `src/prs.css` | all styles, scoped under `.prs` |
| `src/Results.jsx` | lab result rows |
| `src/FhirPanel.jsx`, `src/highlight.js` | the FHIR drawer: raw response with identifiers highlighted, and the requests behind it |
| `src/format.js` | date formatting |
| `src/fhir.js` | FHIR → view-model (the only place that knows FHIR); `npm test` covers it |
| `src/api.js` | the two backend calls; they return the view-model |
| `mock/` | fake backend + synthetic FHIR fixtures; add cases here if you need them |
| `docs/API.md` | the API (it returns **FHIR**) and the view-model the screens get |
| `docs/reference-design.png` | the layout we started from: nav, patient panel, list, detail |

## Rules

* Screens get the view-model (`docs/API.md`), never raw FHIR. A field the view-model lacks is added in
  `src/fhir.js` with a test; a field FHIR lacks, write down and ask. Do not call other URLs.
* No sign-in and no real patient data anywhere in the repo, screenshots or commits. Use the mock only.
* Keep these behaviours: a `partial` or `truncated` record must say so on screen (a silently
  incomplete clinical record is worse than an error); a missing name or field must not break the
  layout; out-of-range lab values are flagged by text as well as colour.
* Works on a laptop first, phone width second (keyboard reachable, readable contrast).
* You may add dependencies if they earn their weight; say which and why.

## Hand it back

Open a pull request on the GitHub repo. Say what you changed and anything you want from the API.
`npm run build` and `npm test` must pass; `dist/` is static and is what gets hosted.
