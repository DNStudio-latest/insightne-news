import { redirect } from "next/navigation";
import { currentRole } from "../../../lib/auth.js";
import { formatDate } from "../../../lib/format.js";
import { regions, states } from "../../../lib/config.js";
import { hunterStore } from "../../../lib/hunter/store.js";
import HunterDraft from "./HunterDraft.js";
import DirectorySearch from "./DirectorySearch.js";
import directory from "../../../hunter-directory.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "News Hunter", robots: { index: false, follow: false } };

const VIEWS = { pending: "Waiting", approved: "Published", rejected: "Rejected" };

export default async function HunterPage({ searchParams }) {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "admin") redirect("/admin"); // admin only
  const params = await searchParams;
  const view = VIEWS[params.view] ? params.view : "pending";
  const [drafts, lastRun] = await Promise.all([hunterStore.listDrafts({ status: view }), hunterStore.lastRun()]);

  // Sorted by state (Tripura first, as in settings), then newest first inside each state.
  const order = ["Northeast", ...states];
  const byState = order.map((state) => [state, drafts.filter((d) => d.state === state)]).filter(([, list]) => list.length);
  const other = drafts.filter((d) => !order.includes(d.state));
  if (other.length) byState.push(["Other", other]);

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>🕵 News Hunter</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>

      <DirectorySearch people={directory.people} websites={directory.websites} />

      <nav className="tabs">
        {Object.entries(VIEWS).map(([key, label]) => (
          <a key={key} href={`/admin/hunter?view=${key}`} aria-current={view === key ? "page" : undefined}>
            {label}
            {key === view ? ` (${drafts.length})` : ""}
          </a>
        ))}
      </nav>

      {params.done && <div className="notice">✓ {params.done}</div>}
      {params.error && <div className="flag">⚠ {params.error}</div>}

      <div className="run-box">
        {lastRun ? (
          <>
            <strong>Last hunt:</strong> {formatDate(lastRun.started_at)} · {lastRun.pages_ok} pages and channels read · {lastRun.items_read} new items read · {lastRun.drafts_created} drafts written
            {lastRun.pages_failed?.length > 0 && (
              <ul>
                {lastRun.pages_failed.map((f) => (
                  <li key={f.url}>Could not read: {f.name} ({f.error})</li>
                ))}
              </ul>
            )}
            {lastRun.error && <ul><li>Problem: {lastRun.error}</li></ul>}
          </>
        ) : (
          "The Hunter has not run yet."
        )}
      </div>
      <p className="note">
        The Hunter checks government websites and official YouTube channels at 2 PM, 6 PM and 9 PM, and writes these drafts.
        Nothing is published until you press APPROVE. Parts marked [CHECK] must be checked against the source and edited before approving.
      </p>

      {drafts.length === 0 && <div className="empty">No drafts here.</div>}
      {byState.map(([state, list]) => (
        <section key={state}>
          <h2 className="section-title">{state} ({list.length})</h2>
          <div className="stories">
            {list.map((d) => (
              <HunterDraft key={d.id} draft={d} view={view} regions={regions} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
