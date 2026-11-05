import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/auth.js";
import ThesisCheck from "./ThesisCheck.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thesis checker", robots: { index: false, follow: false } };

// The PhD thesis checker: AI-text check, writing suggestions and an academic editor. Admin only.
// The checking runs in the browser (public/ai-tools/academic.js and model-academic.js); only "Edit with the
// academic editor" sends a passage to the AI. See docs/10-THESIS-AI-TOOLS.md.
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
        quotations, interview extracts, tables, captions and the reference list), estimates which paragraphs read as
        AI-written, and suggests plainer wording. Checking happens on this device: your text is not sent anywhere.
        Only <b>Edit with the academic editor</b> sends that one passage to the website&apos;s AI to make the edit.
      </p>
      <div className="flag">
        <strong>A score is not proof.</strong>
        The academic model was right on about 94 in 100 test abstracts, but it wrongly flagged about 1 in 20 human
        abstracts (about 1 in 50 at the &ldquo;AI-like&rdquo; level). It was trained on abstracts, not thesis chapters, and on
        older AI models. It often misses text from AI models it has not seen, most text that AI has only polished, and
        AI text rewritten to sound human. Use it to improve your writing, not as evidence about anyone.
      </div>
      <ThesisCheck />
    </div>
  );
}
