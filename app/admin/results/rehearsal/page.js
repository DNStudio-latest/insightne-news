import { redirect } from "next/navigation";
import { currentRole } from "../../../../lib/auth.js";
import ResultsBoard from "../../../[lang]/results/ResultsBoard.js";
import "../../../[lang]/results/results.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rehearsal", robots: { index: false, follow: false } };

export default async function RehearsalPage() {
  if ((await currentRole()) !== "admin") redirect("/admin/login");
  const initial = { election: { slug: "rehearsal", title: "REHEARSAL: practice counting day", subtitle: "A finished election played back. Never public, never posted.", live: false }, snapshot: null, status: {} };
  return (
    <div className="wrap">
      <a className="btn btn-plain" href="/admin/results">← Back</a>
      <ResultsBoard initial={initial} endpoint="/api/results/rehearsal" rehearsal />
    </div>
  );
}
