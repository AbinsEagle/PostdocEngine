// Requests every tracked link and records what came back in data/health.json.
// Runs on GitHub Actions (see .github/workflows/refresh-data.yml).
//
//   node scripts/check-links.mjs            check and write data/health.json
//   node scripts/check-links.mjs --dry-run  check and print, write nothing
//
// It only ever writes data/health.json. A problem found with a link is data, not a
// failure, so the script exits 0. It exits 2 and writes nothing when the machine
// running it appears to be offline — otherwise an outage here would mark every link dead.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classify, summarise, looksLikeOutage } from "./lib/classify.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 25000;
const BODY_LIMIT = 300000;
const HOST_PAUSE_MS = 1200;
const RETRY_PAUSE_MS = 4000;
const PARALLEL_HOSTS = 4;

const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; PostdocEngine-LinkCheck/2.0; +https://github.com/AbinsEagle/PostdocEngine)",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-GB,en;q=0.9",
};

// Sites that are always up. If none of these answers, the problem is this machine's network.
const CONTROL_URLS = ["https://example.com/", "https://www.wikipedia.org/", "https://github.com/"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isOnline() {
  for (const url of CONTROL_URLS) {
    const r = await fetchOnce(url);
    if (!r.error) return true;
  }
  return false;
}

async function readCapped(res, limit) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let text = "";
  try {
    while (text.length < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return text.slice(0, limit);
}

async function fetchOnce(url) {
  try {
    const res = await fetch(url, { redirect: "follow", headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const contentType = res.headers.get("content-type") || "";
    const isText = !contentType || /html|xml|text/i.test(contentType);
    let body = "";
    if (isText) body = await readCapped(res, BODY_LIMIT);
    else if (res.body) await res.body.cancel().catch(() => {}); // an image or archive: no need to download it
    return { requestedUrl: url, status: res.status, contentType, finalUrl: res.url, body };
  } catch (err) {
    const cause = err && err.cause ? err.cause : err;
    return { requestedUrl: url, error: String((err && err.message) || err), errorCode: (cause && cause.code) || (err && err.name) || "" };
  }
}

/** One retry for anything that might be a passing fault. */
export async function probe(url) {
  let r = await fetchOnce(url);
  const transient = r.error || r.status >= 500 || r.status === 429;
  if (transient) {
    await sleep(RETRY_PAUSE_MS);
    r = await fetchOnce(url);
  }
  return r;
}

async function checkAll(jobs) {
  // One host at a time per site, a few sites at once: quick without hammering anyone.
  const byHost = new Map();
  for (const job of jobs) {
    let host;
    try {
      host = new URL(job.url).hostname;
    } catch {
      host = "invalid";
    }
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(job);
  }
  const queues = [...byHost.values()];
  const today = new Date().toISOString().slice(0, 10);
  const links = {};

  async function worker() {
    for (;;) {
      const queue = queues.shift();
      if (!queue) return;
      for (let i = 0; i < queue.length; i += 1) {
        const job = queue[i];
        const r = await probe(job.url);
        const verdict = classify(r);
        const rec = { url: job.url, kind: verdict.kind, http: r.status ?? null, checked: today };
        if (verdict.detail) rec.detail = verdict.detail;
        if (r.finalUrl && r.finalUrl !== job.url) rec.finalUrl = r.finalUrl;
        links[job.id] = rec;
        console.log(`${verdict.kind.padEnd(15)} ${String(r.status ?? "-").padEnd(4)} ${job.id}${verdict.detail ? `  — ${verdict.detail}` : ""}`);
        if (i < queue.length - 1) await sleep(HOST_PAUSE_MS);
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL_HOSTS }, worker));
  return links;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { jobs } = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "jobs.json"), "utf8"));

  if (!(await isOnline())) {
    console.error("No network: none of the control sites answered. Nothing was checked and data/health.json is unchanged.");
    process.exit(2);
  }
  console.log(`Checking ${jobs.length} links…\n`);

  const unordered = await checkAll(jobs);
  if (looksLikeOutage(unordered)) {
    console.error("\nMost requests got no response at all, which points at this machine's network rather than the links. data/health.json is unchanged.");
    process.exit(2);
  }
  // Same order as jobs.json, so the file diffs cleanly from run to run.
  const links = {};
  for (const job of jobs) if (unordered[job.id]) links[job.id] = unordered[job.id];

  const summary = summarise(links);
  const health = { checked: new Date().toISOString(), summary, links };
  console.log(`\n${summary.ok} ok · ${summary.problem} with a problem · ${summary.unverifiable} could not be verified · ${summary.total} total`);

  if (dryRun) {
    console.log("\n(dry run — nothing written)");
    return;
  }
  fs.writeFileSync(path.join(ROOT, "data", "health.json"), `${JSON.stringify(health, null, 2)}\n`);
  console.log("Wrote data/health.json");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
