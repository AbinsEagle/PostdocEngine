// Domain model: turns curated records into what the board shows.
// State is derived from the data on every load, so a passed deadline moves an
// entry out of "Open" by rule — nobody has to remember to reclassify it.

export const CLOSING_WINDOW_DAYS = 14;
export const NEW_WINDOW_DAYS = 14;

const DAY_MS = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar day as an integer, from "YYYY-MM-DD" or a Date (its local calendar date). */
export function dayNumber(d) {
  if (d instanceof Date) return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
  const [y, m, day] = String(d).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, day) / DAY_MS);
}

/** Whole days from `today` until `date`; negative once the date has passed. */
export function daysUntil(date, today) {
  return dayNumber(date) - dayNumber(today);
}

/** "31 Dec" within the current year, "15 Jan 2027" otherwise. */
export function shortDate(date, today) {
  const [y, m, d] = String(date).split("-").map(Number);
  const thisYear = today instanceof Date ? today.getFullYear() : Number(String(today).slice(0, 4));
  return `${d} ${MONTHS[m - 1]}${y === thisYear ? "" : ` ${y}`}`;
}

/**
 * applied  — an application is in
 * closed   — past its deadline, or marked closed by hand
 * lead     — a group, programme or contact to pursue; no specific call is open
 * closing  — an opening whose deadline is within CLOSING_WINDOW_DAYS
 * open     — an opening with a later deadline
 * rolling  — an opening with no fixed deadline
 */
export function stateOf(job, today) {
  if (job.applied) return "applied";
  if (job.closed) return "closed";
  if (job.deadline && daysUntil(job.deadline, today) < 0) return "closed";
  if (job.type === "lead") return "lead";
  if (!job.deadline) return "rolling";
  return daysUntil(job.deadline, today) <= CLOSING_WINDOW_DAYS ? "closing" : "open";
}

export const OPEN_STATES = new Set(["open", "closing", "rolling"]);

/** Which tab an entry lives under. Closed entries sit in a collapsed group under Leads. */
export function tabOf(state) {
  if (OPEN_STATES.has(state)) return "open";
  if (state === "applied") return "applied";
  return "leads";
}

const LINK_PROBLEMS = {
  dead: "Link is dead",
  "not-a-page": "Link is not a web page",
  "redirected-home": "Link redirects away from the posting",
  "soft-closed": "Page says it is closed",
};
const LINK_UNVERIFIABLE = new Set(["blocked", "error"]);

/**
 * Reads the automated link check for one entry.
 * A record only counts if it was made against the URL the entry has now.
 */
export function linkStatus(job, health) {
  const rec = health && health.links ? health.links[job.id] : null;
  if (!rec || rec.url !== job.url) return { level: "unknown", label: "Link not checked yet", checked: null };
  const base = { checked: rec.checked || null, http: rec.http ?? null, detail: rec.detail || "" };
  if (rec.kind === "ok") return { level: "ok", label: "Link verified", ...base };
  if (LINK_PROBLEMS[rec.kind]) return { level: "problem", label: LINK_PROBLEMS[rec.kind], ...base };
  if (LINK_UNVERIFIABLE.has(rec.kind)) {
    const label = rec.kind === "blocked" ? "Site blocks automated checks" : "Link check failed";
    return { level: "unverifiable", label, ...base };
  }
  return { level: "unknown", label: "Link not checked yet", checked: null };
}

/** Adds everything derived. Never mutates the record it is given. */
export function enrich(job, today, health) {
  const state = stateOf(job, today);
  const daysLeft = job.deadline ? daysUntil(job.deadline, today) : null;
  const link = linkStatus(job, health);
  return {
    ...job,
    state,
    tab: tabOf(state),
    daysLeft,
    isNew: daysUntil(job.added, today) >= -NEW_WINDOW_DAYS,
    link,
    // A broken link only matters while the entry is still something to act on.
    linkWarning: link.level === "problem" && state !== "applied" && state !== "closed",
  };
}

export function enrichAll(jobs, today, health) {
  return jobs.map((j) => enrich(j, today, health));
}

/** One line describing where an entry stands in time. */
export function timeline(item, today) {
  const { state, daysLeft, deadline } = item;
  if (state === "applied") {
    return deadline ? `Applied · call closed ${shortDate(deadline, today)}` : "Applied";
  }
  if (state === "closed") return deadline ? `Closed ${shortDate(deadline, today)}` : "Presumed closed";
  if (state === "lead") return "Lead · no open call";
  if (state === "rolling") return "No fixed deadline";
  const left = daysLeft === 0 ? "closes today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;
  return `Closes ${shortDate(deadline, today)} · ${left}`;
}

export const STATE_LABEL = {
  open: "Open",
  closing: "Closing soon",
  rolling: "Open",
  applied: "Applied",
  lead: "Lead",
  closed: "Closed",
};

export function tally(items) {
  const t = { open: 0, applied: 0, leads: 0, closed: 0, total: items.length };
  for (const it of items) {
    if (it.state === "closed") t.closed += 1;
    else if (it.tab === "open") t.open += 1;
    else if (it.tab === "applied") t.applied += 1;
    else t.leads += 1;
  }
  return t;
}

/** Upcoming dated things to act on: opening deadlines and milestones, soonest first. */
export function upcoming(items, milestones, today, limit = 5) {
  const rows = [];
  for (const it of items) {
    if ((it.state === "open" || it.state === "closing") && it.deadline) {
      rows.push({ date: it.deadline, text: it.title, kind: "deadline", id: it.id });
    }
  }
  for (const m of milestones || []) {
    if (daysUntil(m.date, today) >= 0) rows.push({ date: m.date, text: m.text, kind: "milestone" });
  }
  return rows
    .map((r) => ({ ...r, daysLeft: daysUntil(r.date, today) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, limit);
}

export function sortItems(items, sort) {
  const byNewest = (a, b) => b.added.localeCompare(a.added) || (b.score ?? -1) - (a.score ?? -1) || a.title.localeCompare(b.title);
  const out = [...items];
  if (sort === "score") return out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || byNewest(a, b));
  if (sort === "deadline") {
    // Soonest live deadline first; entries with nothing to act on by a date go last.
    const key = (it) => (it.deadline && it.daysLeft >= 0 && it.state !== "applied" ? it.daysLeft : Infinity);
    return out.sort((a, b) => key(a) - key(b) || byNewest(a, b));
  }
  return out.sort(byNewest);
}
