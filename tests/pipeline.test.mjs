// The automated pipeline's decision logic: link classification, feed parsing,
// relevance screening and candidate selection. No network is used.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, redirectedAway, summarise, textOf, looksLikeOutage } from "../scripts/lib/classify.mjs";
import { parseFeed, cleanText, decodeEntities, looksLikeFeed } from "../scripts/lib/feed.mjs";
import { screen, canonicalUrl, titleKey, idFor, KEEP_AT } from "../scripts/lib/relevance.mjs";
import { selectCandidates, carryOver } from "../scripts/discover.mjs";

const page = (body, title = "Postdoc in radar meteorology") =>
  `<!doctype html><html><head><title>${title}</title></head><body>${body}${" lorem ipsum".repeat(40)}</body></html>`;
const ok200 = (over = {}) => ({ requestedUrl: "https://example.org/jobs/123/postdoc", status: 200, contentType: "text/html; charset=utf-8", finalUrl: "https://example.org/jobs/123/postdoc", body: page("<h1>Apply now</h1>"), ...over });

// ---------- classify ----------

test("classify: a normal page is ok", () => {
  assert.deepEqual(classify(ok200()), { kind: "ok", detail: "" });
});

test("classify: gone pages and vanished domains are dead", () => {
  assert.equal(classify(ok200({ status: 404 })).kind, "dead");
  assert.equal(classify(ok200({ status: 410 })).kind, "dead");
  assert.equal(classify({ requestedUrl: "https://gone.example", error: "fetch failed", errorCode: "ENOTFOUND" }).kind, "dead");
});

test("classify: a link that returns an image is not a page (the CCRS logo case)", () => {
  const r = classify(ok200({ requestedUrl: "https://www.weather.gov.sg/ccrs/", finalUrl: "https://www.weather.gov.sg/wp-content/uploads/2015/03/ccrs.png", contentType: "image/png", body: "" }));
  assert.equal(r.kind, "not-a-page");
  assert.match(r.detail, /image\/png/);
});

test("classify: a PDF is a legitimate posting document", () => {
  assert.equal(classify(ok200({ contentType: "application/pdf", body: "" })).kind, "ok");
});

test("classify: bot walls and rate limits prove nothing either way", () => {
  for (const status of [401, 403, 429, 999]) assert.equal(classify(ok200({ status })).kind, "blocked", String(status));
});

test("classify: server errors and timeouts are check failures, not dead links", () => {
  assert.equal(classify(ok200({ status: 503 })).kind, "error");
  assert.equal(classify({ requestedUrl: "https://slow.example", error: "The operation was aborted due to timeout", errorCode: "TimeoutError" }).kind, "error");
  assert.equal(classify({ requestedUrl: "https://x.example", error: "fetch failed", errorCode: "EAI_AGAIN" }).kind, "error");
  assert.equal(classify({ requestedUrl: "https://x.example", error: "fetch failed", errorCode: "ECONNRESET" }).kind, "error");
});

test("classify: an expired posting that bounces to the listings page is flagged", () => {
  const r = classify(ok200({
    requestedUrl: "https://www.nature.com/naturecareers/job/12850743/postdoc-research-scientist-ai-weather-forecasting",
    finalUrl: "https://www.nature.com/naturecareers/jobs/",
  }));
  assert.equal(r.kind, "redirected-home");
  assert.match(r.detail, /naturecareers\/jobs/);
});

test("redirectedAway: only a shallower page that drops the posting counts", () => {
  assert.equal(redirectedAway("https://a.org/jobs/123/slug", "https://a.org/"), true);
  assert.equal(redirectedAway("https://a.org/jobs/123/slug", "https://a.org/jobs"), true);
  assert.equal(redirectedAway("https://a.org/jobs/123/slug", "https://a.org/jobs/123/slug/"), false, "trailing slash");
  assert.equal(redirectedAway("http://a.org/jobs/123", "https://www.a.org/jobs/123"), false, "https and www upgrades");
  assert.equal(redirectedAway("https://a.org/postdoc", "https://b.org/about/postdoctoral-fellowships"), false, "moved deeper");
  assert.equal(redirectedAway("https://a.org/", "https://a.org/en/"), false, "a home page gaining a language prefix");
  assert.equal(redirectedAway("https://a.org/en/study/postdoc", "https://a.org/postdoc"), false, "shorter but still names the posting");
  assert.equal(redirectedAway("not a url", "https://a.org/"), false);
});

