// The live counting page: /results/<election>. English only. The numbers come from the official results portal through
// lib/results (read, checked and stored), and the board refreshes itself every 20 seconds.
import { notFound } from "next/navigation";
import { db } from "../../../../lib/db.js";
import { initLang } from "../../../../lib/lang.js";
import { alternatesFor } from "../../../../lib/seo.js";
import { electionConfig, loadSnapshot, loadMeta, isLive } from "../../../../lib/results/store.js";
import { PageShell } from "../../../components.js";
import ResultsBoard from "../ResultsBoard.js";
import "../results.css";

export const revalidate = 15;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { lang, slug } = await params;
  const cfg = await electionConfig(db, slug);
  if (!cfg) return { title: "Not found" };
  return { title: cfg.title, description: `${cfg.subtitle || cfg.title}: live results from the State Election Commission, Tripura.`, alternates: alternatesFor(lang, `/results/${slug}`, { translated: lang === "en" }), ...(lang === "en" ? {} : { robots: { index: false, follow: true } }) };
}

export default async function ResultsPage({ params }) {
  const { lang, slug } = await params;
  await initLang(lang);
  const cfg = await electionConfig(db, slug);
  if (!cfg) notFound();
  const [snapshot, meta] = await Promise.all([loadSnapshot(db, slug), loadMeta(db, slug)]);
  const initial = {
    election: { slug, title: cfg.title, subtitle: cfg.subtitle, enabled: Boolean(cfg.enabled), live: isLive(cfg), countingDate: cfg.countingDate },
    snapshot: snapshot || null,
    status: { paused: Boolean(meta.paused), delayed: Boolean(meta.lastError) && isLive(cfg) },
  };
  return (
    <PageShell current="Results">
      <ResultsBoard initial={initial} endpoint={`/api/results/${slug}`} />
    </PageShell>
  );
}
