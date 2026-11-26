import { useState } from 'react';

// Bottom-right drawer with the FHIR resource behind the current screen, exactly as the API sent it.
// Native <details> does the open/close; the JSON is only built while it is open.
export function FhirPanel({ resource }) {
  const [open, setOpen] = useState(false);
  if (!resource) return null;
  const label = [resource.resourceType, resource.type, resource.entry && `${resource.entry.length} entries`].filter(Boolean).join(' · ');
  return (
    <details className="prs-fhir" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>FHIR<span>{label}</span></summary>
      {open && <pre tabIndex={0} aria-label="FHIR JSON">{JSON.stringify(resource, null, 2)}</pre>}
    </details>
  );
}