test("classify: a page that says it is closed is soft-closed, with the evidence", () => {
  const r = classify(ok200({ body: page("<p>Sorry, this job has expired.</p>") }));
  assert.equal(r.kind, "soft-closed");
  assert.match(r.detail, /this job has expired/);
  assert.equal(classify(ok200({ body: page("<div>No longer accepting applications</div>") })).kind, "soft-closed");
});

test("classify: closure words inside scripts or unrelated wording do not trip it", () => {
  assert.equal(classify(ok200({ body: page('<script>var msg = "this job has expired";</script><h1>Apply</h1>') })).kind, "ok");
  assert.equal(classify(ok200({ body: page("<p>Applications close on 31 December. The previous position was filled in 2024.</p>") })).kind, "ok");
});

test("classify: a 200 page whose title says not found is dead", () => {
  assert.equal(classify(ok200({ body: page("<h1>Oops</h1>", "404 - Page not found") })).kind, "dead");
  assert.equal(classify(ok200({ body: page("<h1>Jobs</h1>", "Postdoc found in translation") })).kind, "ok");
});

test("classify: a script-drawn shell is ok but says it could not be read", () => {
  const r = classify(ok200({ body: '<html><head><title>Careers</title></head><body><div id="root"></div><script src="app.js"></script></body></html>' }));
  assert.equal(r.kind, "ok");
  assert.match(r.detail, /drawn by script/);
});

test("summarise groups kinds into ok / problem / unverifiable", () => {
  const links = { a: { kind: "ok" }, b: { kind: "dead" }, c: { kind: "soft-closed" }, d: { kind: "blocked" }, e: { kind: "error" }, f: { kind: "not-a-page" } };
  assert.deepEqual(summarise(links), { total: 6, ok: 1, problem: 3, unverifiable: 2 });
});

test("looksLikeOutage: an offline checker must not mark the whole board dead", () => {
  const rec = (http) => ({ kind: http ? "ok" : "dead", http });
  const offline = Object.fromEntries(Array.from({ length: 27 }, (_, i) => [`j${i}`, rec(null)]));
  assert.equal(looksLikeOutage(offline), true, "no responses at all");
  const healthy = Object.fromEntries(Array.from({ length: 27 }, (_, i) => [`j${i}`, rec(i < 3 ? null : 200)]));
  assert.equal(looksLikeOutage(healthy), false, "a few vanished domains are real findings");
  const mostly404 = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`j${i}`, { kind: "dead", http: 404 }]));
  assert.equal(looksLikeOutage(mostly404), false, "a 404 is a response; many of them is news, not an outage");
  assert.equal(looksLikeOutage({ a: rec(null), b: rec(null) }), false, "too few links to judge");
});

test("textOf drops scripts, styles and tags", () => {
  assert.equal(textOf("<style>p{}</style><p>Hello&nbsp;<b>there</b></p><script>x()</script>"), "Hello there");
});

// ---------- feed parsing ----------

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Jobs</title>
<item>
  <title><![CDATA[Postdoctoral Fellow — Monsoon & Intraseasonal Variability]]></title>
  <link>https://findajob.example.org/job/8029001/postdoc-monsoon/?TrackID=26</link>
  <description>&lt;p&gt;Work on &lt;b&gt;BSISO&lt;/b&gt; prediction with machine learning.&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;</description>
  <pubDate>Fri, 06 Nov 2026 09:00:00 GMT</pubDate>
</item>
<item>
  <title>Assistant Professor of Climate Science</title>
  <link>https://findajob.example.org/job/8029002/assistant-professor/</link>
  <description>Tenure-track faculty position.</description>
  <pubDate>Thu, 05 Nov 2026 09:00:00 GMT</pubDate>
</item>
<item><title>No link here</title><description>ignored</description></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Vacancies</title>
<entry>
  <title type="html">Research Fellow in Radar QPE &amp;amp; Nowcasting</title>
  <link rel="self" href="https://jobs.example.ac.uk/feed/1"/>
  <link rel="alternate" type="text/html" href="https://jobs.example.ac.uk/job/ABC123"/>
  <summary>Weather radar and precipitation estimation.</summary>
  <updated>2026-11-08T12:00:00Z</updated>
