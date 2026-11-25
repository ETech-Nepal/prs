import { useCallback, useEffect, useMemo, useState } from 'react';
import { prsApi } from './api.js';
import { fmtDate, fmtDateTime } from './format.js';
import { ResultTable } from './Results.jsx';
import './prs.css';

// Patient Record System: search by Health ID / National ID / IMIS number, open a
// record, read it live (every search and open is a fresh read through OpenHIM).
// Layout: nav | patient panel | timeline/lists | detail.

const ICONS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 8a8 8 0 0 1 16 0',
  cal: 'M4 7h16v13H4zM4 11h16M8 4v4m8-4v4',
  pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z',
  building: 'M5 21V5l7-2v18M12 8h7v13M8 9h1m-1 4h1m-1 4h1m6-5h1m-1 4h1M3 21h18',
  chevron: 'm6 9 6 6 6-6',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
};

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
  );
}

export default function App() {
  const [openId, setOpenId] = useState(null);
  const [recent, setRecent] = useState([]); // patients opened this session

  const remember = useCallback((p) => {
    setRecent((r) => [{ id: p.id, name: p.name || 'Unnamed patient' }, ...r.filter((x) => x.id !== p.id)].slice(0, 8));
  }, []);

  return (
    <div className="prs">
      <nav className="prs-nav" aria-label="Main">
        <div className="prs-brand"><span className="prs-mark">+</span><span className="prs-label">PRS</span></div>
        <button className={`prs-navitem ${openId ? '' : 'on'}`} onClick={() => setOpenId(null)}>
          <Icon name="search" /><span className="prs-label">Search</span>
        </button>
        {recent.length > 0 && <div className="prs-navhead prs-label">Recent patients</div>}
        {recent.map((r) => (
          <button key={r.id} className={`prs-navitem ${openId === r.id ? 'on' : ''}`} onClick={() => setOpenId(r.id)} title={r.name}>
            <Icon name="user" /><span className="prs-label">{r.name}</span>
          </button>
        ))}
        <div className="prs-navfoot prs-label">Read-only demo<br />Live data via OpenHIM</div>
      </nav>
      {openId
        ? <Record key={openId} id={openId} onLoaded={remember} />
        : <Search onOpen={setOpenId} />}
    </div>
  );
}

const KINDS = [
  { id: 'any', label: 'Any', keys: ['hid', 'nid', 'imis'] },
  { id: 'hid', label: 'Health ID', keys: ['hid'] },
  { id: 'nid', label: 'National ID', keys: ['nid'] },
  { id: 'imis', label: 'IMIS number', keys: ['imis'] },
];

