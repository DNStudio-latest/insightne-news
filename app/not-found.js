import { PageShell } from "./components.js";

export default function NotFound() {
  return (
    <PageShell>
      <div className="page" style={{ textAlign: "center", padding: "40px 0" }}>
        <h1>Page not found</h1>
        <p>This page may have moved or been removed.</p>
        <p>
          <a href="/">← Back to the latest news</a>
        </p>
      </div>
    </PageShell>
  );
}