</entry>
</feed>`;

test("parseFeed reads RSS items, strips markup and skips unusable entries", () => {
  const items = parseFeed(RSS);
  assert.equal(items.length, 2, "items without an http link are skipped");
  assert.deepEqual(items[0], {
    title: "Postdoctoral Fellow — Monsoon & Intraseasonal Variability",
    url: "https://findajob.example.org/job/8029001/postdoc-monsoon/?TrackID=26",
    summary: "Work on BSISO prediction with machine learning.",
    published: "2026-11-06T09:00:00.000Z",
  });
  assert.ok(!items[0].summary.includes("alert"), "script content is removed, not just its tags");
});

test("parseFeed reads Atom entries and prefers the alternate link", () => {
  const items = parseFeed(ATOM);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://jobs.example.ac.uk/job/ABC123");
  assert.equal(items[0].title, "Research Fellow in Radar QPE & Nowcasting");
  assert.equal(items[0].published, "2026-11-08T12:00:00.000Z");
});

test("parseFeed returns nothing for non-feeds and tolerates junk", () => {
  assert.deepEqual(parseFeed("<html><body>Access denied</body></html>"), []);
  assert.deepEqual(parseFeed(""), []);
  assert.deepEqual(parseFeed(null), []);
  assert.equal(looksLikeFeed(RSS), true);
  assert.equal(looksLikeFeed(ATOM), true);
  assert.equal(looksLikeFeed("<!doctype html><html>"), false);
});

test("cleanText and decodeEntities produce plain text of bounded length", () => {
  assert.equal(decodeEntities("A &amp; B &#8211; C &#x27;D&#x27; &unknown;"), "A & B – C 'D' &unknown;");
  assert.equal(cleanText("  <p>Hello\n\n<b>world</b></p>\u0000 "), "Hello world");
  const long = cleanText("word ".repeat(400), 100);
  assert.ok(long.length <= 100 && long.endsWith("…"));
});

// ---------- relevance ----------

test("screen keeps on-topic postdoc roles and explains what matched", () => {
  const r = screen({ title: "Postdoctoral Fellow — Monsoon & Intraseasonal Variability", summary: "BSISO prediction with machine learning." });
  assert.equal(r.keep, true);
  assert.ok(r.relevance >= 20, String(r.relevance));
  assert.ok(r.matched.includes("monsoon") && r.matched.includes("intraseasonal") && r.matched.includes("machine learning"));
});

test("screen drops roles at the wrong level, whatever the topic", () => {
  for (const title of [
    "Assistant Professor of Monsoon Dynamics", "PhD Position in Radar Meteorology", "PhD studentship: monsoon prediction",
    "Lecturer in Atmospheric Science", "Doctoral Researcher (f/m/d) in tropical convection", "Research Technician, weather radar",
    "Tenure-Track Faculty Position in Climate Dynamics",
  ]) {
    assert.equal(screen({ title, summary: "monsoon radar machine learning postdoc" }).keep, false, title);
  }
});

test("screen drops off-topic postdocs and things that are not research posts", () => {
  assert.equal(screen({ title: "Postdoctoral Fellow in Marine Microbiology", summary: "Ocean sampling and climate context." }).keep, false);
  assert.equal(screen({ title: "Postdoc in Climate Policy", summary: "Economics of carbon pricing." }).keep, false);
  assert.equal(screen({ title: "Monsoon dynamics workshop announcement", summary: "Register now." }).keep, false);
});

test("screen: a title match counts double a mention in the summary", () => {
  const inTitle = screen({ title: "Postdoc in weather radar applications", summary: "" });
  const inSummary = screen({ title: "Postdoc in applications", summary: "Uses weather radar." });
  assert.ok(inTitle.relevance > inSummary.relevance);
});

test("screen: the bar sits between a field-level title and a bare mention", () => {
  const generic = screen({ title: "Postdoctoral researcher in atmospheric science", summary: "" });
  assert.ok(generic.keep && generic.relevance >= KEEP_AT, "a postdoc squarely in the field is kept on its title alone");
  const mention = screen({ title: "Postdoctoral researcher in soil chemistry", summary: "Some links to climate." });
  assert.ok(!mention.keep && mention.relevance < KEEP_AT, "a passing mention of climate is not enough");
});

test("canonicalUrl ignores tracking parameters, www, case, fragments and trailing slashes", () => {
  const a = canonicalUrl("https://www.FindAJob.agu.org/job/8029001/postdoc-monsoon/?TrackID=26&utm_source=rss#apply");
  const b = canonicalUrl("https://findajob.agu.org/job/8029001/postdoc-monsoon");
  assert.equal(a, b);
  assert.notEqual(canonicalUrl("https://a.org/job?id=1"), canonicalUrl("https://a.org/job?id=2"), "meaningful parameters are kept");
  assert.equal(canonicalUrl("nonsense"), "");
});

test("titleKey and idFor are stable", () => {
  assert.equal(titleKey("Post-Doc: Radar  QPE!"), titleKey("post doc radar qpe"));
  assert.equal(idFor("https://a.org/x/?utm_source=y"), idFor("https://www.a.org/x"));
  assert.match(idFor("https://a.org/x"), /^d-[0-9a-f]{12}$/);
});

// ---------- candidate selection ----------

const NOW = new Date("2026-11-10T03:00:00Z");
const raw = (over) => ({ title: "Postdoc in monsoon prediction", url: "https://a.org/job/1", summary: "Machine learning.", published: "2026-11-06T09:00:00.000Z", source: "s1", sourceName: "Source One", ...over });

test("selectCandidates drops postings already on the board, duplicates and stale items", () => {
  const { items, dropped } = selectCandidates([
    raw({}),
    raw({ url: "https://a.org/job/1/?TrackID=9" }), // same posting, tracking link
    raw({ url: "https://b.org/mirror/77", source: "s2", sourceName: "Source Two" }), // same title on another board
    raw({ title: "Postdoc in S2S prediction", url: "https://recruit.ap.uci.edu/JPF10438" }), // already tracked
    raw({ title: "Postdoc in radar QPE", url: "https://a.org/job/2", published: "2026-08-01T00:00:00.000Z" }), // too old
    raw({ title: "Postdoc in medieval history", url: "https://a.org/job/3", summary: "" }),
    raw({ title: "Professor of Meteorology", url: "https://a.org/job/4" }),
  ], { tracked: ["https://recruit.ap.uci.edu/JPF10438"], now: NOW });
  assert.equal(items.length, 1);
  assert.deepEqual(dropped, { tracked: 1, duplicate: 2, old: 1, offTopic: 1, notARole: 1 });
});

test("selectCandidates ranks by relevance and remembers when an item was first seen", () => {
  const first = selectCandidates([raw({})], { now: new Date("2026-11-03T03:00:00Z") }).items[0];
  assert.equal(first.firstSeen, "2026-11-03");
  const { items } = selectCandidates([
    raw({ title: "Postdoc in atmospheric science", url: "https://a.org/job/9", summary: "" }),
    raw({}),
  ], { previous: [first], now: NOW });
  assert.deepEqual(items.map((i) => i.url), ["https://a.org/job/1", "https://a.org/job/9"]);
  assert.equal(items[0].firstSeen, "2026-11-03", "kept from the earlier run");
  assert.equal(items[1].firstSeen, "2026-11-10");
  assert.deepEqual(Object.keys(items[0]).sort(), ["firstSeen", "id", "matched", "published", "relevance", "source", "sourceName", "summary", "title", "url"]);
});

test("carryOver keeps a failed feed's earlier candidates and nothing else", () => {
  const previous = [
    { id: idFor("https://a.org/job/1"), title: "Postdoc in monsoon prediction", url: "https://a.org/job/1", summary: "ML.", published: null, source: "down", sourceName: "Down Board", relevance: 13, matched: ["monsoon"], firstSeen: "2026-11-03" },
    { id: idFor("https://b.org/job/2"), title: "Postdoc in radar QPE", url: "https://b.org/job/2", summary: "", published: null, source: "up", sourceName: "Up Board", relevance: 16, matched: [], firstSeen: "2026-11-03" },
  ];
  const carried = carryOver(previous, ["down"]);
  assert.deepEqual(carried, [{ title: "Postdoc in monsoon prediction", url: "https://a.org/job/1", summary: "ML.", published: null, source: "down", sourceName: "Down Board" }]);
  const { items } = selectCandidates(carried, { previous, now: NOW });
  assert.equal(items[0].firstSeen, "2026-11-03", "and they keep their original first-seen date");
  assert.deepEqual(carryOver(previous, []), []);
});

test("selectCandidates keeps an undated item and caps the list", () => {
  assert.equal(selectCandidates([raw({ published: null })], { now: NOW }).items.length, 1);
  const many = Array.from({ length: 200 }, (_, i) => raw({ title: `Postdoc in monsoon prediction ${i}`, url: `https://a.org/job/${i}` }));
  assert.equal(selectCandidates(many, { now: NOW }).items.length, 80);
});
