// Lab / observation results: name, value + unit (flagged when out of range), reference range.
// Out-of-range is colour-coded AND carries the lab's own wording, so meaning does not rely on colour.
export function ResultTable({ results }) {
  if (!results || results.length === 0) return <p className="prs-muted">No results recorded.</p>;
  return <div className="prs-results">{results.map((r, i) => <ResultRow key={i} r={r} />)}</div>;
}

function ResultRow({ r }) {
  const flag = (r.interpretation || '').toLowerCase();
  const cls = flag.includes('high') ? 'high' : flag.includes('low') ? 'low' : flag ? 'abn' : '';
  return (
    <div className="prs-result">
      <div>{r.name}</div>
      <div className={`prs-result-value ${cls}`}>
        {r.value ?? '—'}{r.unit ? ` ${r.unit}` : ''}
        {r.interpretation && <span className="prs-flag">{r.interpretation}</span>}
      </div>
      <div className="prs-muted prs-result-range">{r.referenceRange || ''}</div>
    </div>
  );
}
