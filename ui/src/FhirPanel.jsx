import { useMemo, useRef, useState } from 'react';
import { highlight, KINDS } from './highlight.js';

// Bottom-right drawer for the current screen, side by side: the requests that fetched the data, and the
// FHIR resource exactly as the API sent it, with the identifiers highlighted. Native <details> does the open/close;
// the contents are only built while it is open.
export function FhirPanel({ resource, trace }) {
  const [open, setOpen] = useState(false);
  if (!resource && !trace) return null;
  const label = resource
    ? [resource.resourceType, resource.type, resource.entry && `${resource.entry.length} entries`].filter(Boolean).join(' · ')
    : 'request';
  return (
    <details className="prs-fhir" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>FHIR<span>{label}</span></summary>
      {open && (
        <div className="prs-fhir-body">
          {trace && <div className="prs-fhir-col"><h3>Request</h3><Request trace={trace} /></div>}
          {resource && <div className="prs-fhir-col"><h3>Response</h3><Response resource={resource} /></div>}
        </div>
      )}
    </details>
  );
}

function Response({ resource }) {
  const parts = useMemo(() => highlight(resource), [resource]);
  const counts = useMemo(() => parts.reduce((c, p) => (KINDS[p.kind] ? { ...c, [p.kind]: (c[p.kind] || 0) + 1 } : c), {}), [parts]);
  const pre = useRef(null);
  const seen = useRef({});
  // Each click on a legend chip scrolls to the next identifier of that kind.
  function jump(kind) {
    const marks = pre.current.querySelectorAll(`mark[data-id="${kind}"]`);
    const n = (seen.current[kind] ?? -1) + 1;
    seen.current[kind] = n % marks.length;
    marks[seen.current[kind]].scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  return (
    <>
      {Object.keys(counts).length > 0 && (
        <div className="prs-fhir-legend">
          {Object.entries(KINDS).filter(([k]) => counts[k]).map(([k, name]) => (
            <button key={k} type="button" data-id={k} onClick={() => jump(k)} title={`Show next ${name}`}>{name}<b>{counts[k]}</b></button>
          ))}
        </div>
      )}
      <pre ref={pre} tabIndex={0} aria-label="FHIR JSON">
        {parts.map((p, i) => (p.kind ? <mark key={i} data-id={p.kind} title={KINDS[p.kind]}>{p.text}</mark> : p.text))}
      </pre>
    </>
  );
}

// Two stages: how the patient was found (trace.lookup, if known), then how the record was loaded.
function Request({ trace }) {
  const stages = [['Find the patient', trace.lookup], ['Load the record', trace]].filter(([, t]) => t);
  let step = 0;
  return (
    <div className="prs-fhir-req" tabIndex={0} aria-label="Requests">
      {stages.map(([stage, t]) => (
        <div key={stage}>
          {stages.length > 1 && <h5>{stage}</h5>}
          {[
            ['Browser to the portal API', t.browser ? [t.browser] : []],
            ['Portal API to the HIE (OpenHIM)', t.hie ? [t.hie] : []],
            ['HIE mediator to the FHIR server', (t.fhir || []).map((q) => {
              const [method, ...url] = q.split(' ');
              return { method, url: url.join(' ') };
            })],
          ].filter(([, requests]) => requests.length > 0).map(([title, requests]) => (
            <section key={title}>
              <h4><i>{++step}</i>{title}</h4>
              {requests.map((r, i) => (
                <div key={i}>
                  <div className="prs-fhir-url"><em>{r.method}</em><code>{r.url}</code></div>
                  {r.headers && <pre>{Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>}
                </div>
              ))}
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
