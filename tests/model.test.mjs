import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayNumber, daysUntil, shortDate, stateOf, tabOf, linkStatus, enrich, timeline, tally, upcoming, sortItems,
} from "../src/model.js";

const TODAY = "2026-11-10";
const job = (over = {}) => ({
  id: "x", title: "T", org: "O", country: "C", type: "opening", applied: null, deadline: null,
  url: "https://example.org/job/1", score: null, subscores: null, added: "2026-11-01",
  tags: [], fit: "f", perk: "p", note: "n", ...over,
});

test("daysUntil counts whole calendar days and is negative after the date", () => {
  assert.equal(daysUntil("2026-11-10", TODAY), 0);
  assert.equal(daysUntil("2026-12-31", TODAY), 51);
  assert.equal(daysUntil("2026-11-09", TODAY), -1);
  assert.equal(daysUntil("2027-01-15", TODAY), 66);
});

test("dayNumber uses a Date's local calendar date, whatever the time of day", () => {
  const lateEvening = new Date(2026, 10, 10, 23, 59);
  const earlyMorning = new Date(2026, 10, 10, 0, 1);
  assert.equal(dayNumber(lateEvening), dayNumber("2026-11-10"));
  assert.equal(dayNumber(earlyMorning), dayNumber("2026-11-10"));
});

test("shortDate drops the year only when it is the current one", () => {
  assert.equal(shortDate("2026-12-31", TODAY), "31 Dec");
  assert.equal(shortDate("2027-01-15", TODAY), "15 Jan 2027");
});

test("stateOf: an opening is open, closing, rolling or closed by its deadline", () => {
  assert.equal(stateOf(job({ deadline: "2026-12-31" }), TODAY), "open");
  assert.equal(stateOf(job({ deadline: "2026-11-24" }), TODAY), "closing"); // exactly 14 days
  assert.equal(stateOf(job({ deadline: "2026-11-25" }), TODAY), "open"); // 15 days
  assert.equal(stateOf(job({ deadline: "2026-11-10" }), TODAY), "closing"); // closes today, still open
  assert.equal(stateOf(job({ deadline: "2026-11-09" }), TODAY), "closed");
  assert.equal(stateOf(job({ deadline: null }), TODAY), "rolling");
});

test("stateOf: the same record changes state as the calendar moves — no edit needed", () => {
  const j = job({ deadline: "2026-12-31" });
  assert.equal(stateOf(j, "2026-12-01"), "open");
  assert.equal(stateOf(j, "2026-12-20"), "closing");
  assert.equal(stateOf(j, "2026-12-31"), "closing");
  assert.equal(stateOf(j, "2027-01-01"), "closed");
});

test("stateOf: applied wins over a passed deadline; manual closed wins over rolling", () => {
  assert.equal(stateOf(job({ applied: "submitted", deadline: "2026-07-31" }), TODAY), "applied");
  assert.equal(stateOf(job({ closed: true }), TODAY), "closed");
  assert.equal(stateOf(job({ type: "lead" }), TODAY), "lead");
  assert.equal(stateOf(job({ type: "lead", closed: true }), TODAY), "closed");
});

test("tabOf groups states into the three working tabs", () => {
  assert.equal(tabOf("open"), "open");
  assert.equal(tabOf("closing"), "open");
  assert.equal(tabOf("rolling"), "open");
  assert.equal(tabOf("applied"), "applied");
  assert.equal(tabOf("lead"), "leads");
  assert.equal(tabOf("closed"), "leads");
});

test("linkStatus ignores a check made against a different URL", () => {
  const j = job();
  const stale = { links: { x: { url: "https://example.org/old", kind: "dead", checked: "2026-11-09" } } };
  assert.equal(linkStatus(j, stale).level, "unknown");
  assert.equal(linkStatus(j, null).level, "unknown");
  assert.equal(linkStatus(j, { links: {} }).level, "unknown");
});

