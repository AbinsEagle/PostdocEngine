// Reads the job-board feeds listed in data/sources.json, keeps the postings that
// look relevant, and writes them to data/discover.json for the Discover tab.
// Runs on GitHub Actions (see .github/workflows/refresh-data.yml).
//
//   node scripts/discover.mjs            read feeds and write data/discover.json
//   node scripts/discover.mjs --dry-run  read feeds and print, write nothing
//
// It only ever writes data/discover.json. It never touches the curated
// data/jobs.json: promoting a candidate to the board is a human decision.
// If every feed fails it exits 2 and writes nothing, so an outage cannot empty the list.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFeed, looksLikeFeed } from "./lib/feed.mjs";
import { screen, canonicalUrl, titleKey, idFor } from "./lib/relevance.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 25000;
const PAUSE_MS = 1500;
const MAX_ITEMS = 80;
const MAX_AGE_DAYS = 60;
const DAY_MS = 86400000;

const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; PostdocEngine-FeedReader/2.0; +https://github.com/AbinsEagle/PostdocEngine)",
  accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5",
  "accept-language": "en-GB,en;q=0.9",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function urlsFor(source) {
  if (!source.url.includes("{q}")) return [source.url];
  return (source.queries || []).map((q) => source.url.replace("{q}", encodeURIComponent(q)));
}

async function fetchFeed(url) {
  try {
    const res = await fetch(url, { redirect: "follow", headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { error: `HTTP ${res.status}`, http: res.status };
    const text = await res.text();
    if (!looksLikeFeed(text)) return { error: "the response is not a feed", http: res.status };
    return { items: parseFeed(text), http: res.status };
  } catch (err) {
    const cause = err && err.cause ? err.cause : err;
    return { error: String((cause && cause.code) || (err && err.message) || err).slice(0, 120) };
  }
}

/**
 * Turns raw feed items into the candidate list. Pure, so it can be tested.
 * @param {object[]} raw       items tagged with source and sourceName
 * @param {object}   opts      { tracked: string[] of job URLs, previous: object[] of earlier candidates, now: Date }
 */
export function selectCandidates(raw, { tracked = [], previous = [], now = new Date() } = {}) {
  const trackedUrls = new Set(tracked.map(canonicalUrl).filter(Boolean));
  const firstSeen = new Map(previous.map((p) => [p.id, p.firstSeen]));
  const today = now.toISOString().slice(0, 10);
  const cutoff = now.getTime() - MAX_AGE_DAYS * DAY_MS;

  const seenUrls = new Set();
  const seenTitles = new Set();
  const kept = [];
  const dropped = { tracked: 0, duplicate: 0, old: 0, offTopic: 0, notARole: 0 };

  // Score first, so that when two feeds carry the same posting the better-described copy wins.
  const scored = raw.map((item) => ({ item, verdict: screen(item) }))
    .sort((a, b) => b.verdict.relevance - a.verdict.relevance);

  for (const { item, verdict } of scored) {
    if (!verdict.keep) {
      if (verdict.reason === "off-topic") dropped.offTopic += 1;
      else dropped.notARole += 1;
      continue;
    }
    const canon = canonicalUrl(item.url);
    if (!canon) continue;
    if (trackedUrls.has(canon)) { dropped.tracked += 1; continue; }
    if (item.published && Date.parse(item.published) < cutoff) { dropped.old += 1; continue; }
    const tkey = titleKey(item.title);
    if (seenUrls.has(canon) || seenTitles.has(tkey)) { dropped.duplicate += 1; continue; }
    seenUrls.add(canon);
    seenTitles.add(tkey);
    const id = idFor(item.url);
    kept.push({
      id,
      title: item.title,
      url: item.url,
      source: item.source,
      sourceName: item.sourceName,
      published: item.published,
      summary: item.summary,
      matched: verdict.matched,
      relevance: verdict.relevance,
      firstSeen: firstSeen.get(id) || today,
    });
  }

  kept.sort((a, b) => b.relevance - a.relevance || String(b.published || "").localeCompare(String(a.published || "")));
  return { items: kept.slice(0, MAX_ITEMS), dropped };
}

/**
 * A feed that failed this run keeps the candidates it supplied last time, so a
 * board being down for a day does not empty its part of the list.
 */
export function carryOver(previous, failedSourceIds) {
  const failed = new Set(failedSourceIds);
  return previous
    .filter((p) => failed.has(p.source))
    .map((p) => ({ title: p.title, url: p.url, summary: p.summary, published: p.published, source: p.source, sourceName: p.sourceName }));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", name), "utf8"));
  const { sources } = read("sources.json");
  const { jobs } = read("jobs.json");
  let previous = [];
  try {
    previous = read("discover.json").items || [];
  } catch {
    /* first run */
  }

  const raw = [];
  const report = [];
  for (const source of sources) {
    if (!source.enabled) {
      report.push({ id: source.id, name: source.name, ok: false, skipped: true, fetched: 0 });
      continue;
    }
    let fetched = 0;
    let answered = 0;
    const errors = [];
    for (const url of urlsFor(source)) {
      const r = await fetchFeed(url);
      if (r.error) errors.push(r.error);
      else {
        answered += 1;
        fetched += r.items.length;
        for (const item of r.items) raw.push({ ...item, source: source.id, sourceName: source.name });
      }
      await sleep(PAUSE_MS);
    }
    const entry = { id: source.id, name: source.name, ok: answered > 0, fetched };
    if (errors.length) entry.error = [...new Set(errors)].join("; ").slice(0, 200);
    report.push(entry);
    console.log(`${entry.ok ? "ok    " : "FAILED"} ${source.id.padEnd(26)} ${String(fetched).padStart(4)} items${entry.error ? `   (${entry.error})` : ""}`);
  }

  const attempted = report.filter((r) => !r.skipped);
  const failedIds = attempted.filter((r) => !r.ok).map((r) => r.id);
  if (attempted.length > 0 && failedIds.length === attempted.length) {
    console.error("\nEvery feed failed, which points at the network or at the feed addresses rather than at an empty week. data/discover.json is unchanged.");
    process.exit(2);
  }
  const carried = carryOver(previous, failedIds);
  if (carried.length) console.log(`\nKept ${carried.length} earlier candidates from feeds that failed this run.`);
  raw.push(...carried);

  const { items, dropped } = selectCandidates(raw, { tracked: jobs.map((j) => j.url), previous });
  for (const entry of report) entry.kept = items.filter((i) => i.source === entry.id).length;

  console.log(`\n${raw.length} items read · ${items.length} kept`);
  console.log(`dropped: ${dropped.offTopic} off-topic, ${dropped.notARole} not a research post, ${dropped.duplicate} duplicates, ${dropped.old} older than ${MAX_AGE_DAYS} days, ${dropped.tracked} already on the board`);
  for (const i of items.slice(0, 25)) console.log(`  ${String(i.relevance).padStart(3)}  ${i.title.slice(0, 90)}  [${i.source}]`);

  if (dryRun) {
    console.log("\n(dry run — nothing written)");
    return;
  }
  const out = { generated: new Date().toISOString(), sources: report, items };
  fs.writeFileSync(path.join(ROOT, "data", "discover.json"), `${JSON.stringify(out, null, 2)}\n`);
  console.log("Wrote data/discover.json");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
