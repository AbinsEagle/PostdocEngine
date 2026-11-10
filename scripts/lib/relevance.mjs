// Decides whether a feed item is worth showing under Discover, and how prominently.
// This is a keyword screen, not a fit score: it only keeps obviously off-topic
// postings out. Scoring against the rubric stays a human job.
import crypto from "node:crypto";

// A posting must read like a postdoc-level research role…
const ROLE = /\b(post-?doc(?:toral)?s?|research (?:fellow|associate|scientist)|fellowships?|pdra|scientist)\b/i;
// …and its title must not be one of these.
const NOT_ROLE = /\b(ph\.?d\.? ?(?:student|position|studentship|candidate|scholarship|fellowship)s?|doctoral (?:student|candidate|researcher)s?|professor(?:ship)?|lecturer|tenure[- ]track|faculty position|technician|internship|intern|master'?s|msc|undergraduate|head of|director|dean|chair in)\b/i;

// [label, pattern, weight, kind]. Core terms are this search's own subject; strong
// terms are the surrounding field; weak terms only tip a borderline posting.
// "method" terms (machine learning, forecasting…) describe how the work is done and
// turn up in every discipline, so on their own they never qualify a posting: the
// first real run kept "Postdoctoral Researcher in AI for Digital Forensics" on the
// strength of "AI" alone. At least one "field" term must also be present.
const FIELD = "field";
const METHOD = "method";
const TERMS = [
  ["monsoon", /\bmonsoons?\b/i, 5, FIELD],
  ["intraseasonal", /\bintra-?seasonal\b|\bbsiso\b|\bisv\b/i, 5, FIELD],
  ["MJO", /\bmjo\b|madden[- –]julian/i, 5, FIELD],
  ["subseasonal / S2S", /\bsub-?seasonal\b|\bs2s\b/i, 5, FIELD],
  ["radar meteorology", /radar (?:meteorolog|hydrolog|hydrometeorolog|remote sensing)|weather radar|wind profil/i, 5, FIELD],
  ["QPE", /\bqpe\b|quantitative precipitation|precipitation estimat/i, 5, FIELD],

  ["tropical", /\btropical (?:meteorolog|convection|climate|cyclone|dynamics|atmospher|weather|rainfall|pacific|ocean)|\btropics\b/i, 3, FIELD],
  ["radar", /\bradars?\b/i, 3, FIELD],
  ["precipitation", /\bprecipitation\b|\brainfall\b/i, 3, FIELD],
  ["machine learning", /machine[- ]learning|deep[- ]learning|neural network|\bai[- ](?:weather|based|driven|for)\b|artificial intelligence|foundation model/i, 3, METHOD],
  ["weather prediction", /weather (?:forecast|prediction)|nowcast|numerical weather|\bnwp\b/i, 3, FIELD],
  ["convection", /\bconvecti(?:on|ve)\b/i, 3, FIELD],
  ["data assimilation", /data assimilation/i, 3, METHOD],
  ["atmospheric science", /atmospheric (?:science|dynamics|physics|modell?ing)|\bmeteorolog/i, 3, FIELD],
  ["extremes", /extreme (?:rainfall|precipitation|weather|events)/i, 3, FIELD],
  ["climate dynamics", /climate (?:dynamics|variability|prediction|modell?ing)/i, 3, FIELD],

  ["climate", /\bclimate\b/i, 1, FIELD],
  ["atmosphere", /\batmospher/i, 1, FIELD],
  ["hydrometeorology", /hydro-?meteorolog|hydro-?climat/i, 1, FIELD],
  ["earth system", /earth[- ]system/i, 1, FIELD],
  ["teleconnections", /teleconnection|ocean[- ]atmosphere|\benso\b/i, 1, FIELD],
  ["forecasting", /\bforecast|\bpredictab/i, 1, METHOD],
];

export const KEEP_AT = 6;

/**
 * @returns {{ keep: boolean, relevance: number, matched: string[], reason: string }}
 */
export function screen({ title, summary }) {
  const t = String(title || "");
  const s = String(summary || "");
  if (NOT_ROLE.test(t)) return { keep: false, relevance: 0, matched: [], reason: "not a postdoc-level role" };
  if (!ROLE.test(t) && !ROLE.test(s)) return { keep: false, relevance: 0, matched: [], reason: "does not read like a research post" };

  let relevance = 0;
  let inField = false;
  const matched = [];
  for (const [label, pattern, weight, kind] of TERMS) {
    // A word in the title says what the job is; in the summary it is only mentioned.
    const points = pattern.test(t) ? weight * 2 : pattern.test(s) ? weight : 0;
    if (points) {
      relevance += points;
      matched.push(label);
      if (kind === FIELD) inField = true;
    }
  }
  const keep = inField && relevance >= KEEP_AT;
  return { keep, relevance, matched, reason: keep ? "" : "off-topic" };
}

const WORD_NOISE = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "the", "to", "with", "f", "m", "d", "x"]);

function words(text) {
  return new Set(titleKey(text).split(" ").filter((w) => w && !WORD_NOISE.has(w)));
}

/** Share of the shorter title's words that also appear in the longer one (0–1). */
export function titleOverlap(a, b) {
  const wa = words(a);
  const wb = words(b);
  const [small, large] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  if (small.size === 0) return 0;
  let shared = 0;
  for (const w of small) if (large.has(w)) shared += 1;
  return shared / small.size;
}

/**
 * Job boards prefix the employer to the title ("University of X: Postdoc in Y").
 * @returns {{ org: string, role: string }} org is "" when there is no prefix.
 */
export function splitTitle(title) {
  const text = String(title || "").trim();
  const at = text.indexOf(": ");
  // A short prefix is an employer; a long one is the title talking ("Postdoc in radar: part 2").
  if (at > 1 && at <= 70 && !/\b(postdoc|fellow|researcher|scientist|associate)/i.test(text.slice(0, at))) {
    return { org: text.slice(0, at).trim(), role: text.slice(at + 2).trim() };
  }
  return { org: "", role: text };
}

/**
 * True when a feed item is a posting the board already tracks under another address:
 * the same employer, and a title made of the same words. Job boards mirror each
 * other, so the URL alone cannot tell.
 */
export function alreadyTracked(item, jobs) {
  const { org, role } = splitTitle(item.title);
  const orgKey = titleKey(org);
  if (!orgKey) return false;
  return jobs.some((job) => {
    const jobOrg = titleKey(job.org);
    // "MBZUAI" vs "Mohamed bin Zayed University of Artificial Intelligence" — compare by containment either way.
    const sameOrg = jobOrg.includes(orgKey) || orgKey.includes(jobOrg);
    if (!sameOrg) return false;
    // The tracked title often starts with a short form of the employer ("MBZUAI — …"); ignore that part.
    const jobRole = job.title.includes("—") ? job.title.split("—").slice(1).join(" ") : job.title;
    return titleOverlap(role, jobRole) >= 0.8;
  });
}

const TRACKING = /^(utm_|trackid$|track$|source$|src$|ref$|referrer$|fbclid$|gclid$|mc_|campaign)/i;

/** The same posting reached through different tracking links should compare equal. */
export function canonicalUrl(value) {
  try {
    const u = new URL(String(value));
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const query = u.searchParams.toString();
    return `${u.protocol}//${u.hostname}${path}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return "";
  }
}

/** Titles that differ only in case, punctuation or spacing are one posting. */
export function titleKey(title) {
  return String(title || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function idFor(url) {
  return `d-${crypto.createHash("sha1").update(canonicalUrl(url) || String(url)).digest("hex").slice(0, 12)}`;
}
