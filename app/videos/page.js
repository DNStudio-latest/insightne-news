import { settings } from "../../lib/config.js";
import { latestVideos } from "../../lib/youtube.js";
import { PageShell, Videos } from "../components.js";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Videos",
  description: `Latest video reports from ${settings.youtubeName} on YouTube.`,
  alternates: { canonical: "/videos" },
};

export default async function VideosPage() {
  const videos = await latestVideos(12);
  return (
    <PageShell current="Videos">
      {videos.length ? (
        <Videos videos={videos} title={`Latest videos from ${settings.youtubeName}`} />
      ) : (
        <div className="empty">
          Videos could not be loaded right now. <a href={settings.youtubeUrl}>Watch on YouTube →</a>
        </div>
      )}
    </PageShell>
  );
}
