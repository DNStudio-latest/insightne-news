// The daily email: sign up, confirm (from the link in the email) and unsubscribe.
// Confirming and unsubscribing need a button press, so email apps that open links by themselves can't do it.
import { settings } from "../../lib/config.js";
import { newsletterReady } from "../../lib/newsletter.js";
import { initLang, lang } from "../../lib/lang.js";
import { PageShell, SectionHead } from "../components.js";
import { NewsletterSignup } from "../client.js";
import { confirmSubscription, unsubscribe } from "./actions.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily email", alternates: { canonical: "/newsletter" } };

const DONE = {
  confirmed: "✓ Thank you! You will get the top stories by email every day.",
  unsubscribed: "✓ You are unsubscribed. You will not get any more emails from us.",
  missing: "This link has expired or was already used. You can sign up again below.",
};

export default async function NewsletterPage({ searchParams }) {
  await initLang();
  const { confirm, unsubscribe: unsub, done } = await searchParams;
  const token = String(confirm || unsub || "");
  return (
    <PageShell current="Newsletter">
      <div className="page" style={{ maxWidth: 640 }}>
        <SectionHead title="Daily email" />
        {DONE[done] && <div className="notice">{DONE[done]}</div>}
        {confirm ? (
          <form action={confirmSubscription}>
            <input type="hidden" name="token" value={token} />
            <p>Tap the button to confirm that you want the daily email from {settings.siteName}.</p>
            <button className="btn btn-approve" type="submit">YES, CONFIRM</button>
          </form>
        ) : unsub ? (
          <form action={unsubscribe}>
            <input type="hidden" name="token" value={token} />
            <p>Tap the button to stop getting emails from {settings.siteName}.</p>
            <button className="btn btn-reject" type="submit">UNSUBSCRIBE</button>
          </form>
        ) : (
          <>
            <p>
              Get the day's top 5 stories from the eight states of Northeast India in your inbox, once a day. It's free, and you can
              unsubscribe with one click at any time. We never share your email address.
            </p>
            {newsletterReady() ? <NewsletterSignup lang={lang()} /> : <p className="note">The daily email is coming soon.</p>}
          </>
        )}
      </div>
    </PageShell>
  );
}
