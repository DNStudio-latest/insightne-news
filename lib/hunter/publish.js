// Turns an approved News Hunter draft into a story on the website. Used by the APPROVE button
// (app/admin/actions.js) and by automatic publishing (app/api/hunter-publish/route.js).
import { settings } from "../config.js";

export async function publishHunterDraft({ db, hunterStore, draft, shot = null, auto = false }) {
  const paragraphs = draft.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // Link to the original PDF, page or video at the bottom of the story.
  const sourceLines = draft.sources.map((s) => `Source: ${s.name}, ${s.url}`);
  const image_url = shot?.proof ? await db.uploadImage(await hunterStore.readProof(shot.proof), "image/webp") : null;
  const storyId = await db.createStory(
    {
      kind: "original",
      status: "approved",
      auto_published: auto,
      image_url,
      image_caption: shot ? `Screenshot of the official page: ${shot.name}` : null,
      image_credit: shot ? shot.name : null,
      headline: draft.headline,
      summary: paragraphs[0].slice(0, 600),
      body: [...paragraphs.slice(1), ...sourceLines].join("\n\n"),
      region: draft.state,
      topic: draft.topic,
      author: settings.defaultAuthor,
      published_at: new Date().toISOString(),
      score: draft.score,
      needs_check: false,
      check_reasons: [],
    },
    draft.sources.map((s) => ({ source_name: s.name, url: s.url, original_title: s.title || null })),
  );
  await hunterStore.updateDraft(draft.id, { status: "approved", story_id: storyId });
  return storyId;
}
