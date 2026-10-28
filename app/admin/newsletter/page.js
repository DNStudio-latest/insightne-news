import { redirect } from "next/navigation";
import { db } from "../../../lib/db.js";
import { currentRole } from "../../../lib/auth.js";
import { formatDate, formatDay } from "../../../lib/format.js";
import { topStories } from "../../../lib/top.js";
import { newsletterReady, dailyEmail, FREE_DAILY_LIMIT } from "../../../lib/newsletter.js";
import { sendNewsletter } from "../actions.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Daily email", robots: { index: false, follow: false } };

export default async function NewsletterAdminPage({ searchParams }) {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "admin") redirect("/admin"); // admin only
  const { done } = await searchParams;
  const [subscribers, history, stories] = await Promise.all([db.listSubscribers().catch(() => []), db.lastNewsletters(10).catch(() => []), topStories(db, 5)]);
  const confirmed = subscribers.filter((s) => s.confirmed).length;
  const preview = stories.length ? dailyEmail(stories, { lang: "en", token: "preview", day: formatDay() }) : null;

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>✉ Daily email</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      {done && <div className="notice">{done}</div>}

      {!newsletterReady() && (
        <div className="flag">
          <strong>Not switched on yet.</strong> The sign-up box stays hidden on the website until the two secret settings
          BREVO_API_KEY and NEWSLETTER_FROM are added in Vercel (see docs/4-DAILY-EMAIL.md).
        </div>
      )}

      <div className="run-box">
        <strong>{confirmed}</strong> reader{confirmed === 1 ? "" : "s"} get the daily email · {subscribers.length - confirmed} waiting to confirm ·
        free limit {FREE_DAILY_LIMIT} a day
      </div>

      {preview ? (
        <form action={sendNewsletter} className="editor">
          <h2 style={{ margin: 0 }}>Today's email</h2>
          <p className="hint" style={{ margin: 0 }}>Subject: <b>{preview.subject}</b>. Readers who chose বাংলা get the Bengali headlines.</p>
          <iframe title="Email preview" srcDoc={preview.html} style={{ width: "100%", height: 520, border: "1px solid var(--line)", borderRadius: 8, background: "#fff" }} />
          <label className="check">
            <input type="checkbox" name="checked" required /> I have read the preview
          </label>
          <label className="check">
            <input type="checkbox" name="again" /> Send again even if one was sent in the last 20 hours
          </label>
          <div className="editor-actions">
            <button className="btn btn-approve" type="submit" disabled={!newsletterReady()}>SEND TO {confirmed} READERS</button>
          </div>
        </form>
      ) : (
        <div className="empty">No published stories yet.</div>
      )}

      {history.length > 0 && (
        <div className="run-box">
          <strong>Sent before</strong>
          <ul>
            {history.map((h) => (
              <li key={h.id || h.sent_at}>{formatDate(h.sent_at)} · {h.recipients} readers · {h.subject}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