test("linkStatus maps check results to ok / problem / unverifiable", () => {
  const j = job();
  const rec = (kind) => ({ links: { x: { url: j.url, kind, http: 200, checked: "2026-11-09" } } });
  assert.equal(linkStatus(j, rec("ok")).level, "ok");
  for (const kind of ["dead", "not-a-page", "redirected-home", "soft-closed"]) {
    assert.equal(linkStatus(j, rec(kind)).level, "problem", kind);
  }
  assert.equal(linkStatus(j, rec("blocked")).level, "unverifiable");
  assert.equal(linkStatus(j, rec("error")).level, "unverifiable");
  assert.equal(linkStatus(j, rec("something-new")).level, "unknown");
});

test("enrich warns about a broken link only while the entry is still actionable", () => {
  const dead = (j) => ({ links: { x: { url: j.url, kind: "dead", checked: "2026-11-09" } } });
  const open = job({ deadline: "2026-12-31" });
  const applied = job({ applied: "submitted" });
  const closed = job({ deadline: "2026-09-01" });
  assert.equal(enrich(open, TODAY, dead(open)).linkWarning, true);
  assert.equal(enrich(applied, TODAY, dead(applied)).linkWarning, false);
  assert.equal(enrich(closed, TODAY, dead(closed)).linkWarning, false);
});

test("enrich does not mutate its input and flags recently added entries", () => {
  const j = Object.freeze(job({ added: "2026-11-05" }));
  const e = enrich(j, TODAY, null);
  assert.equal(e.isNew, true);
  assert.equal(enrich(job({ added: "2026-09-30" }), TODAY, null).isNew, false);
  assert.equal("state" in j, false);
});

test("timeline describes each state in plain words", () => {
  const line = (over) => timeline(enrich(job(over), TODAY, null), TODAY);
  assert.equal(line({ deadline: "2026-12-31" }), "Closes 31 Dec · 51 days left");
  assert.equal(line({ deadline: "2026-11-11" }), "Closes 11 Nov · 1 day left");
  assert.equal(line({ deadline: "2026-11-10" }), "Closes 10 Nov · closes today");
  assert.equal(line({}), "No fixed deadline");
  assert.equal(line({ deadline: "2026-09-10" }), "Closed 10 Sep");
  assert.equal(line({ closed: true }), "Presumed closed");
  assert.equal(line({ applied: "submitted", deadline: "2026-07-31" }), "Applied · call closed 31 Jul");
  assert.equal(line({ applied: "submitted" }), "Applied");
  assert.equal(line({ type: "lead" }), "Lead · no open call");
});

test("tally and upcoming summarise the board", () => {
  const items = [
    job({ id: "a", deadline: "2026-12-31" }),
    job({ id: "b" }),
    job({ id: "c", applied: "submitted" }),
    job({ id: "d", type: "lead" }),
    job({ id: "e", deadline: "2026-09-01" }),
  ].map((j) => enrich(j, TODAY, null));
  assert.deepEqual(tally(items), { open: 2, applied: 1, leads: 1, closed: 1, total: 5 });

  const next = upcoming(items, [{ date: "2026-11-20", text: "M1" }, { date: "2026-10-01", text: "past" }], TODAY);
  assert.deepEqual(next.map((r) => [r.kind, r.daysLeft]), [["milestone", 10], ["deadline", 51]]);
});

test("sortItems: newest first by default, with score and deadline orders", () => {
  const items = [
    job({ id: "old-high", title: "A", added: "2026-07-21", score: 8.1, subscores: [1, 1, 1, 1, 1] }),
    job({ id: "new-none", title: "B", added: "2026-11-05" }),
    job({ id: "mid-due", title: "C", added: "2026-09-30", deadline: "2026-12-31" }),
    job({ id: "old-low", title: "D", added: "2026-07-21", score: 6, subscores: [1, 1, 1, 1, 1] }),
  ].map((j) => enrich(j, TODAY, null));
  const ids = (sort) => sortItems(items, sort).map((i) => i.id);
  assert.deepEqual(ids("newest"), ["new-none", "mid-due", "old-high", "old-low"]);
  assert.deepEqual(ids("score"), ["old-high", "old-low", "new-none", "mid-due"]);
  assert.equal(ids("deadline")[0], "mid-due");
  assert.equal(items[0].id, "old-high", "input order is left untouched");
});
