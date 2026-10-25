import { settings } from "../../lib/config.js";
import { InfoPage, Email, publisher } from "../info.js";

export const metadata = { title: "Grievance Redressal", alternates: { canonical: "/grievance" } };

export default function GrievancePage() {
  return (
    <InfoPage title="Grievance Redressal">
      <p>
        {settings.siteName} follows the Code of Ethics for digital news publishers under the Information Technology
        (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. If you have a complaint about any content we have
        published, please contact our Grievance Officer.
      </p>
      <h2>Grievance Officer</h2>
      <p>
        Name: {publisher.grievanceOfficer}
        <br />
        Email: <Email value={publisher.grievanceEmail} />
        <br />
        Address: {publisher.address}
      </p>
      <h2>How to complain</h2>
      <ol>
        <li>Send an email with the link to the content, what you believe is wrong, and your contact details.</li>
        <li>We will acknowledge your complaint within 24 hours.</li>
        <li>We will decide on it and inform you within 15 days.</li>
      </ol>
      <p>If you are not satisfied with our decision, you may appeal to the self-regulating body to which we belong, when applicable.</p>
    </InfoPage>
  );
}
