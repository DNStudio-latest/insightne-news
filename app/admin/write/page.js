import { redirect } from "next/navigation";
import { db } from "../../../lib/db.js";
import { settings, regions } from "../../../lib/config.js";
import { currentRole } from "../../../lib/auth.js";
import StoryEditor from "./StoryEditor.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Write a story", robots: { index: false, follow: false } };

export default async function WritePage({ searchParams }) {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  const { id, error } = await searchParams;
  const story = id ? await db.getStory(String(id)) : null;

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>{story ? "Edit story" : "✍ Write a story"}</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
      {story?.needs_check && story.check_reasons?.length > 0 && (
        <div className="flag">
          <strong>⚠ NEEDS EXTRA CHECK</strong>
          <ul>
            {story.check_reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <StoryEditor
        story={story}
        regions={regions}
        topics={settings.topics}
        defaultAuthor={settings.defaultAuthor}
        role={role}
      />
    </div>
  );
}
