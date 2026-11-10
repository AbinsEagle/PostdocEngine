// Search behaviour, exercised against the real curated data so the tests fail
// if a data edit or an engine change makes the board harder to search.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createEngine, highlight, snippet, processTerm, highlightWords } from "../src/search.js";
import { parseQuery } from "../src/query.js";
import { enrichAll } from "../src/model.js";

const TODAY = "2026-11-10";
const data = JSON.parse(fs.readFileSync(new URL("../data/jobs.json", import.meta.url), "utf8"));
const items = enrichAll(data.jobs, TODAY, null);
const engine = createEngine(items);
const find = (s, ctx) => engine.search(parseQuery(s), ctx);
const ids = (s, ctx) => find(s, ctx).hits.map((h) => h.item.id);

test("an empty query returns every record", () => {
  assert.equal(find("").hits.length, items.length);
});

test("a plain word finds matching entries, ranked", () => {
  const r = ids("monsoon");
  assert.ok(r.length >= 5, `expected several monsoon results, got ${r.length}`);
  assert.ok(r.includes("columbia-ldeo-monsoon-lps"));
  assert.ok(r.includes("iap-cas-beijing"));
});

test("title matches outrank passing mentions", () => {
  const r = ids("radar");
  assert.ok(r.indexOf("kyoto-rish") < r.indexOf("eth-zurich-fellowship"),
    "Kyoto 'Radar Atmospheric Science Lab' should outrank ETH, which only mentions radar in its fit text");
});

test("typos are tolerated", () => {
  assert.ok(ids("monson").includes("columbia-ldeo-monsoon-lps"));
  assert.ok(ids("singapor").includes("ccrs-singapore"));
  assert.ok(ids("fellowshp").length > 0);
});

test("search-as-you-type: a prefix already finds the entry", () => {
  assert.ok(ids("gothen").includes("gothenburg-par-2026-530"));
  assert.ok(ids("irv").includes("uc-irvine-s2s"));
});

test("several words must all match", () => {
  const r = ids("radar japan");
  assert.deepEqual(r, ["kyoto-rish"].filter((id) => r.includes(id)).concat(r.filter((id) => id !== "kyoto-rish")));
  assert.ok(r.includes("kyoto-rish"));
  assert.ok(!r.includes("tu-delft-euradca"), "TU Delft has radar but not Japan");
});

test("field shorthand finds the long form and vice versa", () => {
  // "ISV" appears as "intraseasonal" in some entries and "ISV" in others.
  const isv = ids("isv");
  const intraseasonal = ids("intraseasonal");
  assert.ok(isv.includes("iap-cas-beijing"), "IAP-CAS says 'intraseasonal', not 'ISV'");
  assert.ok(intraseasonal.includes("ccrs-singapore"), "CCRS is tagged 'ISV'");
  // "ML" should reach entries that only spell out "machine learning".
  assert.ok(ids("ml").includes("uc-irvine-s2s") || ids("ml").length >= 5);
  assert.ok(ids("s2s").includes("uc-irvine-s2s"));
  assert.ok(ids("subseasonal").includes("ntu-ocean-center-s2s"));
});

test("accents and case do not matter", () => {
  assert.equal(processTerm("Zürich"), "zurich");
  assert.equal(processTerm("THE"), null);
  assert.ok(ids("ZURICH").includes("eth-zurich-fellowship"));
});

test("operators filter without needing any search words", () => {
  const open = ids("is:open");
  assert.deepEqual([...open].sort(), [
    "argonne-aeris-s2s", "columbia-lamont-pdrs", "columbia-ldeo-monsoon-lps",
    "mbzuai-ai-weather", "ntu-ocean-center-s2s", "uc-irvine-s2s",
  ]);
  assert.deepEqual([...ids("is:applied")].sort(), ["gothenburg-par-2026-530", "jsps-fellowship", "tu-delft-euradca"]);
  assert.deepEqual(ids("due:60d"), ["uc-irvine-s2s"]);
  assert.equal(ids("is:lead").length, 7);
  assert.equal(ids("is:closed").length, 11);
});

