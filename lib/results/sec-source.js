// Reads the State Election Commission, Tripura results portal (sec-results.tripura.gov.in). The portal's own page asks
// the same service every 2 minutes: POST <base>/electionresultscheduler/dashboard/get-data with { key }. The keys of an
// election are set in results.json (or on /admin/results) because each election's portal can name them differently.
// Be polite: one request set per polling interval (see results.json "pollSeconds"), never more.

const UA = "Mozilla/5.0 (compatible; InsightNE-Results/1.0; +https://www.insightnenews.in)";

async function call(base, api, key, extra, fetchFn, timeoutMs) {
  const res = await fetchFn(`${base.replace(/\/$/, "")}${api}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ key, ...extra }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`The results portal answered ${res.status} for ${key}.`);
  const json = await res.json();
  if (json?.status === false) throw new Error(`The results portal reported an error for ${key}.`);
  return typeof json.data === "string" ? JSON.parse(json.data) : json.data;
}

// Returns { results, summary, updatedLabel }: the seats data, the party list (names and colours) and the portal's own clock.
export async function fetchSec(source, { fetchFn = fetch, timeoutMs = 40000 } = {}) {
  const api = source.api || "/electionresultscheduler/dashboard/get-data";
  const keys = source.keys || {};
  if (!source.base || !keys.results) throw new Error("The results source is not set up (address or data key missing).");
  const [results, summaryAll, time] = await Promise.all([
    call(source.base, api, keys.results, {}, fetchFn, timeoutMs),
    keys.summary ? call(source.base, api, keys.summary, {}, fetchFn, timeoutMs).catch(() => null) : null,
    keys.time ? call(source.base, api, keys.time, { moduleId: "ELE", hospitalId: "0" }, fetchFn, timeoutMs).catch(() => null) : null,
  ]);
  // The party list sits under a name like "GP_Result"; take the first section that has one.
  const section = summaryAll && (summaryAll[source.summarySection] || Object.values(summaryAll).find((v) => v && typeof v === "object" && Array.isArray(v.party_wise_results)));
  return { results, summary: section || null, updatedLabel: time ? `${time.date || ""} ${time.time || ""}`.trim() : "" };
}
