import { settings } from "../../lib/config.js";
import { InfoPage, publisher } from "../info.js";

export const metadata = { title: "Editorial policy", alternates: { canonical: "/editorial-policy" } };

export default function EditorialPolicyPage() {
  return (
    <InfoPage title="Editorial policy">
      <p>
        This page explains how {settings.siteName} chooses, checks and publishes news. Our editor, {publisher.editor}, is
        responsible for everything we publish.
      </p>
      <h2>Independence</h2>
      <p>
        We decide what to report on news value alone. Advertisers, sponsors, political parties and officials do not decide
        what we publish or how. Sponsored content is always labelled “Sponsored”.
      </p>
      <h2>What we publish</h2>
      <ul>
        <li><strong>Original reports</strong> by our own reporters, with their name shown as the byline (“By …”).</li>
        <li>
          <strong>News briefs</strong>: short summaries, in our own words, of important stories first reported by other
          publishers. Every brief names and links the original publisher. We never copy their articles.
        </li>
        <li><strong>Videos</strong> from our YouTube channel.</li>
      </ul>
      <h2>Checking before publishing</h2>
      <p>
        News collected from other sources is checked by our team before it appears on the site. Stories about violence,
        crime, accidents, religion, communities, elections or rumours get an extra check. We attribute claims to the people
        or institutions who made them, and we do not report unconfirmed information as fact.
      </p>
      <h2>How we use technology and AI</h2>
      <ul>
        <li>
          We use software to collect headlines from other news websites, and AI tools to help draft the first version of some
          brief summaries. Our team reviews summaries before they are published.
        </li>
        <li>Stories in বাংলা, हिन्दी, অসমীয়া and नेपाली may be translated automatically; such stories say “Translated automatically”.</li>
        <li>
          When a story has no real photo, we may show an AI-generated illustration. These are always labelled “AI
          illustration” and never show real people or events.
        </li>
      </ul>
      <h2>Sensitive subjects</h2>
      <p>
        We do not name or show victims of sexual crimes or children involved in crime or tragedy. We report on communities,
        religion and conflict carefully, without language that could spread hatred or panic.
      </p>
      <h2>Mistakes</h2>
      <p>
        When we get something wrong, we correct it openly. See our <a href="/corrections">Corrections policy</a> and our{" "}
        <a href="/ethics">Ethics and fact-checking policy</a>.
      </p>
    </InfoPage>
  );
}
