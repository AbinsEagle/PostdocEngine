// Decides what a fetched link tells us. Pure: no network, so it can be tested.
//
// kinds
//   ok               the link leads to a page
//   dead             the page is gone (404/410, the domain does not resolve, or a "not found" page)
//   not-a-page       the link returns a file that is not a document (an image, an archive…)
//   redirected-home  the link now lands somewhere shallower than the posting it pointed at
//   soft-closed      the page loads but says the posting is closed
//   blocked          the site refuses automated requests; nothing can be concluded
//   error            the check itself failed (timeout, server error); nothing can be concluded

// Phrases specific enough that they only appear when a posting is closed. Kept
// narrow on purpose: a listing page that mentions one closed item should not trip this.
export const CLOSED_PHRASES = [
  "no longer accepting applications",
  "this job is no longer available",
  "this job has expired",
  "this job posting has expired",
  "this job listing has expired",
  "this job advert has expired",
  "this job has been closed",
  "this posting has expired",
  "this posting is no longer active",
  "this vacancy has now closed",
  "this vacancy has closed",
  "this vacancy is now closed",
  "this vacancy has expired",
  "this position has been filled",
  "the position has been filled",
  "this position is no longer available",
  "this opportunity is now closed",
  "applications for this position are closed",
  "the job you are looking for is no longer",
  "job is no longer active",
];

const NOT_FOUND_TITLE = /\b(404|page not found|not found|page cannot be found|page can't be found)\b/i;

export function textOf(html) {
  return String(html || "")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(html) {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ""));
  return m ? textOf(m[1]) : "";
}

const depth = (pathname) => pathname.split("/").filter(Boolean).length;

/** True when a redirect has taken us to a shallower page that no longer names the posting. */
export function redirectedAway(requestedUrl, finalUrl) {
  let from;
  let to;
  try {
    from = new URL(requestedUrl);
    to = new URL(finalUrl);
  } catch {
    return false;
  }
  const fromDepth = depth(from.pathname);
  const toDepth = depth(to.pathname);
  if (fromDepth === 0 || toDepth >= fromDepth) return false;
  // A shorter path that still carries the posting's last segment is a tidy-up, not a loss.
  const last = from.pathname.split("/").filter(Boolean).pop().toLowerCase();
  return !to.pathname.toLowerCase().includes(last);
}

/**
 * @param {object} r
 * @param {string}  r.requestedUrl
 * @param {number}  [r.status]       HTTP status of the final response
 * @param {string}  [r.contentType]
 * @param {string}  [r.finalUrl]     URL after redirects
 * @param {string}  [r.body]         start of the response body, when it was text
 * @param {string}  [r.error]        set instead of a status when the request failed
 * @param {string}  [r.errorCode]    e.g. ENOTFOUND, ETIMEDOUT
 * @returns {{kind: string, detail: string}}
 */
export function classify(r) {
  if (r.error) {
    if (r.errorCode === "ENOTFOUND") return { kind: "dead", detail: "the domain does not resolve" };
    if (r.errorCode === "EAI_AGAIN") return { kind: "error", detail: "the DNS lookup failed temporarily" };
    if (/timeout|timed out|aborted/i.test(r.error)) return { kind: "error", detail: "the site did not answer in time" };
    return { kind: "error", detail: `request failed (${r.errorCode || r.error})`.slice(0, 120) };
  }

  const status = r.status;
  if (status === 404 || status === 410) return { kind: "dead", detail: `the page is gone (HTTP ${status})` };
  if (status === 401 || status === 403 || status === 429 || status === 999) {
    return { kind: "blocked", detail: `the site refuses automated checks (HTTP ${status})` };
  }
  if (status >= 500) return { kind: "error", detail: `the site returned a server error (HTTP ${status})` };
  if (status < 200 || status >= 400) return { kind: "error", detail: `unexpected response (HTTP ${status})` };

  const type = String(r.contentType || "").toLowerCase().split(";")[0].trim();
  const isDocument = !type || /html|xml|text\/plain/.test(type);
  if (!isDocument) {
    if (type === "application/pdf") return { kind: "ok", detail: "a PDF document" };
    return { kind: "not-a-page", detail: `the link returns a file (${type}), not a page` };
  }

  if (r.finalUrl && redirectedAway(r.requestedUrl, r.finalUrl)) {
    return { kind: "redirected-home", detail: `now redirects to ${r.finalUrl}`.slice(0, 200) };
  }

  const body = String(r.body || "");
  if (NOT_FOUND_TITLE.test(titleOf(body))) return { kind: "dead", detail: "the page reports that it was not found" };

  const text = textOf(body).toLowerCase();
  const phrase = CLOSED_PHRASES.find((p) => text.includes(p));
  if (phrase) return { kind: "soft-closed", detail: `the page says: "${phrase}"` };

  // Some job sites send an empty shell and draw the posting with script.
  if (body && text.length < 200) return { kind: "ok", detail: "the page loads, but its content is drawn by script and could not be read" };
  return { kind: "ok", detail: "" };
}

/**
 * True when the results say more about the checker than about the links: if most
 * requests got no HTTP response at all, the machine running the check is offline
 * or its DNS is failing, and recording "dead" for everything would be a false alarm.
 */
export function looksLikeOutage(links) {
  const recs = Object.values(links);
  if (recs.length < 4) return false;
  const noResponse = recs.filter((r) => r.http === null || r.http === undefined).length;
  return noResponse / recs.length > 0.5;
}

export const PROBLEM_KINDS = new Set(["dead", "not-a-page", "redirected-home", "soft-closed"]);
export const UNVERIFIABLE_KINDS = new Set(["blocked", "error"]);

export function summarise(links) {
  const s = { total: 0, ok: 0, problem: 0, unverifiable: 0 };
  for (const rec of Object.values(links)) {
    s.total += 1;
    if (rec.kind === "ok") s.ok += 1;
    else if (PROBLEM_KINDS.has(rec.kind)) s.problem += 1;
    else s.unverifiable += 1;
  }
  return s;
}
