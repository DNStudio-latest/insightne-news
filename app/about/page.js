import { settings } from "../../lib/config.js";
import { InfoPage, publisher } from "../info.js";

export const metadata = { title: "About us", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <InfoPage title={`About ${settings.siteName}`}>
      <p>
        {settings.siteName} is an independent digital news platform covering all eight states of Northeast India: Tripura, Assam, Meghalaya, Manipur, Mizoram, Nagaland, Arunachal Pradesh and Sikkim. We
        publish our own ground reports and video stories, along with short news briefs that help readers keep up with the
        most important developments in the region.
      </p>
      <h2>What we publish</h2>
      <ul>
        <li><strong>InsightNE Originals</strong>: reports written and photographed by our own team.</li>
        <li><strong>News briefs</strong>: short summaries, written in our own words, of important stories reported by other publishers. Every brief names and links the original publisher so readers can read the full report there.</li>
        <li><strong>Videos</strong>: reports from our YouTube channel, <a href={settings.youtubeUrl}>{settings.youtubeName}</a>.</li>
      </ul>
      <h2>How we work</h2>
      <p>
        Every story is checked by an editor before it is published. Stories involving violence, religion, communities,
        elections, accidents or crime are given an extra check. Claims are attributed to the people who made them. When we make
        a mistake, we correct it and note the correction.
      </p>
      <h2>Editorial team</h2>
      <p>Editor: {publisher.editor}</p>
      <p>Based in {publisher.address}.</p>
      <p>
        Questions, news tips or corrections: see our <a href="/contact">Contact page</a>. Complaints: see{" "}
        <a href="/grievance">Grievance Redressal</a>.
      </p>
    </InfoPage>
  );
}
