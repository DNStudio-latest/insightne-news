import { redirect } from "next/navigation";
import { db } from "../../../lib/db.js";
import { currentRole } from "../../../lib/auth.js";
import { formatDate } from "../../../lib/format.js";
import { readSocialLog } from "../../../lib/social.js";
import { checkSocialConnection } from "../actions.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Facebook and Instagram", robots: { index: false, follow: false } };

// What happened to the last Facebook / Instagram posts, and a button that checks the connection step by step.
export default async function SocialAdminPage() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "admin") redirect("/admin"); // admin only
  const [log, check] = await Promise.all([readSocialLog(db), db.getSetting("social_check").catch(() => null)]);

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>📘 Facebook & Instagram</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>

      <form action={checkSocialConnection}>
        <button className="btn btn-approve" type="submit" style={{ width: "100%" }}>CHECK CONNECTION</button>
      </form>
      <p className="hint">Asks Facebook and Instagram, step by step, whether the website can post. Takes up to half a minute.</p>

      {check && (
        <div className="run-box">
          <strong>Last check:</strong> {formatDate(check.at)}
          <ul>
            {check.steps.map((s, i) => (
              <li key={i} style={{ color: s.ok ? undefined : "var(--danger)" }}>
                {s.ok ? "✓" : "✗"} {s.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2>Last posts</h2>
      {log.length === 0 ? (
        <p className="note">No posts recorded yet. Every automatic post and every button post from now on appears here, with the reason if it failed.</p>
      ) : (
        <ul className="src-list">
          {log.map((e, i) => (
            <li key={i}>
              <span>{e.error ? "✗" : "✓"} <b>{e.network}</b> · {formatDate(e.at)} · <a href={`/story/${e.slug}`} target="_blank">{e.headline}</a></span>
              {e.error && <span className="orig" style={{ color: "var(--danger)" }}>Failed: {e.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
