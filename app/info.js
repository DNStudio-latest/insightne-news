// Shared layout and contact details for the About / Contact / Privacy / Terms / Grievance pages.
import { settings } from "../lib/config.js";
import { PageShell } from "./components.js";

export const UPDATED = "26 October 2026";
export const publisher = settings.publisher;

export function InfoPage({ title, children }) {
  return (
    <PageShell>
      <div className="page">
        <h1>{title}</h1>
        {children}
        <p className="note" style={{ marginTop: 30 }}>Last updated: {UPDATED}</p>
      </div>
    </PageShell>
  );
}

// Shows an email address, or a clear note if it hasn't been filled in yet in settings.json.
export function Email({ value }) {
  return value ? <a href={`mailto:${value}`}>{value}</a> : <em>(email address to be added)</em>;
}
