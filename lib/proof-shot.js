// News Hunter stories keep a screenshot of the official page as proof. A page of small print is not a picture for
// the front page or the top of a story, so it is shown inside the story as "Official notice (screenshot)" instead.
// Older Hunter stories have it as their main picture; newer ones keep it in the gallery.
export const PROOF_CAPTION = "Screenshot of the official page";

const isProof = (caption) => typeof caption === "string" && caption.startsWith(PROOF_CAPTION);

// The story's real picture (a photo or an AI illustration), or null.
export const pictureOf = (story) => (story?.image_url && !isProof(story.image_caption) ? story.image_url : null);

// The official page screenshot ({ url, caption }), or null.
export function proofShotOf(story) {
  if (story?.image_url && isProof(story.image_caption)) return { url: story.image_url, caption: story.image_caption };
  return (story?.gallery || []).find((g) => isProof(g?.caption)) || null;
}

// The gallery photos, without the proof screenshot.
export const photoGallery = (story) => (story?.gallery || []).filter((g) => !isProof(g?.caption));
