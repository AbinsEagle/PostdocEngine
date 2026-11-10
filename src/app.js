// Page controller: loads the data, runs searches, renders results.
import {
  enrichAll, tally, upcoming, sortItems, timeline, shortDate, daysUntil, STATE_LABEL,
} from "./model.js";
import { parseQuery } from "./query.js";
import { createEngine, highlight, highlightWords, snippet } from "./search.js";
import {
  escapeHtml as esc, safeUrl, safeEmail, breadcrumb, hueOf, initials, markedHtml, inlineBold, ago, plural,
} from "./render.js";

const TABS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "applied", label: "Applied" },
  { id: "leads", label: "Leads & resources" },
  { id: "discover", label: "Discover" },
  { id: "reference", label: "Reference" },
];
const SORTS = [["relevance", "Relevance"], ["newest", "Newest"], ["deadline", "Deadline"], ["score", "Fit score"]];
const SUBSCORE_LABELS = ["Stability", "Fit", "India", "Prestige", "Permanence"];
const QUICK = [
  { label: "Open now", q: "is:open" },
  { label: "Due in 60 days", q: "due:60d" },
  { label: "monsoon", q: "monsoon" },
  { label: "radar", q: "radar" },
  { label: "S2S", q: "s2s" },
  { label: "machine learning", q: '"machine learning"' },
  { label: "Japan", q: "in:japan" },
  { label: "Has a contact", q: "has:contact" },
  { label: "Fit ≥ 7", q: "score:>=7" },
  { label: "Saved", q: "is:saved" },
];
const DISCOVER_FIELDS = { title: 4, matched: 2, sourceName: 1.5, org: 1.5, summary: 1 };
const SAVED_KEY = "pe_saved_v2";

const $ = (id) => document.getElementById(id);
const el = {
  q: $("q"), clear: $("clear"), tipsBtn: $("tipsBtn"), tips: $("tipsPanel"), chips: $("chips"),
  tabs: $("tabs"), stats: $("stats"), sort: $("sort"), sortWrap: $("sortWrap"),
  results: $("results"), reference: $("reference"), rail: $("rail"),
  miles: $("miles"), log: $("log"), dataDate: $("dataDate"),
};

const state = {
  q: "",
  tab: null, // null = automatic: Open while browsing, All while searching
  sort: null, // null = automatic: relevance while searching, newest otherwise
  saved: new Set(),
  expanded: new Set(),
  showClosed: false,
  today: new Date(),
  items: [],
  board: null,
  health: null,
  discover: null,
  live: [], // results of an AI scan run from this page; never stored
  scan: { busy: false, message: "", level: "" },
  engine: null,
  discoverEngine: null,
};

// ---------- persistence ----------

function loadSaved(items) {
  try {
    const v2 = JSON.parse(localStorage.getItem(SAVED_KEY) || "null");
    if (Array.isArray(v2)) return new Set(v2);
    // The previous version stored titles; carry those over once.
    const legacy = JSON.parse(localStorage.getItem("pe_saved") || "[]");
    const byTitle = new Map(items.map((i) => [i.title, i.id]));
    return new Set(legacy.map((t) => byTitle.get(t)).filter(Boolean));
  } catch {
    return new Set();
  }
}

function storeSaved() {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...state.saved]));
  } catch {
    /* private browsing: saving simply does not persist */
  }
}

// ---------- URL ----------

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get("q") || "";
  state.tab = TABS.some((t) => t.id === p.get("tab")) ? p.get("tab") : null;
  state.sort = SORTS.some((s) => s[0] === p.get("sort")) ? p.get("sort") : null;
}

function writeUrl(push) {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set("q", state.q.trim());
  if (state.tab) p.set("tab", state.tab);
  if (state.sort) p.set("sort", state.sort);
  const query = p.toString();
  const url = query ? `?${query}` : location.pathname;
  if (url === location.pathname + location.search) return;
  history[push ? "pushState" : "replaceState"](null, "", url);
}

const activeTab = () => state.tab || (state.q.trim() ? "all" : "open");

// ---------- data ----------

