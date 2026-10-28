import { settings } from "../../lib/config.js";
import { InfoPage, Email, publisher } from "../info.js";

export const metadata = {
  title: "Advertise with us",
  description: `Reach readers across Northeast India with ${settings.siteName}: website, WhatsApp channel and YouTube.`,
  alternates: { canonical: "/advertise" },
};

export default function AdvertisePage() {
  return (
    <InfoPage title="Advertise with us">
      <p>
        {settings.siteName} reaches readers across the eight states of Northeast India, with news in English, বাংলা, हिन्दी,
        অসমীয়া and नेपाली. Local businesses, institutions, schools, hospitals and event organisers can reach this audience with us.
      </p>
      <h2>Ways to advertise</h2>
      <ul>
        <li><strong>Website banners</strong> on the front page, section pages and story pages.</li>
        <li><strong>Sponsored stories</strong> about your business or event, written with you and clearly labelled “Sponsored”.</li>
        <li><strong>Event promotion</strong> for festivals, exhibitions, admissions, sales and openings.</li>
        <li>
          <strong>Video</strong> on our YouTube channel, <a href={settings.youtubeUrl}>{settings.youtubeName}</a>.
        </li>
      </ul>
      <h2>Our advertising rules</h2>
      <ul>
        <li>Every advertisement and sponsored story is clearly marked, so readers can always tell it apart from news.</li>
        <li>Advertisers never decide what we report. Our news team works independently of advertising.</li>
        <li>We do not accept advertisements for anything illegal, for gambling or betting, or that are misleading, hateful or indecent.</li>
      </ul>
      <h2>Contact for rates</h2>
      <p>
        Email <Email value={publisher.email} /> with your name, business and what you would like to promote. We will reply with
        options and rates.
      </p>
    </InfoPage>
  );
}
