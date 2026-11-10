import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml, safeUrl, safeEmail, breadcrumb, hueOf, initials, markedHtml, inlineBold, ago, plural,
} from "../src/render.js";
import { highlight } from "../src/search.js";

test("escapeHtml neutralises every character that can open markup or an attribute", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert('1')">&`), "&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(7.5), "7.5");
});

test("safeUrl accepts only http and https", () => {
  assert.equal(safeUrl("https://example.org/a?b=1#c"), "https://example.org/a?b=1#c");
  assert.equal(safeUrl("http://example.org"), "http://example.org/");
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "vbscript:x",
    "file:///etc/passwd", "//example.org", "example.org", "", null, undefined, 42, {}]) {
    assert.equal(safeUrl(bad), null, String(bad));
  }
});

test("safeEmail rejects anything that could break out of a mailto link", () => {
  assert.equal(safeEmail("m.widmann@bham.ac.uk"), "m.widmann@bham.ac.uk");
  for (const bad of ["not-an-email", "a@b", "a b@c.org", 'a"onmouseover="x@c.org', "a@b.org?subject=<x>", "", null]) {
    assert.equal(safeEmail(bad), null, String(bad));
  }
});

test("breadcrumb shows where a link leads, compactly", () => {
  assert.equal(breadcrumb("https://recruit.ap.uci.edu/JPF10438"), "recruit.ap.uci.edu › JPF10438");
  assert.equal(breadcrumb("https://www.gewex.org/resources/position-announcements/"), "gewex.org › resources › position-announcements");
  assert.equal(breadcrumb("https://www.jsps.go.jp/english/e-fellow/e-ippan/index.html"), "jsps.go.jp › english › e-fellow › …");
  assert.equal(breadcrumb("https://careers.nus.edu.sg/job/Research-Fellow-%28Machine-Learning%29/29756-en_GB"),
    "careers.nus.edu.sg › job › Research-Fellow-(Machine-… › …", "long segments are clipped and percent-escapes decoded");
  assert.equal(breadcrumb("https://example.org/%E0%A4%A"), "example.org › %E0%A4%A", "a malformed escape is shown as-is");
  assert.equal(breadcrumb("javascript:alert(1)"), "");
  assert.equal(breadcrumb("https://example.org"), "example.org");
});

test("hueOf is stable and in range; initials take the leading words", () => {
  assert.equal(hueOf("TU Delft"), hueOf("TU Delft"));
  assert.ok(hueOf("TU Delft") >= 0 && hueOf("TU Delft") < 360);
  assert.equal(hueOf(""), 0);
  assert.equal(initials("TU Delft · EU MSCA fellowship"), "TD");
  assert.equal(initials("Max Planck Institute for Meteorology"), "MP");
  assert.equal(initials("KAUST"), "K");
  assert.equal(initials("CCRS / Met Service Singapore"), "C");
  assert.equal(initials("RISH, Kyoto University (MU radar)"), "R");
  assert.equal(initials(""), "•");
  assert.equal(initials("2026"), "•");
});

test("markedHtml escapes both matched and unmatched text", () => {
  const html = markedHtml(highlight('Radar <b>and</b> "QPE"', ["radar"]));
  assert.equal(html, "<mark>Radar</mark> &lt;b&gt;and&lt;/b&gt; &quot;QPE&quot;");
  assert.equal(markedHtml(highlight("<script>", ["script"])), "&lt;<mark>script</mark>&gt;");
});

test("inlineBold renders **bold** only, and escapes first", () => {
  assert.equal(inlineBold("**UC Irvine** fixed <b>x</b>"), "<strong>UC Irvine</strong> fixed &lt;b&gt;x&lt;/b&gt;");
  assert.equal(inlineBold("**<img src=x>**"), "<strong>&lt;img src=x&gt;</strong>");
  assert.equal(inlineBold("2 * 3 * 4"), "2 * 3 * 4");
});

test("ago and plural read naturally", () => {
  assert.equal(ago(0, "x"), "today");
  assert.equal(ago(-3, "x"), "today", "a clock slightly ahead never shows a negative age");
  assert.equal(ago(1, "x"), "yesterday");
  assert.equal(ago(12, "x"), "12 days ago");
  assert.equal(ago(45, "26 Sep"), "26 Sep");
  assert.equal(plural(1, "result"), "1 result");
  assert.equal(plural(0, "result"), "0 results");
  assert.equal(plural(2, "entry", "entries"), "2 entries");
});
