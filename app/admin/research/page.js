import { redirect } from "next/navigation";
import { currentRole } from "../../../lib/auth.js";
import ResearchForm from "./ResearchForm.js";

export const dynamic = "force-dynamic";
// Searching and writing take about half a minute.
export const maxDuration = 60;
export const metadata = { title: "Research desk", robots: { index: false, follow: false } };

// The Research desk: give a topic (and your own details, if you have them); the AI searches the internet and
// writes a draft, which then waits for you in News Hunter.
export default async function ResearchPage({ searchParams }) {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "admin") redirect("/admin"); // admin only
  const { error } = await searchParams;

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>🔎 Research desk</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      <p className="note">
        Give a topic. The AI searches Google for everything reliable about it and writes a news draft from what it finds,
        adding any details you give below. The draft waits in <a href="/admin/hunter">News Hunter</a> for you to check and
        approve: nothing is published by itself.
      </p>
      {error && <div className="flag">{error}</div>}
      <ResearchForm />
    </div>
  );
}
