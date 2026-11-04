import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/auth.js";
import AiCheck from "./AiCheck.js";

export const metadata = { title: "AI checker", robots: { index: false, follow: false } };

// The AI checker for staff: estimates whether a text reads as AI-generated and suggests plainer wording.
// Everything runs in the browser (public/ai-tools/engine.js and model.js); no text is sent to a server.
export default async function AiCheckPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="wrap aic-wide">
      <div className="admin-bar">
        <h1>🤖 AI checker</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      <p className="note">
        Paste a story, a press release or a reader&apos;s submission. The checker estimates whether it reads as AI-generated,
        shows why, and suggests plainer wording. The text stays on this device: nothing is sent to the website or to an AI service.
      </p>
      <div className="flag">
        <strong>A score is not proof.</strong>
        The model was right on about 9 in 10 test texts, but it wrongly flagged about 1 in 13 human texts. It is weaker on
        newer AI models and on kinds of writing it was not trained on, such as Indian English news copy. Do not accuse
        a contributor on a score alone: ask them, and check the facts.
      </div>
      <AiCheck />
    </div>
  );
}
