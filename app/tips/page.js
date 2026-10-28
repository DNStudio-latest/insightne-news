import { settings } from "../../lib/config.js";
import { InfoPage, Email, publisher } from "../info.js";

export const metadata = { title: "Send us a news tip", alternates: { canonical: "/tips" } };

export default function TipsPage() {
  return (
    <InfoPage title="Send us a news tip">
      <p>
        Have you seen something happening in your area that people should know about? {settings.siteName} wants to hear from
        readers across Northeast India.
      </p>
      <h2>How to send a tip</h2>
      <p>
        Email <Email value={publisher.email} /> with what happened, where and when, and how we can reach you. Photos and
        videos are welcome; please tell us if you took them yourself.
      </p>
      <h2>What happens next</h2>
      <ul>
        <li>Our team checks every tip before reporting it. We may contact you with questions.</li>
        <li>We will not publish your name or contact details unless you agree.</li>
        <li>If we use your photo or video, we credit you, unless you ask us not to.</li>
      </ul>
      <h2>Write for us</h2>
      <p>
        Reporters, students and writers from the region who want to contribute stories can email us with a short note about
        themselves and the stories they want to cover.
      </p>
      <p className="note">Please do not send rumours or forwarded messages you have not checked. In an emergency, call 112.</p>
    </InfoPage>
  );
}
