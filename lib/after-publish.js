// After a story is published, in the background: make its AI illustration (only if Cloudflare is set up),
// then post it to Facebook and Instagram if auto-posting is switched on in settings.json.
// Used by the admin buttons and by the News Hunter's automatic publishing.
import { addIllustration } from "./images.js";
import { shareOnFacebook, facebookAutoPost } from "./facebook.js";
import { shareOnInstagram, instagramAutoPost } from "./instagram.js";
import { telegramChannelAutoPost, postToTelegramChannel, alreadyOnTelegramChannel } from "./telegram-channel.js";
import { blueskyAutoPost, postToBluesky, alreadyOnBluesky } from "./bluesky.js";
import { logSocial, postsInLast24h, dailyLimit } from "./social.js";

// True when this network is under the daily limit; otherwise the skipped post is noted on /admin/social.
async function underLimit(db, network, story) {
  const used = await postsInLast24h(db, network).catch(() => 0);
  if (used < dailyLimit()) return true;
  await logSocial(db, network, story, `Daily limit of ${dailyLimit()} automatic posts reached: not posted. Use the POST button to share it.`);
  return false;
}

export async function finishPublishing(db, id, onChange = () => {}) {
  try {
    const story = await db.getStory(id);
    if (story?.status === "approved" && (await addIllustration(db, story))) onChange();
  } catch (err) {
    console.error("Illustration failed:", err.message);
  }
  const story = await db.getStory(id).catch(() => null);
  if (facebookAutoPost(story) && !story.facebook_post_id && (await underLimit(db, "Facebook", story))) {
    try {
      await shareOnFacebook(db, story);
      await logSocial(db, "Facebook", story);
    } catch (err) {
      console.error("Facebook post failed:", err.message);
      await logSocial(db, "Facebook", story, err.message);
    }
  }
  if (telegramChannelAutoPost(story) && !(await alreadyOnTelegramChannel(db, story)) && (await underLimit(db, "Telegram", story))) {
    try {
      await postToTelegramChannel(story);
      await logSocial(db, "Telegram", story);
    } catch (err) {
      console.error("Telegram channel post failed:", err.message);
      await logSocial(db, "Telegram", story, err.message);
    }
  }
  if (blueskyAutoPost(story) &&!(await alreadyOnBluesky(db, story)) && (await underLimit(db, "Bluesky", story))) {
    try {
      await postToBluesky(story);
      await logSocial(db, "Bluesky", story);
    } catch (err) {
      console.error("Bluesky post failed:", err.message);
      await logSocial(db, "Bluesky", story, err.message);
    }
  }
  if (instagramAutoPost(story) && !story.instagram_post_id && (await underLimit(db, "Instagram", story))) {
    try {
      await shareOnInstagram(db, story);
      await logSocial(db, "Instagram", story);
    } catch (err) {
      console.error("Instagram post failed:", err.message);
      await logSocial(db, "Instagram", story, err.message);
    }
  }
}