function Search({ onOpen }) {
  const [kind, setKind] = useState('any');
  const [value, setValue] = useState('');
  const [hits, setHits] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const v = value.trim();
    setError(''); setBusy(true); setHits(null);
    try {
      const params = Object.fromEntries(KINDS.find((k) => k.id === kind).keys.map((k) => [k, v]));
      const r = await prsApi.search(params);
      if (r.patients.length === 1) return onOpen(r.patients[0].id);
      setHits(r.patients);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <main className="prs-search">
      <div className="prs-searchbox">
        <h1>Find a patient</h1>
        <p className="prs-muted">Search by Health ID, National ID or IMIS number.</p>
        <form onSubmit={submit}>
          <div className="prs-seg" role="tablist">
            {KINDS.map((k) => (
              <button type="button" key={k.id} className={kind === k.id ? 'on' : ''} onClick={() => setKind(k.id)}>{k.label}</button>
            ))}
          </div>
          <div className="prs-inputrow">
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter the number exactly as printed"
              autoFocus required minLength={3} maxLength={40} aria-label="Identifier" />
            <button className="prs-btn" disabled={busy || value.trim().length < 3}>{busy ? 'Searching…' : 'Search'}</button>
          </div>
        </form>
        {error && <div className="prs-alert">{error}</div>}
        {hits && hits.length === 0 && <p className="prs-muted">No patient found for “{value.trim()}”.</p>}
        {hits && hits.length > 1 && (
          <div className="prs-hits">
            <h3>{hits.length} patients match</h3>
            {hits.map((p) => (
              <button key={p.id} className="prs-item" onClick={() => onOpen(p.id)}>
                <div className="prs-item-main">
                  <div className="prs-item-title">{p.name || 'Unnamed patient'}</div>
                  <div className="prs-item-sub">{[p.gender, fmtDate(p.birthDate), p.identifiers.healthId && `Health ID ${p.identifiers.healthId}`].filter(Boolean).join(' · ')}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Record ───────────────────────────────────────────────────────────────────

const TABS = ['timeline', 'encounters', 'diagnoses', 'reports', 'documents'];
const KIND_OF = { encounters: 'encounter', diagnoses: 'diagnosis', reports: 'report', documents: 'document' };

function Record({ id, onLoaded }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('timeline');
  const [sel, setSel] = useState(null); // { kind, id }

  const load = useCallback(() => {
    setLoading(true); setError('');
    prsApi.patient(id)
      .then((d) => { setData(d); onLoaded(d.patient); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, onLoaded]);
  useEffect(load, [load]);

  // Everything the record holds, newest first, for the timeline.
  const items = useMemo(() => {
    if (!data) return [];
    return [
      ...data.encounters.map((x) => ({ kind: 'encounter', id: x.id, date: x.date, title: [x.class, x.type].filter(Boolean).join(' · ') || 'Encounter', sub: x.hospital || 'Unknown facility', status: x.status, raw: x })),
      ...data.conditions.map((x) => ({ kind: 'diagnosis', id: x.id, date: x.date, title: x.name, sub: 'Diagnosis', status: x.status, raw: x })),
      ...data.reports.map((x) => ({ kind: 'report', id: x.id, date: x.date, title: x.code, sub: [x.category, x.hospital].filter(Boolean).join(' · ') || 'Report', status: x.status, raw: x })),
      ...data.documents.map((x) => ({ kind: 'document', id: x.id, date: x.date, title: x.title, sub: x.contentType || 'Document', status: null, raw: x })),
    ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [data]);

  if (!data) {
    return (
      <main className="prs-search"><div className="prs-searchbox">
        {error ? <div className="prs-alert">{error}</div> : <p className="prs-muted">Loading record…</p>}
      </div></main>
    );
  }

  const counts = { timeline: items.length, encounters: data.encounters.length, diagnoses: data.conditions.length, reports: data.reports.length, documents: data.documents.length };
  const list = tab === 'timeline' ? items : items.filter((i) => i.kind === KIND_OF[tab]);
  // Open on the newest item so the detail column is never empty.
  const current = (sel && list.find((i) => i.kind === sel.kind && i.id === sel.id)) || list[0];

  return (
    <>
      <PatientPanel p={data.patient} facilities={data.facilities} conditions={data.conditions} />
      <section className="prs-mid">
        <div className="prs-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}<span className="prs-count">{counts[t]}</span>
            </button>
          ))}
          <button className="prs-icon" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh"><Icon name="refresh" size={16} /></button>
        </div>
        {error && <div className="prs-alert">{error}</div>}
        {(data.partial.length > 0 || data.truncated.length > 0) && (
          <div className="prs-alert">
            {data.partial.length > 0 && <>Could not load: {data.partial.join(', ')}. This record is incomplete. </>}
            {data.truncated.length > 0 && <>Showing the latest 100 of: {data.truncated.join(', ')}.</>}
          </div>
        )}
        <div className="prs-list">
          {list.length === 0 && <p className="prs-empty">Nothing recorded.</p>}
          {list.map((i) => (
            <button key={`${i.kind}:${i.id}`} className={`prs-item ${current === i ? 'on' : ''}`} onClick={() => setSel({ kind: i.kind, id: i.id })}>
              <div className="prs-item-main">
                <div className="prs-item-title">{i.title}</div>
                <div className="prs-item-sub">{fmtDate(i.date) || 'No date'}</div>
                <div className="prs-item-sub">{i.sub}</div>
              </div>
              {i.status && <Status value={i.status} />}
            </button>
          ))}
        </div>
      </section>
      <Detail item={current} />
    </>
  );
}

const STATUS_TONE = { finished: 'green', final: 'green', completed: 'green', active: 'green', 'in-progress': 'blue', arrived: 'blue', planned: 'grey', inactive: 'grey', cancelled: 'red', 'entered-in-error': 'red' };
function Status({ value }) {
  return <span className={`prs-status ${STATUS_TONE[value] || 'grey'}`}>{String(value).replace(/-/g, ' ')}</span>;
}

const age = (dob) => {
  const d = new Date(dob);
  return isNaN(d) ? null : Math.floor((Date.now() - d) / 31557600000);
};

function Section({ title, children }) {
  const [on, setOn] = useState(true);
  return (
    <div className="prs-sec">
      <button className="prs-sechead" aria-expanded={on} onClick={() => setOn(!on)}>
        <span className={on ? '' : 'prs-rot'}><Icon name="chevron" size={16} /></span>{title}
      </button>
      {on && <div className="prs-secbody">{children}</div>}
    </div>
  );
}

function Row({ icon, children }) {
  if (!children) return null;
  return <div className="prs-prow"><Icon name={icon} size={16} /><span>{children}</span></div>;
}

function PatientPanel({ p, facilities, conditions }) {
  const a = age(p.birthDate);
  return (
    <aside className="prs-patient">
      <div className="prs-phead">
        <div className="prs-avatar">{(p.name || '?').charAt(0)}</div>
        <div>
          <div className="prs-pname">{p.name || 'Unnamed patient'}</div>
          <div className="prs-psub">{p.birthDate ? fmtDate(p.birthDate) : 'DOB unknown'}</div>
        </div>
      </div>
      <div className="prs-props">
        <Row icon="cal">{p.birthDate ? `${p.birthDate}${a != null ? ` (${a}y)` : ''}` : null}</Row>
        <Row icon="user">{p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : null}</Row>
        <Row icon="pin">{p.address}</Row>
        <Row icon="phone">{p.phone}</Row>
        {!p.active && <Row icon="user">Inactive record</Row>}
      </div>
      <Section title="Identifiers">
        <dl className="prs-dl">
          <div><dt>Health ID</dt><dd className="mono">{p.identifiers.healthId || '—'}</dd></div>
          <div><dt>National ID</dt><dd className="mono">{p.identifiers.nationalId || '—'}</dd></div>
          <div><dt>IMIS no.</dt><dd className="mono">{p.identifiers.imis || '—'}</dd></div>
        </dl>
      </Section>
      <Section title="Facilities">
        {facilities.length === 0 && <p className="prs-muted">No facilities on record.</p>}
        {facilities.map((f) => <div key={f.name} className="prs-fac"><Icon name="building" size={16} />{f.name}</div>)}
        {p.mrns.length > 0 && (
          <dl className="prs-dl">
            {p.mrns.map((m) => <div key={m.facilityCode}><dt>MRN · {m.facilityName || m.facilityCode}</dt><dd className="mono">{m.mrn}</dd></div>)}
          </dl>
        )}
      </Section>
      <Section title="Diagnoses">
        {conditions.length === 0 && <p className="prs-muted">None recorded.</p>}
        {conditions.slice(0, 6).map((c) => (
          <div key={c.id} className="prs-prob"><span>{c.name}</span>{c.status && <Status value={c.status} />}</div>
        ))}
      </Section>
    </aside>
  );
}

// ── Detail ───────────────────────────────────────────────────────────────────

function Detail({ item }) {
  if (!item) {
    return (
      <section className="prs-detail prs-detail-empty">
        <Icon name="pulse" size={28} />
        <p>Select an item to see its details.</p>
      </section>
    );
  }
  const x = item.raw;
  return (
    <section className="prs-detail">
      <header className="prs-dhead">
        <div>
          <h2>{item.title}</h2>
          <p className="prs-muted">{item.sub}{item.date ? ` · ${fmtDate(item.date)}` : ''}</p>
        </div>
        {item.status && <Status value={item.status} />}
      </header>
      {item.kind === 'encounter' && <EncounterDetail e={x} />}
      {item.kind === 'diagnosis' && (
        <dl className="prs-dl prs-dl-wide">
          <div><dt>Status</dt><dd>{x.status || '—'}</dd></div>
          <div><dt>Onset / recorded</dt><dd>{fmtDate(x.date) || '—'}</dd></div>
        </dl>
      )}
      {item.kind === 'report' && (
        <>
          {x.conclusion && <p>{x.conclusion}</p>}
          <h3>Results</h3>
          <ResultTable results={x.results} />
        </>
      )}
      {item.kind === 'document' && (
        <dl className="prs-dl prs-dl-wide">
          <div><dt>Type</dt><dd>{x.contentType || '—'}</dd></div>
          <div><dt>Date</dt><dd>{fmtDate(x.date) || '—'}</dd></div>
        </dl>
      )}
    </section>
  );
}

function EncounterDetail({ e }) {
  return (
    <>
      <dl className="prs-dl prs-dl-wide">
        {e.visitNumber && <div><dt>Encounter no.</dt><dd className="mono">{e.visitNumber}</dd></div>}
        <div><dt>Facility</dt><dd>{e.hospital || 'Unknown facility'}</dd></div>
        <div><dt>Started</dt><dd>{fmtDateTime(e.start) || '—'}</dd></div>
        {e.end && <div><dt>Ended</dt><dd>{fmtDateTime(e.end)}</dd></div>}
        {e.class && <div><dt>Class</dt><dd>{e.class}</dd></div>}
        {e.type && <div><dt>Type</dt><dd>{e.type}</dd></div>}
        {e.reason && <div><dt>Reason</dt><dd>{e.reason}</dd></div>}
      </dl>
      {e.diagnoses.length > 0 && (
        <>
          <h3>Diagnoses</h3>
          <div className="prs-chips">{e.diagnoses.map((d) => <span key={d.id} className="prs-chip">{d.name}</span>)}</div>
        </>
      )}
      {e.observations.length > 0 && (<><h3>Observations</h3><ResultTable results={e.observations} /></>)}
      {e.reports.map((r) => (
        <div key={r.id}>
          <h3>{r.code}{r.status ? ` · ${r.status}` : ''}</h3>
          {r.conclusion && <p className="prs-muted">{r.conclusion}</p>}
          <ResultTable results={r.results} />
        </div>
      ))}
    </>
  );
}
