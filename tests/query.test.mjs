import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, parseQuery, passesFilters, synonymsOf } from "../src/query.js";
import { enrich } from "../src/model.js";

const TODAY = "2026-11-10";
const item = (over = {}) => enrich({
  id: "x", title: "Radar QPE Postdoc", org: "TU Delft", country: "Netherlands", type: "opening",
  applied: null, deadline: null, url: "https://example.org/1", score: null, subscores: null,
  added: "2026-11-01", tags: ["radar", "QPE"], fit: "Machine learning for rainfall.", perk: "p", note: "n", ...over,
}, TODAY, null);

test("tokenize keeps quoted phrases and key:\"quoted values\" together", () => {
  const toks = tokenize('monsoon "machine learning" org:"max planck" -theory in:japan');
  assert.deepEqual(toks.map((t) => [t.negated, t.key, t.value, t.quoted]), [
    [false, null, "monsoon", false],
    [false, null, "machine learning", true],
    [false, "org", "max planck", true],
    [true, null, "theory", false],
    [false, "in", "japan", false],
  ]);
});

test("parseQuery separates words, phrases, exclusions and operators", () => {
  const q = parseQuery('Monsoon "Machine Learning" -theory is:open in:Japan tag:radar score:>=7 due:30d has:contact');
  assert.deepEqual(q.terms, ["monsoon"]);
  assert.deepEqual(q.phrases, ["machine learning"]);
  assert.deepEqual(q.exclude, ["theory"]);
  assert.deepEqual(q.filters.is, ["open"]);
  assert.deepEqual(q.filters.in, ["japan"]);
  assert.deepEqual(q.filters.tag, ["radar"]);
  assert.deepEqual(q.filters.score, { op: ">=", value: 7 });
  assert.deepEqual(q.filters.due, { days: 30 });
  assert.deepEqual(q.filters.has, ["contact"]);
  assert.equal(q.hasText, true);
  assert.equal(q.isEmpty, false);
});

test("parseQuery: empty and whitespace-only input is empty", () => {
  for (const s of ["", "   ", null, undefined]) {
    const q = parseQuery(s);
    assert.equal(q.isEmpty, true);
    assert.equal(q.hasText, false);
  }
});

test("parseQuery: aliases, bare scores and country shorthands", () => {
  assert.deepEqual(parseQuery("loc:US").filters.in, ["usa"]);
  assert.deepEqual(parseQuery("country:Britain").filters.in, ["uk"]);
  assert.deepEqual(parseQuery("deadline:60").filters.due, { days: 60 });
  assert.deepEqual(parseQuery("due:<30d").filters.due, { days: 30 });
  assert.deepEqual(parseQuery("due:none").filters.due, { none: true });
  assert.deepEqual(parseQuery("score:7").filters.score, { op: ">=", value: 7 });
  assert.deepEqual(parseQuery("score:<6.5").filters.score, { op: "<", value: 6.5 });
  assert.deepEqual(parseQuery("score:none").filters.score, { op: "none" });
});

test("parseQuery: invalid operator values are reported, not silently applied", () => {
  const q = parseQuery("is:banana score:high due:soon has:money monsoon");
  assert.deepEqual(q.ignored, ["is:banana", "score:high", "due:soon", "has:money"]);
  assert.deepEqual(q.terms, ["monsoon"]);
  assert.deepEqual(q.filters.is, []);
});

test("parseQuery: an operator still being typed neither filters nor becomes a search word", () => {
  const q = parseQuery("monsoon is:");
  assert.deepEqual(q.terms, ["monsoon"]);
  assert.deepEqual(q.filters.is, []);
});

test("parseQuery: negated operators are filters, not text exclusions", () => {
  const q = parseQuery("-is:closed -in:usa radar");
  assert.deepEqual(q.not.is, ["closed"]);
  assert.deepEqual(q.not.in, ["usa"]);
  assert.deepEqual(q.exclude, []);
  assert.deepEqual(q.terms, ["radar"]);
  assert.equal(parseQuery("-is:closed").isEmpty, false);
  assert.deepEqual(parseQuery("-score:7").ignored, ["-score:7"]);
});

test("parseQuery: an unknown key is treated as ordinary text", () => {
  const q = parseQuery("gru:lstm");
  assert.deepEqual(q.terms, ["gru", "lstm"]);
  assert.equal(q.ignored.length, 0);
});

test("parseQuery: an unterminated quote still works while typing", () => {
  assert.deepEqual(parseQuery('"machine learn').phrases, ["machine learn"]);
});