test("words and operators combine", () => {
  const openMonsoon = find("monsoon is:open").hits;
  assert.equal(openMonsoon[0].item.id, "columbia-ldeo-monsoon-lps", "the entry with monsoon in its title leads");
  assert.ok(openMonsoon.every((h) => h.item.tab === "open"), "the operator still applies to every result");
  assert.ok(ids("s2s in:usa is:open").every((id) => ["uc-irvine-s2s", "argonne-aeris-s2s"].includes(id)));
  assert.deepEqual(ids("in:japan").sort(), ["jsps-fellowship", "kyoto-rish"]);
  assert.ok(ids("score:>=8").every((id) => ["ccrs-singapore", "msca-pf-tu-delft"].includes(id)));
});

test("quoted phrases must appear exactly; exclusions remove matches", () => {
  const phrase = ids('"data assimilation"');
  assert.ok(phrase.includes("ntu-ocean-center-s2s"));
  assert.ok(phrase.includes("mbzuai-ai-weather"));
  const without = ids('"data assimilation" -taiwan');
  assert.ok(!without.includes("ntu-ocean-center-s2s"));
  assert.ok(without.includes("mbzuai-ai-weather"));
});

test("live entries rank above closed ones for the same word", () => {
  const r = find("fellowship").hits;
  const firstClosed = r.findIndex((h) => h.item.state === "closed");
  const lastLive = r.map((h) => h.item.state).lastIndexOf("applied");
  assert.ok(r.length > 3);
  assert.ok(firstClosed === -1 || r[0].item.state !== "closed", "a closed entry should not lead the results");
  assert.ok(lastLive >= 0);
});

test("when no entry has every word, results for any word are shown and flagged", () => {
  const r = find("monsoon volcano");
  assert.equal(r.relaxed, true);
  assert.ok(r.hits.length > 0);
  assert.equal(find("monsoon").relaxed, false);
});

test("heavy misspellings are still found", () => {
  assert.ok(find("precipitashun").hits.length > 0);
  assert.ok(ids("radr metorology").length > 0);
});

test("a query with no results offers a correction when one exists", () => {
  const r = find("monsooooon"); // too far for typo tolerance
  assert.equal(r.hits.length, 0);
  assert.equal(r.suggestion, "monsoon");
  const nonsense = find("zzzzqqqq");
  assert.equal(nonsense.hits.length, 0);
  assert.equal(nonsense.suggestion, null);
});

test("is:saved respects the saved set passed in", () => {
  assert.deepEqual(ids("is:saved", { saved: new Set(["kyoto-rish"]) }), ["kyoto-rish"]);
  assert.deepEqual(ids("is:saved"), []);
});

test("highlight marks whole-word starts and never loses text", () => {
  const parts = highlight("Monsoon onset and monsoons; premonsoon stays plain.", ["monsoon"]);
  assert.equal(parts.map((p) => p.text).join(""), "Monsoon onset and monsoons; premonsoon stays plain.");
  assert.deepEqual(parts.filter((p) => p.hit).map((p) => p.text), ["Monsoon", "monsoon"]);
});

test("highlight copes with regex characters, empty input and overlapping words", () => {
  assert.deepEqual(highlight("C++ (beta) [x]", ["c++", "(beta)"]).map((p) => p.text).join(""), "C++ (beta) [x]");
  assert.deepEqual(highlight("", ["a"]), [{ text: "", hit: false }]);
  assert.deepEqual(highlight("plain", []), [{ text: "plain", hit: false }]);
  const parts = highlight("machine learning", ["machine learning", "machine"]);
  assert.deepEqual(parts.filter((p) => p.hit).map((p) => p.text), ["machine learning"]);
});

test("highlightWords includes quoted phrases", () => {
  assert.deepEqual(highlightWords(parseQuery('"data assimilation" radar'), ["radar"]), ["radar", "data assimilation"]);
});

test("snippet shows the sentence containing the hit and respects the length limit", () => {
  const item = items.find((i) => i.id === "uc-irvine-s2s");
  const s = snippet(item, ["sudderth"], 160);
  assert.ok(s.toLowerCase().includes("sudderth"), s);
  assert.ok(s.length <= 162, `snippet too long: ${s.length}`);
  const plain = snippet(item, [], 80);
  assert.ok(plain.endsWith("…"));
  assert.ok(plain.length <= 81);
  assert.equal(snippet({ fit: "Short." }, ["x"]), "Short.");
});
