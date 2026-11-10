// The schema checks that guard the data files, plus a check that the real files pass.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateJobs, validateBoard, validateSources, validateHealth, validateDiscover, isHttpUrl,
} from "../scripts/validate.mjs";

const load = (name) => JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));

const job = (over = {}) => ({
  id: "sample-post", title: "Sample", org: "Org", country: "Japan", type: "opening", applied: null,
  deadline: "2026-12-31", url: "https://example.org/job", score: 7.5, subscores: [7, 8, 7, 8, 6],
  added: "2026-11-01", tags: ["radar"], fit: "f", perk: "p", note: "n", ...over,
});
const file = (...jobs) => ({ schema: 2, updated: "2026-11-10", jobs });
const errorsFor = (over) => validateJobs(file(job(over)));
const mentions = (errors, text) => errors.some((e) => e.includes(text));

test("the real data files are valid", () => {
  assert.deepEqual(validateJobs(load("jobs.json")), []);
  assert.deepEqual(validateBoard(load("board.json")), []);
  assert.deepEqual(validateSources(load("sources.json")), []);
  assert.deepEqual(validateHealth(load("health.json")), []);
  assert.deepEqual(validateDiscover(load("discover.json")), []);
});

test("every tracked entry has what the page needs", () => {
  const { jobs } = load("jobs.json");
  assert.ok(jobs.length >= 27);
  for (const j of jobs) {
    assert.ok(j.fit.length > 20 && j.perk.length > 20 && j.note.length > 10, `${j.id} has thin text`);
    assert.ok(!/TODO|TBD|\[PLACEHOLDER\]|undefined|null/.test(j.note), `${j.id} note looks unfinished`);
  }
});

test("a well-formed job passes", () => {
  assert.deepEqual(validateJobs(file(job())), []);
  assert.deepEqual(validateJobs(file(job({ score: null, subscores: null, deadline: null, tags: [] }))), []);
  assert.deepEqual(validateJobs(file(job({ applied: "submitted", closed: true, contacts: [{ name: "A", email: "a@b.org" }] }))), []);
});

test("ids must be slugs and unique", () => {
  assert.ok(mentions(errorsFor({ id: "Bad ID" }), "id must be"));
  assert.ok(mentions(errorsFor({ id: "trailing-" }), "id must be"));
  assert.ok(mentions(validateJobs(file(job(), job())), "duplicate id"));
});

test("dates must be real calendar dates", () => {
  assert.ok(mentions(errorsFor({ deadline: "2026-02-30" }), "deadline"));
  assert.ok(mentions(errorsFor({ deadline: "31 Dec 2026" }), "deadline"));
  assert.ok(mentions(errorsFor({ deadline: "2026-13-01" }), "deadline"));
  assert.ok(mentions(errorsFor({ added: "yesterday" }), "added"));
  assert.deepEqual(errorsFor({ deadline: "2028-02-29" }), [], "a leap day is real");
});

test("links must be http(s)", () => {
  for (const url of ["javascript:alert(1)", "ftp://example.org", "example.org", "", null]) {
    assert.ok(mentions(errorsFor({ url }), "url must be"), String(url));
  }
  assert.equal(isHttpUrl("https://example.org"), true);
});

test("type, applied and closed only take their allowed values", () => {
  assert.ok(mentions(errorsFor({ type: "job" }), "type must be"));
  assert.ok(mentions(errorsFor({ applied: "yes" }), "applied must be"));
  assert.ok(mentions(errorsFor({ applied: undefined }), "applied must be"));
  assert.ok(mentions(errorsFor({ closed: false }), "closed, when present"));
  assert.ok(mentions(errorsFor({ type: "lead", applied: "submitted" }), "a lead cannot be applied to"));
});

test("scores are 0–10 and travel with their five sub-scores", () => {
  assert.ok(mentions(errorsFor({ score: 11 }), "score must be"));
  assert.ok(mentions(errorsFor({ score: "8.1" }), "score must be"));
  assert.ok(mentions(errorsFor({ subscores: [7, 8, 7, 8] }), "subscores must be"));
  assert.ok(mentions(errorsFor({ score: null }), "set or null together"));
  assert.ok(mentions(errorsFor({ subscores: null }), "set or null together"));
});

