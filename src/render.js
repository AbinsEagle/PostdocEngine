// Small pure helpers for turning data into safe HTML. Everything that reaches the
// page goes through escapeHtml; feed text and curated text are treated the same way.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** The URL if it is plain http(s), otherwise null. Blocks javascript:, data: and friends. */
export function safeUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export function safeEmail(value) {
  return typeof value === "string" && EMAIL.test(value) ? value : null;
}

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** "recruit.ap.uci.edu › JPF10438" — where a link leads, in the style of a search result. */
export function breadcrumb(value) {
  const href = safeUrl(value);
  if (!href) return "";
  const u = new URL(href);
  const host = u.hostname.replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const shown = parts.slice(0, 2).map((p) => clip(p, 26));
  if (parts.length > 2) shown.push("…");
  return [host, ...shown].join(" › ");
}

/** A stable hue (0–359) for a name, so each organisation keeps its own colour. */
export function hueOf(text) {
  let h = 0;
  for (const ch of String(text || "")) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

/** Up to two initials: "TU Delft · EU MSCA fellowship" -> "TD". */
export function initials(name) {
  const words = String(name || "").split(/[·|,(/]/)[0].replace(/[^\p{L}\p{N}\s&-]/gu, " ").trim().split(/[\s-]+/).filter(Boolean);
  const letters = words.filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase());
  return letters.join("") || "•";
}

/** Renders highlight() output: matches wrapped in <mark>, everything escaped. */
export function markedHtml(parts) {
  return parts.map((p) => (p.hit ? `<mark>${escapeHtml(p.text)}</mark>` : escapeHtml(p.text))).join("");
}

/** Escapes, then turns **bold** into <strong>. Used for the scan log. */
export function inlineBold(text) {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** "today", "yesterday", "3 days ago", or a date once it is more than a month old. */
export function ago(days, fallback) {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 31) return `${days} days ago`;
  return fallback;
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
