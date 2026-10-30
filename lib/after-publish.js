// After a story is published, in the background: make its AI illustration (only if Cloudflare is set up),
// then post it to Facebook and Instagram if auto-posting is switched on in settings.json.
// Used by the admin buttons and by the News Hunter's automatic publishing.
import { addIllustration } from "./images.js";
import { shareOnFacebook, facebookAutoPost } from "./facebook.js";
import { shareOnInstagram, instagramAutoPost } from "./instagram.js";
import { logSocial } from "./social.js";

export async function finishPublishing(db, id, onChange = () => {}) {
  try {
    const story = await db.getStory(id);
    if (story?.status === "approved" && (await addIllustration(db, story))) onChange();
  } catch (err) {
    console.error("Illustration failed:", err.message);
  }
  const story = await db.getStory(id).catch(() => null);
  if (facebookAutoPost(story) && !story.facebook_post_id) {
    try {
      await shareOnFacebook(db, story);
      await logSocial(db, "Facebook", story);
    } catch (err) {
      console.error("Facebook post failed:", err.message);
      await logSocial(db, "Facebook", story, err.message);
    }
  }
  if (instagramAutoPost(story) && !story.instagram_post_id) {
    try {
      await shareOnInstagram(db, story);
      await logSocial(db, "Instagram", story);
    } catch (err) {
      console.error("Instagram post failed:", err.message);
      await logSocial(db, "Instagram", story, err.message);
    }
  }
}