test("missing text, bad tags, bad contacts and stray fields are caught", () => {
  assert.ok(mentions(errorsFor({ title: "  " }), "title must be"));
  assert.ok(mentions(errorsFor({ note: undefined }), "note must be"));
  assert.ok(mentions(errorsFor({ tags: "radar" }), "tags must be"));
  assert.ok(mentions(errorsFor({ tags: ["ok", ""] }), "tags must be"));
  assert.ok(mentions(errorsFor({ contacts: [] }), "contacts, when present"));
  assert.ok(mentions(errorsFor({ contacts: [{ name: "A", email: "not-an-email" }] }), "not a valid address"));
  assert.ok(mentions(errorsFor({ status: "legacy field" }), 'unknown field "status"'));
  assert.ok(mentions(errorsFor({ link: "https://example.org" }), 'unknown field "link"'));
});

test("the jobs file itself must be shaped correctly", () => {
  assert.ok(validateJobs(null).length > 0);
  assert.ok(mentions(validateJobs({ schema: 1, updated: "2026-11-10", jobs: [] }), "schema must be 2"));
  assert.ok(mentions(validateJobs({ schema: 2, updated: "2026-11-10", jobs: {} }), "jobs must be an array"));
  assert.ok(mentions(validateJobs({ schema: 2, updated: "soon", jobs: [] }), "updated must be"));
});

test("board: scan dates, milestones and log entries are checked", () => {
  const board = { meta: { lastScan: "2026-11-06", nextScan: "2026-11-13" }, milestones: [{ date: "2026-12-31", text: "x" }], log: ["entry"] };
  assert.deepEqual(validateBoard(board), []);
  assert.ok(mentions(validateBoard({ ...board, meta: { lastScan: "2026-11-06", nextScan: "next week" } }), "nextScan"));
  assert.ok(mentions(validateBoard({ ...board, milestones: [{ date: "2026-12-32", text: "x" }] }), "milestones[0].date"));
  assert.ok(mentions(validateBoard({ ...board, log: ["ok", ""] }), "log must be"));
});

test("sources: a templated address needs queries", () => {
  const src = (over) => ({ sources: [{ id: "a-board", name: "A", type: "feed", enabled: true, url: "https://a.org/rss", ...over }] });
  assert.deepEqual(validateSources(src({})), []);
  assert.deepEqual(validateSources(src({ url: "https://a.org/rss?q={q}", queries: ["postdoc"] })), []);
  assert.ok(mentions(validateSources(src({ url: "https://a.org/rss?q={q}" })), "queries must be"));
  assert.ok(mentions(validateSources(src({ enabled: "yes" })), "enabled must be"));
  assert.ok(mentions(validateSources(src({ url: "a.org/rss" })), "url must be"));
  assert.ok(mentions(validateSources(src({ type: "scraper" })), 'type must be "feed"'));
});

test("health: only known kinds and http(s) links are accepted from the checker", () => {
  const health = (rec) => ({ checked: "2026-11-10T02:17:00Z", links: { "sample-post": { url: "https://example.org/job", kind: "ok", http: 200, checked: "2026-11-10", ...rec } } });
  assert.deepEqual(validateHealth(health({})), []);
  assert.deepEqual(validateHealth(health({ kind: "dead", http: null, detail: "the domain does not resolve" })), []);
  assert.ok(mentions(validateHealth(health({ kind: "exploded" })), "unknown kind"));
  assert.ok(mentions(validateHealth(health({ url: "javascript:alert(1)" })), "url must be"));
  assert.ok(mentions(validateHealth(health({ checked: "today" })), "checked must be"));
  assert.ok(mentions(validateHealth({ checked: null, links: [] }), "links must be an object"));
});

test("discover: candidates from feeds must be well-formed before they are published", () => {
  const item = (over) => ({ id: "d-1", title: "Postdoc", url: "https://a.org/1", sourceName: "A", summary: "", matched: [], published: null, ...over });
  const disc = (...items) => ({ generated: "2026-11-10T02:20:00Z", sources: [], items });
  assert.deepEqual(validateDiscover(disc(item())), []);
  assert.ok(mentions(validateDiscover(disc(item({ url: "javascript:alert(1)" }))), "url must be"));
  assert.ok(mentions(validateDiscover(disc(item({ title: "" }))), "title must be"));
  assert.ok(mentions(validateDiscover(disc(item(), item())), "duplicate id"));
  assert.ok(mentions(validateDiscover(disc(item({ matched: "monsoon" }))), "matched must be"));
  assert.ok(mentions(validateDiscover({ generated: null, sources: [], items: {} }), "items must be an array"));
});
