// One News Hunter run: read the watched pages and channels, read new items (pages, PDFs, videos),
// let the AI pick the news, and write drafts for your approval. Nothing is ever published here.
import { extractLinks, looksLikeItem, readItemPage, isDocument, dateFromLink } from "./pages.js";
import { pdfToText, fingerprint } from "./pdf.js";
import { checkDraft } from "./checks.js";
import { cleanText } from "../text.js";

const LIMITS = {
  firstVisitItems: 2, // on a page's first visit, only its top items are read; the rest are just remembered
  newPerPage: 15, // at most this many new links per page and run
  readPerRun: 45, // items read (downloaded) per run; the rest wait for the next run
  judgeBatch: 6, // items judged together in one AI request
  draftsPerRun: 12,
  maxAgeDays: 7, // items dated older than this are skipped
  minScore: 6,
  minutes: Number(process.env.HUNTER_MINUTES ?? 40), // GitHub stops a run after 60 minutes: stop starting new work after this
};

const YOUTUBE_FEED = (id) => `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
const decode = (s) => cleanText(s || "", 5000);

function youtubeEntries(xml) {
  return [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const id = (e.match(/<yt:videoId>([^<]+)/) || [])[1];
    return {
      url: `https://www.youtube.com/watch?v=${id}`,
      title: decode((e.match(/<title>([^<]*)/) || [])[1]),
      published: (e.match(/<published>([^<]+)/) || [])[1] || null,
      description: decode((e.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1]),
    };
  });
}

// Backup when the RSS feed fails: the official YouTube Data API (needs YOUTUBE_API_KEY, free).
async function youtubeApiEntries(channelId, fetchFn) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const playlist = `UU${channelId.slice(2)}`; // every channel's "uploads" list
  const res = await fetchFn(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${playlist}&key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return null;
  return ((await res.json()).items || []).map(({ snippet: s }) => ({
    url: `https://www.youtube.com/watch?v=${s.resourceId.videoId}`,
    title: s.title,
    published: s.publishedAt,
    description: s.description || "",
  }));
}

const isOld = (published, now) => published && now - new Date(published).getTime() > LIMITS.maxAgeDays * 86400000;

