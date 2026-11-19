// Makes the rehearsal data for the live results pages from a finished election's results: a 345-seat sample (the size of
// the 2026 civic polls) with the candidates' names replaced by "Candidate 1, 2…", so a practice counting day can be played
// on /admin/results/rehearsal without showing real people against made-up news.
//
//   node scripts/results-record.js <results.json> <summary.json> [out.json] [seats]
//
// results.json / summary.json: the portal's answers for the keys "GP_Results_Summary" and "Dashboard_Page_Summary"
// (POST <portal>/electionresultscheduler/dashboard/get-data with {"key": "..."}), saved as they came.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const [resultsFile, summaryFile, out = "data/rehearsal/village-committee-2026.json", limit = "345"] = process.argv.slice(2);
if (!resultsFile || !summaryFile) {
  console.error("Usage: node scripts/results-record.js <results.json> <summary.json> [out.json] [seats]");
  process.exit(1);
}
const unwrap = (file) => {
  const j = JSON.parse(readFileSync(file, "utf8"));
  return typeof j.data === "string" ? JSON.parse(j.data) : j.data;
};
const results = unwrap(resultsFile);
const summaryAll = unwrap(summaryFile);
const summary = Object.values(summaryAll).find((v) => v && Array.isArray(v.party_wise_results));

let left = Number(limit);
let n = 0;
const trimmed = [];
for (const d of results) {
  if (left <= 0) break;
  const blocks = [];
  for (const b of d.block_results || []) {
    if (left <= 0) break;
    const gps = [];
    for (const g of b.gp_results || []) {
      if (left <= 0) break;
      const seats = (g.constituency_result || []).slice(0, left).map((c) => ({
        is_declared: true,
        is_verified: true,
        constituency_code: c.constituency_code,
        constituency_no_name: c.constituency_no_name,
        candidate_data: (c.candidate_data || []).map((x) => ({
          candidate_name: x.is_nota ? "NOTA" : `Candidate ${++n}`,
          party_name: x.party_name,
          party_full_name: x.party_full_name,
          vote_secured: x.vote_secured,
          is_winner: x.is_winner,
          is_nota: x.is_nota,
        })),
      }));
      if (!seats.length) continue;
      left -= seats.length;
      gps.push({ gp_id: g.gp_id, gp_name: g.gp_name, gp_count: seats.length, result_declared: seats.length, constituency_result: seats });
    }
    if (gps.length) blocks.push({ block_id: b.block_id, block_name: b.block_name, gp_results: gps });
  }
  if (blocks.length) trimmed.push({ district_id: d.district_id, district_name: d.district_name, block_results: blocks });
}
const parties = (summary?.party_wise_results || []).map((p) => ({ party_name: p.party_name, party_full_name: p.party_full_name, party_colour_code: p.party_colour_code }));
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ note: "Rehearsal data: a sample of a finished election's results, candidate names removed. Not for publication.", results: trimmed, summary: { party_wise_results: parties } }));
console.log(`Saved ${out}: ${Number(limit) - left} seats`);
