import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/auth.js";
import ThesisCheck from "./ThesisCheck.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thesis checker", robots: { index: false, follow: false } };

// The PhD thesis checker: writing suggestions and a ChatGPT-style signal. Admin only.
// Everything runs in the browser and no text is sent anywhere: there is no AI editor (owner's decision).
// See docs/10-THESIS-AI-TOOLS.md.
export default async function ThesisCheckPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "admin") redirect("/admin");

  return (
    <div className="wrap aic-wide">
      <div className="admin-bar">
        <h1>🎓 Thesis checker</h1>
        <span>
          <a className="btn btn-plain" href="/admin/ai-check">🤖 News AI checker</a>{" "}
          <a className="btn btn-plain" href="/admin">← Back</a>
        </span>
      </div>
      <p className="note">
        Open a chapter (.docx or .txt) or paste it. The checker finds your own prose (it leaves out headings,
        quotations, interview extracts, tables, captions and the reference list) and suggests improvements: claims
        that need a citation, overclaims, stock phrases and wordy wording. Checking happens on this device: your text
        is not sent anywhere, and no AI is used to change it.
      </p>
      <div className="flag">
        <strong>A writing aid, not a verdict.</strong>
        The score shows only ChatGPT-style writing of the 2023 kind. It does not detect text from current AI assistants,
        so a low score does not mean a text is human-written. On genuine human theses in this field it gives a false
        signal on about 1 paragraph in 100. Never use it as evidence about anyone.
      </div>
      <ThesisCheck />
    </div>
  );
}
