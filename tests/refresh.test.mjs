// The optional AI-scan endpoint (api/refresh.js), with the provider calls stubbed.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../api/refresh.js");

const realFetch = globalThis.fetch;
const KEYS = ["ANTHROPIC_API_KEY", "NVIDIA_API_KEY"];
const savedEnv = {};

beforeEach(() => {
  for (const k of KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
});

async function call(method = "POST", url = "/api/refresh") {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; } };
  await handler({ method, url }, res);
  return out;
}

const reply = (payload) => ({ ok: true, status: 200, json: async () => payload, text: async () => JSON.stringify(payload) });

const SAMPLE = [
  { t: "Postdoc in monsoon prediction", org: "Somewhere University", loc: "Japan", score: 7.4, deadline: "2026-12-15",
    link: "https://example.org/jobs/42", tags: ["monsoon", "ML"], why: "Matches onset work.", perk: "Good group." },
  { t: "Suspicious posting", org: "Nowhere", loc: "", link: "javascript:alert(1)", deadline: "next Friday", tags: "not-an-array" },
];

test("with no key configured the endpoint says so instead of failing", async () => {
  const r = await call();
  assert.equal(r.status, 501);
  assert.equal(r.body.error, "not_configured");
});

test("other HTTP methods are refused", async () => {
  assert.equal((await call("DELETE")).status, 405);
});

test("Anthropic results are returned in the board's field names, flagged live", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  globalThis.fetch = async () => reply({ stop_reason: "end_turn", content: [{ type: "text", text: "```json\n" + JSON.stringify(SAMPLE) + "\n```" }] });
  const r = await call();
  assert.equal(r.status, 200);
  assert.equal(r.body.provider, "anthropic");
  assert.equal(r.body.count, 2);
  const [a, b] = r.body.jobs;
  assert.deepEqual(
    { title: a.title, org: a.org, country: a.country, url: a.url, deadline: a.deadline, why: a.why, live: a.live, suggested: a.suggested },
    { title: "Postdoc in monsoon prediction", org: "Somewhere University", country: "Japan", url: "https://example.org/jobs/42",
      deadline: "2026-12-15", why: "Matches onset work.", live: true, suggested: false },
  );
  assert.equal(b.url, "", "a non-http link is dropped rather than passed to the page");
  assert.equal(b.deadline, null, "a deadline that is not a date is dropped");
  assert.deepEqual(b.tags, [], "malformed tags become an empty list");
});

test("NVIDIA results are flagged as suggestions and never carry a deadline", async () => {
  process.env.NVIDIA_API_KEY = "test";
  globalThis.fetch = async () => reply({ choices: [{ message: { content: JSON.stringify(SAMPLE) } }] });
  const r = await call();
  assert.equal(r.status, 200);
  assert.equal(r.body.provider, "nvidia");
  assert.ok(r.body.jobs.every((j) => j.suggested === true && j.live === false && j.deadline === null));
});

test("a provider error is reported, not thrown", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  globalThis.fetch = async () => ({ ok: false, status: 529, text: async () => "overloaded" });
  const r = await call();
  assert.equal(r.status, 502);
  assert.equal(r.body.error, "anthropic_error");
});

test("a reply with no JSON array yields an empty result, not a crash", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  globalThis.fetch = async () => reply({ stop_reason: "end_turn", content: [{ type: "text", text: "I could not verify any postings." }] });
  const r = await call();
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.jobs, []);
});