test("synonymsOf expands field shorthand in both directions", () => {
  assert.deepEqual(synonymsOf("ISV"), ["intraseasonal"]);
  assert.deepEqual(synonymsOf("intraseasonal"), ["isv"]);
  assert.deepEqual(synonymsOf("s2s"), ["subseasonal", "sub seasonal"]);
  assert.deepEqual(synonymsOf("ml"), ["machine learning"]);
  assert.deepEqual(synonymsOf("volcano"), []);
});

test("passesFilters: state, country, tag, org and type operators", () => {
  const open = item({ deadline: "2026-12-31" });
  const closing = item({ deadline: "2026-11-15" });
  const closed = item({ deadline: "2026-09-01" });
  const lead = item({ type: "lead" });
  const applied = item({ applied: "submitted" });
  const pass = (it, s, ctx) => passesFilters(it, parseQuery(s), ctx);

  assert.equal(pass(open, "is:open"), true);
  assert.equal(pass(closing, "is:open"), true);
  assert.equal(pass(item(), "is:open"), true, "rolling counts as open");
  assert.equal(pass(closed, "is:open"), false);
  assert.equal(pass(closing, "is:urgent"), true);
  assert.equal(pass(open, "is:urgent"), false);
  assert.equal(pass(closed, "is:closed"), true);
  assert.equal(pass(lead, "is:lead"), true);
  assert.equal(pass(applied, "is:applied"), true);
  assert.equal(pass(open, "is:new"), true);
  assert.equal(pass(item({ added: "2026-07-21" }), "is:new"), false);

  assert.equal(pass(open, "in:netherlands"), true);
  assert.equal(pass(open, "in:nether"), true);
  assert.equal(pass(open, "in:japan"), false);
  assert.equal(pass(open, "tag:qpe org:delft type:opening"), true);
  assert.equal(pass(open, "type:lead"), false);

  assert.equal(pass(closed, "-is:closed"), false);
  assert.equal(pass(open, "-is:closed"), true);
  assert.equal(pass(open, "-in:netherlands"), false);
});

test("passesFilters: saved uses the caller's saved set", () => {
  const q = parseQuery("is:saved");
  assert.equal(passesFilters(item(), q, { saved: new Set(["x"]) }), true);
  assert.equal(passesFilters(item(), q, { saved: new Set() }), false);
  assert.equal(passesFilters(item(), q), false, "defaults to nothing saved");
});

test("passesFilters: score comparisons never match an unscored entry except score:none", () => {
  const scored = item({ score: 7.3, subscores: [1, 1, 1, 1, 1] });
  const unscored = item();
  const pass = (it, s) => passesFilters(it, parseQuery(s));
  assert.equal(pass(scored, "score:>=7"), true);
  assert.equal(pass(scored, "score:>7.3"), false);
  assert.equal(pass(scored, "score:<8"), true);
  assert.equal(pass(scored, "score:=7.3"), true);
  assert.equal(pass(unscored, "score:>=0"), false);
  assert.equal(pass(unscored, "score:<10"), false);
  assert.equal(pass(unscored, "score:none"), true);
  assert.equal(pass(scored, "score:none"), false);
});

test("passesFilters: due:N means a live deadline within N days", () => {
  const pass = (it, s) => passesFilters(it, parseQuery(s));
  assert.equal(pass(item({ deadline: "2026-12-31" }), "due:60d"), true);
  assert.equal(pass(item({ deadline: "2026-12-31" }), "due:30d"), false);
  assert.equal(pass(item({ deadline: "2026-09-01" }), "due:365d"), false, "a passed deadline is not due");
  assert.equal(pass(item(), "due:60d"), false);
  assert.equal(pass(item(), "due:none"), true);
  assert.equal(pass(item({ deadline: "2026-12-31" }), "due:none"), false);
});

test("passesFilters: has:, exact phrases and exclusions", () => {
  const withContact = item({ contacts: [{ name: "A", email: "a@b.org" }] });
  const pass = (it, s) => passesFilters(it, parseQuery(s));
  assert.equal(pass(withContact, "has:contact"), true);
  assert.equal(pass(item(), "has:contact"), false);
  assert.equal(pass(item(), "has:deadline"), false);
  assert.equal(pass(item(), '"machine learning"'), true);
  assert.equal(pass(item(), '"learning machine"'), false);
  assert.equal(pass(item(), "-rainfall"), false);
  assert.equal(pass(item(), "-volcano"), true);
});
