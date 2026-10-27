import { settings } from "../../lib/config.js";
import { InfoPage, Email, publisher } from "../info.js";

export const metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy Policy">
      <p>
        This policy explains what information {settings.siteName} ("we") collects when you visit our website, and how it is used.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>We do not ask readers to create an account and we do not collect your name, email or phone number unless you write to us.</li>
        <li>Like most websites, our hosting provider automatically records basic technical information (such as your IP address, browser type and the pages you visit) to keep the site secure and working.</li>
        <li>If you email us, we use your message and address only to reply to you.</li>
        <li>
          If you vote in a readers' poll, your browser keeps a random code so you cannot vote twice. We store only a scrambled
          version of that code with your answer, never your name or address.
        </li>
        <li>
          If you switch on news alerts, your browser gives us a delivery address for those alerts (it does not include your
          name or phone number). You can switch alerts off at any time with the same button, and the address is deleted.
        </li>
        <li>
          If you sign up for our daily email, we keep your email address and your language choice only to send you that email.
          The emails are delivered by our email provider, Brevo. Every email has an unsubscribe link; when you unsubscribe, your
          address is deleted.
        </li>
        <li>We count visits with Vercel Web Analytics, which does not use cookies and does not identify you. It tells us things like how many people read a page and which country or state they read from.</li>
      </ul>
      <h2>Cookies</h2>
      <p>
        Our news pages do not set their own cookies. A cookie is used only on our private editor login page. Videos and links
        to YouTube and other websites are governed by those sites' own privacy policies.
      </p>
      <h2>Advertising</h2>
      <p>
        We may show advertisements, including from Google. Third-party vendors, including Google, use cookies to serve ads based
        on your prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners
        to serve ads to you based on your visits to this and other sites on the internet. You can opt out of personalised
        advertising by visiting <a href="https://www.google.com/settings/ads">Google Ads Settings</a> or{" "}
        <a href="https://www.aboutads.info/choices/">www.aboutads.info</a>.
      </p>
      <h2>Sharing</h2>
      <p>We do not sell your personal information. We share information only when required by law.</p>
      <h2>Children</h2>
      <p>Our website is a general news service and is not directed at children under 13.</p>
      <h2>Your rights</h2>
      <p>
        You can ask us what information we hold about you, or ask us to delete it, by writing to <Email value={publisher.email} />.
      </p>
      <h2>Changes</h2>
      <p>We may update this policy. The date below shows when it was last changed.</p>
    </InfoPage>
  );
}
