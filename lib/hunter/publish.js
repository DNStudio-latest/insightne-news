// Turns an approved News Hunter draft into a story on the website. Used by the APPROVE button
// (app/admin/actions.js) and by automatic publishing (app/api/hunter-publish/route.js).
import { settings } from "../config.js";
import { PROOF_CAPTION } from "../proof-shot.js";

export async function publishHunterDraft({ db, hunterStore, draft, shot = null, auto = false }) {
  const paragraphs = draft.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // Link to the original PDF, page or video at the bottom of the story.
  const sourceLines = draft.sources.map((s) => `Source: ${s.name}, ${s.url}`);
  // The screenshot of the official page is kept inside the story as proof (see lib/proof-shot.js), not as its main
  // picture: the AI illustration added after publishing is the picture on the front page.
  const shotUrl = shot?.proof ? await db.uploadImage(await hunterStore.readProof(shot.proof), "image/webp") : null;
  const storyId = await db.createStory(
    {
      kind: "original",
      status: "approved",
      auto_published: auto,
      image_url: null,
      gallery: shotUrl ? [{ url: shotUrl, caption: `${PROOF_CAPTION}: ${shot.name}` }] : [],
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
