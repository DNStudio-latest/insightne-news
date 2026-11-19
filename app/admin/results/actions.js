"use server";
// Buttons on /admin/results. Admin only. Settings changed here override results.json (kept in site settings).
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db.js";
import { currentRole } from "../../../lib/auth.js";
import { electionConfig, loadMeta, refreshResults } from "../../../lib/results/store.js";
import { loadTurnout, addTurnoutUpdate } from "../../../lib/results/turnout.js";
import { shareMilestones } from "../../../lib/results/social.js";

async function admin() {
  if ((await currentRole()) !== "admin") throw new Error("admin only");
}
const text = (fd, k) => String(fd.get(k) || "").trim();

export async function saveElectionSettings(formData) {
  await admin();
  const slug = text(formData, "slug");
  const cfg = await electionConfig(db, slug);
  if (!cfg) return;
  const from = text(formData, "from");
  const to = text(formData, "to");
  const keyContests = text(formData, "keyContests").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const override = {
    enabled: formData.get("enabled") === "on",
    ...(from && to ? { window: { from, to } } : {}),
    expectedSeats: Number(text(formData, "expectedSeats")) || cfg.expectedSeats,
    keyContests,
    source: {
      base: text(formData, "base") || cfg.source.base,
      keys: { results: text(formData, "kResults") || cfg.source.keys.results, summary: text(formData, "kSummary") || cfg.source.keys.summary, time: text(formData, "kTime") || cfg.source.keys.time },
    },
    social: { enabled: formData.get("socialOn") === "on", maxPerDay: Math.min(60, Math.max(1, Number(text(formData, "maxPerDay")) || 25)) },
  };
  await db.setSetting(`results_config_${slug}`, override);
  revalidatePath("/admin/results");
}

export async function setPaused(formData) {
  await admin();
  const slug = text(formData, "slug");
  const meta = await loadMeta(db, slug);
  await db.setSetting(`results_meta_${slug}`, { ...meta, paused: text(formData, "paused") === "1" });
  revalidatePath("/admin/results");
}

export async function fetchNow(formData) {
  await admin();
  const cfg = await electionConfig(db, text(formData, "slug"));
  if (cfg) await refreshResults(cfg, { db, force: true, shareFn: text(formData, "share") === "1" ? shareMilestones : null });
  revalidatePath("/admin/results");
}

export async function resetPosted(formData) {
  await admin();
  const slug = text(formData, "slug");
  const meta = await loadMeta(db, slug);
  await db.setSetting(`results_meta_${slug}`, { ...meta, posted: [], events: [] });
  revalidatePath("/admin/results");
}

// Polling day: add one turnout figure (typed from the State Election Commission's official update).
export async function addTurnout(formData) {
  await admin();
  const slug = text(formData, "slug");
  const cur = await loadTurnout(db, slug);
  const r = addTurnoutUpdate(cur, { label: text(formData, "label"), percent: text(formData, "percent"), note: text(formData, "note") });
  if (r.ok) await db.setSetting(`turnout_${slug}`, r.turnout);
  else await db.setSetting(`turnout_error_${slug}`, { error: r.error, at: Date.now() });
  revalidatePath("/admin/results");
}

export async function removeLastTurnout(formData) {
  await admin();
  const slug = text(formData, "slug");
  const cur = await loadTurnout(db, slug);
  await db.setSetting(`turnout_${slug}`, { ...cur, updates: cur.updates.slice(0, -1) });
  revalidatePath("/admin/results");
}
