import { settings } from "../../lib/config.js";
import { InfoPage } from "../info.js";

export const metadata = { title: "Ethics and fact-checking policy", alternates: { canonical: "/ethics" } };

export default function EthicsPage() {
  return (
    <InfoPage title="Ethics and fact-checking policy">
      <p>These are the standards every person who writes or edits for {settings.siteName} follows.</p>
      <h2>Accuracy</h2>
      <ul>
        <li>We check facts with reliable sources before publishing, and we say where information comes from.</li>
        <li>
          We do not publish rumours, viral messages or social media claims as facts. If we report a claim, we say who made it
          and whether it has been confirmed.
        </li>
        <li>Numbers, names, places and quotes are checked against the original source.</li>
      </ul>
      <h2>Fairness</h2>
      <ul>
        <li>When a story makes serious claims about a person or group, we try to get their side before publishing.</li>
        <li>We separate news from opinion. Opinion is clearly labelled.</li>
        <li>We avoid language that stereotypes or targets any community, religion, caste, tribe, gender or region.</li>
      </ul>
      <h2>Photos and videos</h2>
      <ul>
        <li>We use our own photos and videos, or ones we have permission to use, and we credit them.</li>
        <li>We do not alter real photos in ways that change their meaning.</li>
        <li>AI-generated illustrations are always labelled and never pretend to show real people or events.</li>
      </ul>
      <h2>Privacy and harm</h2>
      <ul>
        <li>We do not identify victims of sexual crimes, or children involved in crime, accidents or tragedy.</li>
        <li>We are careful when reporting suicide, violence and disasters, and we avoid graphic details.</li>
      </ul>
      <h2>Conflicts of interest</h2>
      <p>
        Our reporters and editors do not accept money or gifts in exchange for coverage, and they tell the editor about any
        personal connection to a story.
      </p>
      <h2>Mistakes</h2>
      <p>
        If we get it wrong, we correct it. See our <a href="/corrections">Corrections policy</a>.
      </p>
    </InfoPage>
  );
}
