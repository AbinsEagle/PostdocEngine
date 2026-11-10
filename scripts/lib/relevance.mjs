// Decides whether a feed item is worth showing under Discover, and how prominently.
// This is a keyword screen, not a fit score: it only keeps obviously off-topic
// postings out. Scoring against the rubric stays a human job.
import crypto from "node:crypto";

// A posting must read like a postdoc-level research role…
const ROLE = /\b(post-?doc(?:toral)?s?|research (?:fellow|associate|scientist)|fellowships?|pdra|scientist)\b/i;
// …and its title must not be one of these.
const NOT_ROLE = /\b(ph\.?d\.? ?(?:student|position|studentship|candidate|scholarship|fellowship)s?|doctoral (?:student|candidate|researcher)s?|professor(?:ship)?|lecturer|tenure[- ]track|faculty position|technician|internship|intern|master'?s|msc|undergraduate|head of|director|dean|chair in)\b/i;

// [label, pattern, weight]. Core terms are this search's own subject; strong terms
// are the surrounding field; weak terms only tip a borderline posting.
const TERMS = [
  ["monsoon", /\bmonsoons?\b/i, 5],
  ["intraseasonal", /\bintra-?seasonal\b|\bbsiso\b|\bisv\b/i, 5],
  ["MJO", /\bmjo\b|madden[- –]julian/i, 5],
  ["subseasonal / S2S", /\bsub-?seasonal\b|\bs2s\b/i, 5],
  ["radar meteorology", /radar (?:meteorolog|hydrolog|hydrometeorolog|remote sensing)|weather radar|wind profil/i, 5],
  ["QPE", /\bqpe\b|quantitative precipitation|precipitation estimat/i, 5],

  ["tropical", /\btropical (?:meteorolog|convection|climate|cyclone|dynamics|atmospher|weather|rainfall|pacific|ocean)|\btropics\b/i, 3],
  ["radar", /\bradars?\b/i, 3],
  ["precipitation", /\bprecipitation\b|\brainfall\b/i, 3],
  ["machine learning", /machine[- ]learning|deep[- ]learning|neural network|\bai[- ](?:weather|based|driven|for)\b|artificial intelligence|foundation model/i, 3],
  ["weather prediction", /weather (?:forecast|prediction)|nowcast|numerical weather|\bnwp\b/i, 3],
  ["convection", /\bconvecti(?:on|ve)\b/i, 3],
  ["data assimilation", /data assimilation/i, 3],
  ["atmospheric science", /atmospheric (?:science|dynamics|physics|modell?ing)|\bmeteorolog/i, 3],
  ["extremes", /extreme (?:rainfall|precipitation|weather|events)/i, 3],
  ["climate dynamics", /climate (?:dynamics|variability|prediction|modell?ing)/i, 3],

  ["climate", /\bclimate\b/i, 1],
  ["atmosphere", /\batmospher/i, 1],
  ["hydrometeorology", /hydro-?meteorolog|hydro-?climat/i, 1],
  ["earth system", /earth[- ]system/i, 1],
  ["teleconnections", /teleconnection|ocean[- ]atmosphere|\benso\b/i, 1],
  ["forecasting", /\bforecast|\bpredictab/i, 1],
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
  const matched = [];
  for (const [label, pattern, weight] of TERMS) {
    // A word in the title says what the job is; in the summary it is only mentioned.
    const points = pattern.test(t) ? weight * 2 : pattern.test(s) ? weight : 0;
    if (points) {
      relevance += points;
      matched.push(label);
    }
  }
  return { keep: relevance >= KEEP_AT, relevance, matched, reason: relevance >= KEEP_AT ? "" : "off-topic" };
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
