import { settings } from "../../lib/config.js";
import { InfoPage, Email, publisher } from "../info.js";

export const metadata = { title: "Contact us", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <InfoPage title="Contact us">
      <p>We'd like to hear from you: news tips, corrections, advertising enquiries or feedback.</p>
      <h2>Write to us</h2>
      <p>Email: <Email value={publisher.email} /></p>
      {publisher.phone && <p>Phone / WhatsApp: {publisher.phone}</p>}
      <p>Address: {publisher.address}</p>
      <h2>Advertising</h2>
      <p>Local businesses, institutions and events can advertise with {settings.siteName}. Email us for rates.</p>
      <h2>Corrections and complaints</h2>
      <p>
        If you believe something we published is wrong, please tell us with the link to the story. For formal complaints,
        see <a href="/grievance">Grievance Redressal</a>.
      </p>
      <h2>Video</h2>
      <p>
        Follow our video reports on YouTube: <a href={settings.youtubeUrl}>{settings.youtubeName}</a>.
      </p>
    </InfoPage>
  );
}
