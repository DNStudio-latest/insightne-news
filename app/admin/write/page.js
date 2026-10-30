import { redirect } from "next/navigation";
import { db } from "../../../lib/db.js";
import { settings, regions } from "../../../lib/config.js";
import { currentUser } from "../../../lib/auth.js";
import { SUB_EDITOR } from "../../../lib/staff.js";
import StoryEditor from "./StoryEditor.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Write a story", robots: { index: false, follow: false } };

export default async function WritePage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  const role = user.role;
  const { id, error } = await searchParams;
  const story = id ? await db.getStory(String(id)) : null;
  // Sub-editors may open only the stories they wrote.
  if (role === SUB_EDITOR && story && story.author_id !== user.id) redirect(`/admin?done=${encodeURIComponent("You can edit only your own stories")}`);

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
        defaultAuthor={user.name || settings.defaultAuthor}
        role={role}
        editorsPublish={role === SUB_EDITOR ? settings.subEditors?.canPublish !== false : settings.editors?.canPublish === true}
      />
    </div>
  );
}