export async function runHunter({ store, get, ai, generate, config, readOnly = false, now = Date.now(), fetchFn = fetch, log = console.log, minutes = LIMITS.minutes }) {
  const run = { started_at: new Date(now).toISOString(), pages_ok: 0, pages_failed: [], items_new: 0, items_read: 0, drafts_created: 0, error: null };
  // Work left when time is up waits in the database for the next run.
  const deadline = Date.now() + minutes * 60000;
  const timeUp = (what) => Date.now() > deadline && (log(`Time is up: ${what} wait for the next run.`), true);

  // Remembers new links. Links dated more than a week ago are "old" and never read. On a page's first visit,
  // everything already there is "baseline" (never read) except the newest few, so you see some drafts straight away.
  async function remember(pageUrl, sourceName, candidates, base) {
    const page = await store.getPage(pageUrl);
    const known = await store.knownUrls(candidates.map((c) => c.url));
    const fresh = candidates
      .filter((c) => !known.has(c.url))
      .map((c) => ({ ...base, ...c, published_at: c.published_at || dateFromLink({ url: c.url, text: c.title }) }));
    const firstVisit = !page?.last_ok;
    const recent = fresh.filter((c) => !isOld(c.published_at, now));
    // Newest first; links without a date keep their place on the page, after the dated ones.
    if (firstVisit) recent.sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
    const toRead = new Set(recent.slice(0, firstVisit ? LIMITS.firstVisitItems : LIMITS.newPerPage));
    const rows = fresh.map((c) => ({ ...c, status: toRead.has(c) ? "queued" : isOld(c.published_at, now) ? "old" : "baseline" }));
    await store.addItems(rows);
    await store.savePage({ url: pageUrl, source_name: sourceName, last_ok: new Date(now).toISOString(), last_error: null });
    const queued = rows.filter((r) => r.status === "queued").length;
    run.items_new += queued;
    return queued;
  }

  try {
    // 1. Government websites: find new links on each watched page.
    for (const site of config.sites.filter((s) => s.enabled)) {
      for (const pageUrl of site.pages) {
        const page = await get(pageUrl);
        if (!page.ok) {
          run.pages_failed.push({ name: site.name, url: pageUrl, error: page.reason });
          await store.savePage({ url: pageUrl, source_name: site.name, last_error: page.reason, last_error_at: new Date(now).toISOString() });
          continue;
        }
        run.pages_ok++;
        let links = extractLinks(page.text, page.url).filter((l) => looksLikeItem(l, page.url));
        // Some sites put their whole page inside a "header" or "menu" box: then read every link.
        if (links.length < 3) links = extractLinks(page.text, page.url, { keepMenus: true }).filter((l) => looksLikeItem(l, page.url));
        const candidates = links.map((l) => ({ url: l.url, title: l.text, kind: isDocument(l.url) ? "pdf" : "page" }));
        const queued = await remember(pageUrl, site.name, candidates, { source_name: site.name, state: site.state });
        log(`${site.name}: ${candidates.length} links, ${queued} new`);
      }
    }

    // 2. YouTube channels: RSS feed first, YouTube Data API as backup.
    for (const channel of (config.youtube || []).filter((c) => c.enabled)) {
      const feedUrl = YOUTUBE_FEED(channel.channelId);
      const feed = await get(feedUrl);
      const entries = feed.ok ? youtubeEntries(feed.text) : await youtubeApiEntries(channel.channelId, fetchFn).catch(() => null);
      if (!entries) {
        const error = process.env.YOUTUBE_API_KEY ? "the YouTube Data API did not answer" : "needs the free YOUTUBE_API_KEY (YouTube's robots.txt does not allow reading its RSS feeds)";
        run.pages_failed.push({ name: `YouTube: ${channel.name}`, url: feedUrl, error });
        continue;
      }
      run.pages_ok++;
      const candidates = entries
        .filter((e) => !isOld(e.published, now))
        .map((e) => ({ url: e.url, title: e.title, kind: "video", published_at: e.published, text: `${e.title}\n\n${e.description}`.trim(), method: "video" }));
      const queued = await remember(feedUrl, `YouTube: ${channel.name}`, candidates, { source_name: channel.name, state: channel.state });
      log(`YouTube ${channel.name}: ${entries.length} videos, ${queued} new`);
    }

    // 3. Read the queued items: web pages, PDFs (with OCR for scanned ones) and videos.
    for (const item of await store.itemsWithStatus("queued", LIMITS.readPerRun)) {
      if (timeUp("the other new items")) break;
      try {
        if (item.kind === "video") {
          await store.updateItem(item.id, { status: "ready" });
          run.items_read++;
          continue;
        }
        const res = await get(item.url, { binary: true });
        if (!res.ok) {
          await store.updateItem(item.id, { status: "error", reason: res.reason });
          continue;
        }
        let { title } = item;
        let text = "";
        let method = "page";
        let published = item.published_at || null;
        let bytes = res.bytes;
        const isPdf = res.type.includes("pdf") || isDocument(item.url);
        if (!isPdf) {
          const page = readItemPage(res.bytes.toString("utf8"), res.url);
          title = page.title || title;
          // A date in the future is an event date, not the publishing date.
          if (page.published && new Date(page.published).getTime() < now + 86400000) published = page.published;
          text = page.text;
          // A page that is only a link to a PDF: read the PDF.
          if (text.length < 400 && page.documents.length) {
            const doc = await get(page.documents[0].url, { binary: true });
            if (doc.ok) {
              bytes = doc.bytes;
              ({ text, method } = await pdfToText(doc.bytes, { generate, log }));
            }
          }
        }
        const fp = fingerprint(bytes);
        if (await store.fingerprintSeen(fp, item.id)) {
          await store.updateItem(item.id, { fingerprint: fp, status: "duplicate" });
          continue;
        }
        if (isPdf) ({ text, method } = await pdfToText(bytes, { generate, log }));
        const status = method === "unreadable" || text.length < 80 ? "unreadable" : isOld(published, now) ? "old" : "ready";
        await store.updateItem(item.id, { fingerprint: fp, title: title.slice(0, 300), text: text.slice(0, 20000), method, published_at: published, status });
        run.items_read++;
        log(`  read (${method}): ${title.slice(0, 80)}`);
      } catch (err) {
        await store.updateItem(item.id, { status: "error", reason: err.message.slice(0, 300) });
        log(`  ✗ ${item.url}: ${err.message}`);
      }
    }

    // A test run without AI stops here (npm run hunt -- --read-only).
    if (readOnly) throw Object.assign(new Error("read-only test: stopped before the AI steps"), { readOnly: true });

    // 4. The AI decides which items are news, and spots duplicates.
    const recent = (await store.recentDrafts(3)).map((d) => ({ id: d.id, event: d.event || d.headline }));
    const ready = await store.itemsWithStatus("ready", 60);
    for (let i = 0; i < ready.length; i += LIMITS.judgeBatch) {
      if (timeUp("the other items")) break;
      const batch = ready.slice(i, i + LIMITS.judgeBatch);
      let verdicts;
      try {
        verdicts = await ai.judge(batch.map((it) => ({ id: it.id, source: it.source_name, kind: it.kind, title: it.title, text: it.text })), recent);
      } catch (err) {
        log(`  ✗ AI could not judge: ${err.message} (these items wait for the next run)`);
        break;
      }
      for (const it of batch) {
        const v = verdicts.get(it.id);
        if (!v) continue;
        const chosen = v.newsworthy && !v.routine && v.score >= LIMITS.minScore;
        await store.updateItem(it.id, { status: chosen ? "chosen" : "skipped", score: v.score, reason: v.reason, event: v.event, language: v.language, state: v.state, draft_id: v.same_as || null });
      }
    }

    // 5. Same event from several sources → one draft. Same event as a recent draft → added to that draft's sources.
    const chosen = await store.itemsWithStatus("chosen", 100);
    const groups = new Map();
    const chosenIds = new Set(chosen.map((c) => c.id));
    for (const it of chosen) {
      const draft = it.draft_id && !chosenIds.has(it.draft_id) ? await store.getDraft(it.draft_id) : null;
      if (draft) {
        if (!draft.sources.some((s) => s.url === it.url)) await store.updateDraft(draft.id, { sources: [...draft.sources, sourceOf(it)] });
        await store.updateItem(it.id, { status: "merged" });
        continue;
      }
      const key = it.draft_id && chosenIds.has(it.draft_id) ? it.draft_id : it.id;
      groups.set(key, [...(groups.get(key) || []), it]);
    }

    // 6. Write the drafts, then let the computer check every quote and number against the sources.
    for (const items of [...groups.values()].slice(0, LIMITS.draftsPerRun)) {
      if (timeUp("the other drafts")) break;
      try {
        const docs = items.map((it) => ({ source: it.source_name, kind: it.kind, title: it.title, published: it.published_at, text: it.text }));
        const d = await ai.draft(docs);
        // The publishing date is a fact from the source too (a video's description often has no date).
        const sources = items.map((it) => [it.text, it.published_at && new Date(it.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })].filter(Boolean).join("\n"));
        const headline = checkDraft(d.headline, sources);
        const body = checkDraft([...d.paragraphs, d.attribution].join("\n\n"), sources);
        const languages = [...new Set(items.map((it) => it.language).filter(Boolean))];
        const notes = [];
        if (languages.includes("kok")) notes.push("[CHECK: this draft is based on a document in Kokborok. AI understands Kokborok poorly; please verify every fact.]");
        if (languages.includes("lus")) notes.push("[CHECK: this draft is based on a document in Mizo; please verify every fact.]");
        if (items.some((it) => it.kind === "video")) notes.push("[CHECK: based only on the video's title and description; watch the video before publishing.]");
        if (items.some((it) => it.method === "ocr" || it.method === "gemini")) notes.push("[CHECK: the source was a scanned document read by OCR; compare names and numbers with the original.]");
        const problems = [...headline.problems, ...body.problems];
        const fullBody = [...notes, body.text].join("\n\n");
        const flags = [
          /\[CHECK/.test(headline.text + fullBody) && "check",
          languages.includes("kok") && "kokborok",
          items.some((it) => it.kind === "video") && "video",
          items.some((it) => it.method === "ocr" || it.method === "gemini") && "ocr",
        ].filter(Boolean);
        const eventAt = items.map((it) => it.published_at).filter(Boolean).sort().pop() || new Date(now).toISOString();
        const id = await store.createDraft({
          state: d.state,
          topic: d.topic,
          headline: headline.text,
          body: fullBody,
          sources: items.map(sourceOf),
          flags,
          problems,
          score: Math.max(...items.map((it) => it.score || 0)),
          language: languages.join(","),
          event: items[0].event,
          event_at: eventAt,
          status: "pending",
        });
        for (const it of items) await store.updateItem(it.id, { status: "drafted", draft_id: id });
        run.drafts_created++;
        log(`  ✓ draft: ${headline.text}`);
      } catch (err) {
        log(`  ✗ could not write a draft for "${items[0].title}": ${err.message} (tried again next run)`);
      }
    }

    // 7. A video that was deleted or made private after its draft was written gets [DELETED POST].
    for (const draft of await store.listDrafts({ status: "pending", limit: 100 })) {
      const videos = draft.sources.filter((s) => s.kind === "video");
      if (!videos.length || draft.flags.includes("deleted")) continue;
      for (const v of videos) {
        const res = await fetchFn(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(v.url)}`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
        if (res && (res.status === 404 || res.status === 401 || res.status === 403)) {
          await store.updateDraft(draft.id, { flags: [...draft.flags, "deleted"], body: `[DELETED POST: the video ${v.url} has been deleted or made private since this draft was written.]

${draft.body}` });
          log(`  ⚠ deleted video: ${v.url}`);
          break;
        }
      }
    }
  } catch (err) {
    if (!err.readOnly) run.error = err.message.slice(0, 500);
    log(err.readOnly ? "Read-only test finished." : `✗ The run stopped: ${err.message}`);
  }
  run.finished_at = new Date().toISOString();
  await store.logRun(run);
  return run;
}

function sourceOf(item) {
  return { name: item.source_name, url: item.url, title: item.title, kind: item.kind };
}