async function getJson(path, optional) {
  try {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

function discoverDocs() {
  const fromFeeds = (state.discover && Array.isArray(state.discover.items) ? state.discover.items : [])
    .map((d) => ({ ...d, kind: "feed" }));
  return [...state.live, ...fromFeeds];
}

function rebuildDiscover() {
  state.discoverEngine = createEngine(discoverDocs(), { fields: DISCOVER_FIELDS });
}

async function load() {
  const [jobs, board, health, discover] = await Promise.all([
    getJson("data/jobs.json"),
    getJson("data/board.json"),
    getJson("data/health.json", true),
    getJson("data/discover.json", true),
  ]);
  state.board = board;
  state.health = health;
  state.discover = discover;
  state.items = enrichAll(jobs.jobs, state.today, health);
  state.engine = createEngine(state.items);
  state.saved = loadSaved(state.items);
  rebuildDiscover();
  el.dataDate.textContent = shortDate(jobs.updated, state.today);
}

// ---------- search ----------

function compute() {
  const parsed = parseQuery(state.q);
  const ctx = { saved: state.saved };
  const t0 = performance.now();
  const res = state.engine.search(parsed, ctx);
  const dres = state.discoverEngine.search(parsed, ctx);
  const ms = performance.now() - t0;

  const wanted = state.sort || (parsed.hasText ? "relevance" : "newest");
  const sort = wanted === "relevance" && !parsed.hasText ? "newest" : wanted;
  let hits = res.hits;
  if (sort !== "relevance") {
    const order = new Map(sortItems(hits.map((h) => h.item), sort).map((it, i) => [it.id, i]));
    hits = [...hits].sort((a, b) => order.get(a.item.id) - order.get(b.item.id));
  }

  // While browsing, closed entries wait in a collapsed group. While searching,
  // they appear in place (ranked lower and labelled) so nothing is unfindable.
  const splitClosed = parsed.isEmpty;
  const buckets = { all: [], open: [], applied: [], leads: [], closed: [] };
  for (const h of hits) {
    if (splitClosed && h.item.state === "closed") {
      buckets.closed.push(h);
      continue;
    }
    buckets.all.push(h);
    buckets[h.item.tab].push(h);
  }
  return { parsed, res, dres, ms, sort, buckets, splitClosed };
}

// ---------- rendering: results ----------

function badge(item) {
  return `<span class="badge s-${item.state}">${esc(STATE_LABEL[item.state])}</span>`;
}

function scoreChip(item) {
  if (item.score === null) return "";
  const cls = item.score >= 7 ? "hi" : "";
  return `<span class="score ${cls}" title="Fit score out of 10"><span aria-hidden="true">★</span> ${item.score.toFixed(2)}<span class="sr"> fit score out of 10</span></span>`;
}

function linkLine(item) {
  const l = item.link;
  if (l.level === "unknown") return `<p class="linkline"><span class="dot"></span>${esc(l.label)}.</p>`;
  const when = l.checked ? ` ${esc(ago(-daysUntil(l.checked.slice(0, 10), state.today), shortDate(l.checked.slice(0, 10), state.today)))}` : "";
  const http = l.http ? ` (HTTP ${esc(l.http)})` : "";
  const detail = l.detail ? ` — ${esc(l.detail)}` : "";
  const softened = l.level === "problem" && !item.linkWarning
    ? " This is expected once a call has closed."
    : "";
  return `<p class="linkline l-${l.level}"><span class="dot"></span>${esc(l.label)}${http}, checked${when}${detail}.${softened}</p>`;
}

function contactsHtml(item) {
  const rows = (item.contacts || []).map((c) => {
    const email = safeEmail(c.email);
    const addr = email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "";
    return `<li><span>${esc(c.name)}</span>${addr}</li>`;
  });
  return rows.length ? `<ul class="contacts">${rows.join("")}</ul>` : "";
}

function resultHtml(hit, parsed) {
  const item = hit.item;
  const words = highlightWords(parsed, hit.matched);
  const mark = (text) => markedHtml(highlight(text, words));
  const url = safeUrl(item.url);
  const hue = hueOf(item.org);
  const saved = state.saved.has(item.id);
  const open = state.expanded.has(item.id);

  const title = url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${mark(item.title)}</a>`
    : mark(item.title);
  const subs = item.subscores
    ? `<dl class="subs">${item.subscores.map((v, i) => `<div><dt>${SUBSCORE_LABELS[i]}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`
    : "";
  const tags = item.tags.length
    ? `<ul class="tags" aria-label="Tags">${item.tags.map((t) => `<li><button type="button" data-q="${esc(`tag:"${t.toLowerCase()}"`)}">${mark(t)}</button></li>`).join("")}</ul>`
    : "";
  const warn = item.linkWarning
    ? `<span class="warn" title="${esc(item.link.detail || item.link.label)}">⚠ ${esc(item.link.label)}</span>`
    : "";

  return `
<article class="res${item.state === "closed" ? " is-closed" : ""}" data-id="${esc(item.id)}">
  <div class="res-src">
    <span class="fav" style="--h:${hue}" aria-hidden="true">${esc(initials(item.org))}</span>
    <div class="res-where">
      <span class="res-org">${mark(item.org)}</span>
      <span class="res-url">${esc(breadcrumb(item.url))}</span>
    </div>
    <button type="button" class="save${saved ? " on" : ""}" data-save="${esc(item.id)}" aria-pressed="${saved}" title="${saved ? "Remove from saved" : "Save"}">
      <span aria-hidden="true">${saved ? "★" : "☆"}</span><span class="sr">${saved ? "Remove from saved" : "Save"}: ${esc(item.title)}</span>
    </button>
  </div>
  <h3 class="res-title">${title}</h3>
  <p class="res-meta">
    ${badge(item)}
    <span class="when">${esc(timeline(item, state.today))}</span>
    <span class="sep" aria-hidden="true">·</span><span>${mark(item.country)}</span>
    ${scoreChip(item)}
    ${item.isNew ? '<span class="new">New</span>' : ""}
    ${warn}
  </p>
  <p class="res-snip">${mark(snippet(item, words))}</p>
  <details class="more" data-id="${esc(item.id)}"${open ? " open" : ""}>
    <summary>Details</summary>
    <div class="more-body">
      <p><b>My match.</b> ${mark(item.fit)}</p>
      <p><b>In it for me.</b> ${mark(item.perk)}</p>
      <p><b>Where it stands.</b> ${mark(item.note)}</p>
      ${contactsHtml(item)}
      ${subs}
      ${tags}
      ${linkLine(item)}
      <p class="actions">
        ${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open the page <span aria-hidden="true">↗</span></a>` : ""}
        ${url ? `<button type="button" class="btn" data-copy="${esc(url)}">Copy link</button>` : ""}
      </p>
    </div>
  </details>
</article>`;
}

function discoverHtml(hit, parsed) {
  const d = hit.item;
  const words = highlightWords(parsed, hit.matched);
  const mark = (text) => markedHtml(highlight(text, words));
  const url = safeUrl(d.url);
  const source = d.sourceName || "Feed";
  const published = d.published ? shortDate(String(d.published).slice(0, 10), state.today) : "";
  const title = url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${mark(d.title)}</a>`
    : mark(d.title);
  const label = d.kind === "live" ? "AI web search · verify before trusting"
    : d.kind === "suggested" ? "AI suggestion · not a confirmed vacancy"
    : "From a feed · not reviewed";
  const matched = Array.isArray(d.matched) && d.matched.length
    ? `<ul class="tags">${d.matched.slice(0, 6).map((m) => `<li><span>${mark(m)}</span></li>`).join("")}</ul>`
    : "";
  return `
<article class="res res-disc">
  <div class="res-src">
    <span class="fav" style="--h:${hueOf(source)}" aria-hidden="true">${esc(initials(source))}</span>
    <div class="res-where">
      <span class="res-org">${esc(source)}${d.org ? ` · ${mark(d.org)}` : ""}</span>
      <span class="res-url">${esc(breadcrumb(d.url))}</span>
    </div>
  </div>
  <h3 class="res-title">${title}</h3>
  <p class="res-meta"><span class="badge s-feed">${esc(label)}</span>${published ? `<span class="when">Posted ${esc(published)}</span>` : ""}${d.deadline ? `<span class="when">Deadline given: ${esc(d.deadline)}</span>` : ""}</p>
  ${d.summary ? `<p class="res-snip">${mark(d.summary)}</p>` : ""}
  ${matched}
</article>`;
}

function emptyHtml(view, tab) {
  const { parsed, res, buckets, dres } = view;
  const term = `<q>${esc(parsed.raw)}</q>`;
  if (parsed.isEmpty) {
    const lines = {
      open: "No open postings right now. New candidates appear under Discover; leads worth a speculative email are under Leads &amp; resources.",
      applied: "No applications recorded yet.",
      leads: "No leads recorded.",
      all: "The board is empty.",
    };
    return `<div class="empty"><p>${lines[tab] || ""}</p></div>`;
  }
  // Point at the specific tabs that do have matches ("All" would only repeat them).
  const elsewhere = TABS
    .filter((t) => t.id !== tab && t.id !== "all" && t.id !== "reference")
    .map((t) => ({ t, n: t.id === "discover" ? dres.hits.length : buckets[t.id].length }))
    .filter((x) => x.n > 0);
  if (elsewhere.length) {
    const links = elsewhere.map((x) => `<button type="button" class="linkish" data-tab="${x.t.id}">${esc(x.t.label)} (${x.n})</button>`).join(" ");
    const here = TABS.find((t) => t.id === tab).label;
    return `<div class="empty"><p>Nothing under <b>${esc(here)}</b> matches ${term}.</p><p>There are matches in: ${links}</p></div>`;
  }
  const suggestion = res.suggestion
    ? `<p>Did you mean <button type="button" class="linkish" data-q="${esc(res.suggestion)}"><b><i>${esc(res.suggestion)}</i></b></button>?</p>`
    : "";
  return `<div class="empty">
    <p>Nothing on the board matches ${term}.</p>${suggestion}
    <ul><li>Check the spelling, or try fewer or more general words.</li>
    <li>Operators narrow results: remove <code>is:</code>, <code>in:</code> or <code>due:</code> to widen.</li></ul></div>`;
}

function closedGroupHtml(view) {
  const hits = view.buckets.closed;
  if (!hits.length) return "";
  return `
<details class="closed-group" id="closedGroup"${state.showClosed ? " open" : ""}>
  <summary><span>Closed or past deadline</span><span class="count">${hits.length}</span><span class="hint">kept for reference and next cycles</span></summary>
  ${hits.map((h) => resultHtml(h, view.parsed)).join("")}
</details>`;
}

function discoverPanelHtml(view) {
  const d = state.discover;
  const hits = view.dres.hits;
  const generated = d && d.generated ? d.generated.slice(0, 10) : null;
  const sources = d && Array.isArray(d.sources) ? d.sources : [];
  const okSources = sources.filter((s) => s.ok).length;
  const when = generated
    ? `Feeds last read ${esc(ago(-daysUntil(generated, state.today), shortDate(generated, state.today)))} — ${okSources} of ${sources.length} sources answered.`
    : "The feed reader has not run yet. It runs on GitHub's servers twice a week and fills this tab.";
  const scan = state.scan;
  const head = `
<div class="disc-head">
  <p>Candidates pulled automatically from job-board feeds and matched against your keywords. Nothing here has been read or scored — treat each as a pointer, and open the posting itself before spending time on it.</p>
  <p class="muted">${when}</p>
  <p class="disc-actions">
    <button type="button" class="btn" id="scanBtn"${scan.busy ? " disabled" : ""}>${scan.busy ? "Scanning…" : "Run an AI scan now"}</button>
    ${scan.message ? `<span class="scan-msg ${esc(scan.level)}" role="status">${esc(scan.message)}</span>` : ""}
  </p>
</div>`;
  if (!hits.length) {
    const why = view.parsed.isEmpty ? "No candidates yet." : `No candidates match <q>${esc(view.parsed.raw)}</q>.`;
    return `${head}<div class="empty"><p>${why}</p></div>`;
  }
  return head + hits.map((h) => discoverHtml(h, view.parsed)).join("");
}

function renderResults(view) {
  const tab = activeTab();
  const isRef = tab === "reference";
  el.reference.hidden = !isRef;
  el.results.hidden = isRef;
  if (isRef) return;

  if (tab === "discover") {
    el.results.innerHTML = discoverPanelHtml(view);
    return;
  }
  const hits = view.buckets[tab];
  const list = hits.map((h) => resultHtml(h, view.parsed)).join("");
  const closed = view.splitClosed && (tab === "all" || tab === "leads") ? closedGroupHtml(view) : "";
  el.results.innerHTML = (list || emptyHtml(view, tab)) + closed;
}

// ---------- rendering: chrome ----------

function tabCount(view, id) {
  if (id === "reference") return null;
  if (id === "discover") return view.dres.hits.length;
  return view.buckets[id].length;
}

function renderTabs(view) {
  const current = activeTab();
  el.tabs.innerHTML = TABS.map((t) => {
    const n = tabCount(view, t.id);
    const count = n === null ? "" : `<span class="n">${n}</span>`;
    const selected = t.id === current;
    return `<button type="button" role="tab" id="tab-${t.id}" data-tab="${t.id}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${esc(t.label)}${count}</button>`;
  }).join("");
}

function renderStats(view) {
  const tab = activeTab();
  if (tab === "reference") {
    el.stats.textContent = "";
    el.sortWrap.hidden = true;
    return;
  }
  const n = tabCount(view, tab);
  const closedNote = view.splitClosed && (tab === "all" || tab === "leads") && view.buckets.closed.length
    ? ` · ${view.buckets.closed.length} closed below`
    : "";
  const parts = [`${plural(n, "result")}${closedNote} <span class="ms">(${view.ms < 10 ? view.ms.toFixed(1) : Math.round(view.ms)} ms)</span>`];
  if (view.res.relaxed && tab !== "discover") {
    parts.push("No entry has every word, so these match <b>any</b> of them.");
  }
  if (view.parsed.ignored.length) {
    parts.push(`Not understood, ignored: ${view.parsed.ignored.map((s) => `<code>${esc(s)}</code>`).join(" ")}`);
  }
  el.stats.innerHTML = parts.map((p) => `<span>${p}</span>`).join("");

  el.sortWrap.hidden = tab === "discover";
  el.sort.innerHTML = SORTS
    .filter(([id]) => id !== "relevance" || view.parsed.hasText)
    .map(([id, label]) => `<option value="${id}"${id === view.sort ? " selected" : ""}>${label}</option>`).join("");
}

function renderRail() {
  const t = tally(state.items);
  const next = upcoming(state.items, state.board.milestones, state.today, 5);
  const nextHtml = next.length
    ? `<ul class="next">${next.map((r) => {
      const left = r.daysLeft === 0 ? "today" : `${r.daysLeft} d`;
      const cls = r.daysLeft <= 7 ? "soon" : r.daysLeft <= 14 ? "near" : "";
      const text = r.id
        ? `<button type="button" class="linkish" data-focus="${esc(r.id)}">${esc(r.text)}</button>`
        : esc(r.text);
      return `<li><span class="d">${esc(shortDate(r.date, state.today))}</span><span class="t">${text}</span><span class="left ${cls}">${left}</span></li>`;
    }).join("")}</ul>`
    : '<p class="muted">No dated deadlines ahead.</p>';

  const h = state.health;
  let linksLine = "Not run yet";
  if (h && h.checked) {
    const day = h.checked.slice(0, 10);
    const records = Object.values(h.links || {});
    const live = state.items.filter((i) => i.linkWarning).length;
    linksLine = `${ago(-daysUntil(day, state.today), shortDate(day, state.today))} · ${records.filter((r) => r.kind === "ok").length} of ${records.length} verified`
      + (live ? ` · <button type="button" class="linkish warn" data-q="is:broken">${plural(live, "problem")}</button>` : "");
  }
  const d = state.discover;
  const feedsLine = d && d.generated
    ? `${ago(-daysUntil(d.generated.slice(0, 10), state.today), shortDate(d.generated.slice(0, 10), state.today))} · ${plural((d.items || []).length, "candidate")}`
    : "Not run yet";
  const meta = state.board.meta;
  const overdue = daysUntil(meta.nextScan, state.today) < 0;

  el.rail.innerHTML = `
<section class="card">
  <h2>Next up</h2>
  ${nextHtml}
</section>
<section class="card">
  <h2>Pipeline</h2>
  <div class="pipe">
    <button type="button" data-tab="open" data-clear="1"><b>${t.open}</b><span>Open</span></button>
    <button type="button" data-tab="applied" data-clear="1"><b>${t.applied}</b><span>Applied</span></button>
    <button type="button" data-tab="leads" data-clear="1"><b>${t.leads}</b><span>Leads</span></button>
    <button type="button" data-tab="leads" data-clear="1" data-closed="1"><b>${t.closed}</b><span>Closed</span></button>
  </div>
</section>
<section class="card">
  <h2>How fresh is this</h2>
  <dl class="fresh">
    <div><dt>Reviewed by hand</dt><dd>${esc(shortDate(meta.lastScan, state.today))} · next ${esc(shortDate(meta.nextScan, state.today))}${overdue ? ' <span class="warn">overdue</span>' : ""}</dd></div>
    <div><dt>Links checked</dt><dd>${linksLine}</dd></div>
    <div><dt>Feeds read</dt><dd>${esc(feedsLine)}</dd></div>
  </dl>
</section>`;
}

function renderReference() {
  const { milestones, log } = state.board;
  const rows = [...milestones].sort((a, b) => a.date.localeCompare(b.date)).map((m) => {
    const n = daysUntil(m.date, state.today);
    const left = n < 0 ? '<span class="left past">past</span>' : `<span class="left ${n <= 7 ? "soon" : n <= 14 ? "near" : ""}">${n === 0 ? "today" : `${n} d`}</span>`;
    return `<li class="${n < 0 ? "is-past" : ""}"><span class="d">${esc(shortDate(m.date, state.today))}</span><span class="t">${esc(m.text)}</span>${left}</li>`;
  });
  el.miles.innerHTML = rows.join("");
  el.log.innerHTML = log.map((entry) => `<li>${inlineBold(entry)}</li>`).join("");
}

function render() {
  const view = compute();
  document.body.classList.toggle("home", !state.q.trim());
  el.clear.hidden = !state.q;
  renderTabs(view);
  renderStats(view);
  renderResults(view);
  return view;
}

// ---------- actions ----------

function setQuery(q, { push = false, focus = false } = {}) {
  state.q = q;
  if (el.q.value !== q) el.q.value = q;
  writeUrl(push);
  render();
  if (focus) el.q.focus();
}

function setTab(id, { closed = false } = {}) {
  state.tab = id;
  if (closed) state.showClosed = true;
  writeUrl(true);
  render();
  if (closed) {
    const group = $("closedGroup");
    if (group) group.scrollIntoView({ block: "start", behavior: "smooth" });
  } else {
    window.scrollTo({ top: 0 });
  }
}

function focusResult(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  state.tab = item.state === "closed" ? "leads" : item.tab;
  if (item.state === "closed") state.showClosed = true;
  state.q = "";
  el.q.value = "";
  state.expanded.add(id);
  writeUrl(true);
  render();
  const node = el.results.querySelector(`article[data-id="${CSS.escape(id)}"]`);
  if (node) {
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    node.classList.add("flash");
    const link = node.querySelector(".res-title a");
    if (link) link.focus({ preventScroll: true });
  }
}

async function copyLink(button, url) {
  const done = (text) => {
    const before = button.textContent;
    button.textContent = text;
    setTimeout(() => { button.textContent = before; }, 1600);
  };
  try {
    await navigator.clipboard.writeText(url);
    done("Copied");
  } catch {
    done("Copy failed");
  }
}

async function runScan() {
  if (state.scan.busy) return;
  state.scan = { busy: true, message: "Searching the boards — this can take up to a minute.", level: "" };
  render();
  try {
    const res = await fetch("/api/refresh", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.status === 501) {
      state.scan = { busy: false, level: "warn", message: "Not set up: this needs an API key in the Vercel project. The feed reader above works without one." };
    } else if (!res.ok) {
      state.scan = { busy: false, level: "err", message: `The scan failed (${res.status}). ${data.message || data.error || ""}`.trim() };
    } else {
      const kind = data.provider === "nvidia" ? "suggested" : "live";
      state.live = (data.jobs || []).map((j, i) => ({
        id: `scan-${i}`,
        kind,
        title: j.title || "Untitled",
        org: j.org || "",
        url: j.url || "",
        deadline: j.deadline || null,
        summary: [j.why, j.perk].filter(Boolean).join(" "),
        matched: Array.isArray(j.tags) ? j.tags : [],
        sourceName: kind === "live" ? "AI web search" : "AI suggestion",
      }));
      rebuildDiscover();
      state.scan = {
        busy: false,
        level: state.live.length ? "ok" : "warn",
        message: state.live.length
          ? `${plural(state.live.length, "result")} added below for this visit only. Verify each one.`
          : "The scan ran and found nothing new.",
      };
    }
  } catch (err) {
    state.scan = { busy: false, level: "err", message: `The scan could not be reached: ${err.message || err}` };
  }
  render();
}

// ---------- events ----------

function wire() {
  el.q.addEventListener("input", () => setQuery(el.q.value));
  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    writeUrl(true);
    el.q.blur();
  });
  el.clear.addEventListener("click", () => setQuery("", { push: true, focus: true }));
  el.tipsBtn.addEventListener("click", () => {
    const show = el.tips.hidden;
    el.tips.hidden = !show;
    el.tipsBtn.setAttribute("aria-expanded", String(show));
    // The panel sits just under the pinned search box, at the top of the page.
    if (show) window.scrollTo({ top: 0 });
  });
  el.sort.addEventListener("change", () => {
    state.sort = el.sort.value;
    writeUrl(false);
    render();
  });

  // One delegated listener covers everything rendered from data.
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab],[data-q],[data-save],[data-copy],[data-focus],#scanBtn");
    if (!t) return;
    if (t.id === "scanBtn") return void runScan();
    if (t.dataset.tab) {
      // The pipeline counts describe the whole board, so they drop any active search.
      if (t.dataset.clear) {
        state.q = "";
        el.q.value = "";
      }
      return void setTab(t.dataset.tab, { closed: t.dataset.closed === "1" });
    }
    if (t.dataset.focus) return void focusResult(t.dataset.focus);
    if (t.dataset.q !== undefined) {
      el.tips.hidden = true;
      el.tipsBtn.setAttribute("aria-expanded", "false");
      state.tab = null;
      setQuery(t.dataset.q, { push: true });
      window.scrollTo({ top: 0 });
      return;
    }
    if (t.dataset.save) {
      const id = t.dataset.save;
      if (state.saved.has(id)) state.saved.delete(id);
      else state.saved.add(id);
      storeSaved();
      render();
      const again = el.results.querySelector(`[data-save="${CSS.escape(id)}"]`);
      if (again) again.focus();
      return;
    }
    if (t.dataset.copy) copyLink(t, t.dataset.copy);
  });

  // <details> toggle does not bubble, so listen in the capture phase.
  el.results.addEventListener("toggle", (e) => {
    const d = e.target;
    if (d.id === "closedGroup") state.showClosed = d.open;
    else if (d.classList.contains("more") && d.dataset.id) {
      if (d.open) state.expanded.add(d.dataset.id);
      else state.expanded.delete(d.dataset.id);
    }
  }, true);

  el.tabs.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const ids = TABS.map((t) => t.id);
    const i = ids.indexOf(activeTab());
    const next = ids[(i + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
    e.preventDefault();
    setTab(next);
    $(`tab-${next}`).focus();
  });

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      el.q.focus();
      el.q.select();
      return;
    }
    if (e.target === el.q) {
      if (e.key === "Escape") {
        if (state.q) setQuery("", { push: true });
        else el.q.blur();
      } else if (e.key === "ArrowDown") {
        const first = el.results.querySelector(".res-title a");
        if (first) {
          e.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target.closest && e.target.closest(".res-title")) {
      const links = [...el.results.querySelectorAll(".res-title a")].filter((a) => a.offsetParent !== null);
      const i = links.indexOf(e.target);
      const next = links[i + (e.key === "ArrowDown" ? 1 : -1)];
      e.preventDefault();
      if (next) next.focus();
      else if (e.key === "ArrowUp") el.q.focus();
    }
  });

  window.addEventListener("popstate", () => {
    readUrl();
    el.q.value = state.q;
    render();
  });
}

// ---------- start ----------

function renderChips() {
  el.chips.innerHTML = QUICK.map((c) => `<button type="button" data-q="${esc(c.q)}">${esc(c.label)}</button>`).join("");
}

async function start() {
  readUrl();
  el.q.value = state.q;
  renderChips();
  try {
    await load();
  } catch (err) {
    document.body.classList.remove("loading");
    el.results.innerHTML = `<div class="empty err"><p><b>The board's data could not be loaded.</b></p><p class="muted">${esc(err.message || err)}</p><p><button type="button" class="btn" id="retry">Try again</button></p></div>`;
    $("retry").addEventListener("click", () => location.reload());
    return;
  }
  document.body.classList.remove("loading");
  wire();
  renderRail();
  renderReference();
  render();
}

start();
