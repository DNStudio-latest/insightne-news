import { db } from "../../lib/db.js";
import { settings, slugify, editorName } from "../../lib/config.js";
import { InfoPage, Email, publisher } from "../info.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ownership and team", alternates: { canonical: "/team" } };

// Who owns and runs the site, and the reporters who write for it (from the Editors list on the approval page).
export default async function TeamPage() {
  const editors = (await db.listEditors().catch(() => [])).filter((e) => e.active && e.name !== publisher.editor);
  return (
    <InfoPage title="Ownership and team">
      <h2>Ownership</h2>
      <p>
        {settings.siteName} is an independent digital news platform based in {publisher.address}, owned by{" "}
        {publisher.owner || editorName}.
      </p>
      <h2>Editor</h2>
      <p>
        <a href={`/author/${slugify(editorName)}`}>{editorName}</a>, Editor. Responsible for all content
        published on {settings.siteName}.
      </p>
      <p>Grievance Officer: {publisher.grievanceOfficer}. See <a href="/grievance">Grievance Redressal</a>.</p>
      {editors.length > 0 && (
        <>
          <h2>Reporters and editors</h2>
          <ul>
            {editors.map((e) => (
              <li key={e.id}>
                <a href={`/author/${slugify(e.name)}`}>{e.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>Contact</h2>
      <p>
        Email: <Email value={publisher.email} />. Want to write for us or send a news tip? See <a href="/tips">Send us a news tip</a>.
      </p>
      <p>
        How we work: <a href="/editorial-policy">Editorial policy</a> · <a href="/ethics">Ethics and fact-checking</a> ·{" "}
        <a href="/corrections">Corrections</a>
      </p>
    </InfoPage>
  );
}
