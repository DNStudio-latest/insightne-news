import { settings } from "../../lib/config.js";
import { InfoPage, Email, publisher } from "../info.js";

export const metadata = { title: "Corrections policy", alternates: { canonical: "/corrections" } };

export default function CorrectionsPage() {
  return (
    <InfoPage title="Corrections policy">
      <p>{settings.siteName} works hard to be accurate. When we make a mistake, we want to fix it quickly and openly.</p>
      <h2>How to tell us about a mistake</h2>
      <p>
        Email <Email value={publisher.email} /> with the link to the story and what you believe is wrong. If you can, include
        a source that shows the correct information.
      </p>
      <h2>What we do</h2>
      <ul>
        <li>We review every report, normally within 48 hours.</li>
        <li>If a fact is wrong, we correct the story and add a note at the end saying what was changed and when.</li>
        <li>Small fixes such as spelling or grammar are made without a note.</li>
        <li>If a story is seriously wrong or unfair, we may remove it and explain why.</li>
        <li>People or organisations named in a story who believe it is unfair can ask for their response to be added.</li>
      </ul>
      <h2>Translations</h2>
      <p>
        Stories in other languages may be translated automatically. If a translation is wrong, tell us and we will fix it.
        The English version is the original.
      </p>
      <h2>Formal complaints</h2>
      <p>
        If you are not satisfied with our answer, you can contact our Grievance Officer. See{" "}
        <a href="/grievance">Grievance Redressal</a>.
      </p>
    </InfoPage>
  );
}
