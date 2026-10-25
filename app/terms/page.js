import { settings } from "../../lib/config.js";
import { InfoPage } from "../info.js";

export const metadata = { title: "Terms & Disclaimer", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <InfoPage title="Terms of Use & Disclaimer">
      <h2>Using this website</h2>
      <p>
        By using {settings.siteName} you agree to these terms. The content is provided for general information. We work hard to
        be accurate, but we cannot guarantee that every detail is complete or up to date.
      </p>
      <h2>Our content</h2>
      <p>
        Original reports, photos and videos marked as ours belong to {settings.siteName}. You may share links to our stories
        freely. Please do not copy full articles or photos without permission.
      </p>
      <h2>News briefs and other publishers</h2>
      <p>
        Our news briefs are short summaries written in our own words. The original reports belong to their publishers, whom we
        always name and link. We do not copy other publishers' articles or photos. If you are a publisher and have a concern
        about how your work is credited, please <a href="/contact">contact us</a> and we will respond promptly.
      </p>
      <h2>Links to other websites</h2>
      <p>We are not responsible for the content of external websites that we link to.</p>
      <h2>Corrections</h2>
      <p>If we find or are told about an error, we correct it as quickly as possible.</p>
      <h2>Law</h2>
      <p>These terms are governed by the laws of India.</p>
    </InfoPage>
  );
}
