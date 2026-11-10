// A small, forgiving RSS 2.0 / Atom reader. Feed text is untrusted: everything
// returned here is plain text with markup removed, and only http(s) links survive.

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };

export function decodeEntities(s) {
  return String(s || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    const named = NAMED[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

/** Markup and entities out, whitespace collapsed, length capped. */
export function cleanText(raw, max = 600) {
  let s = String(raw || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  s = decodeEntities(s); // feeds usually carry HTML as entity-encoded text
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ");
  s = decodeEntities(s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : s;
}

function inner(block, names) {
  for (const name of names) {
    const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i").exec(block);
    if (m) return m[1];
  }
  return "";
}

function httpUrl(value) {
  const s = decodeEntities(String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}

function linkOf(block) {
  // RSS: <link>https://…</link>
  const rss = httpUrl(inner(block, ["link"]));
  if (rss) return rss;
  // Atom: <link href="…" rel="alternate"/> — prefer the alternate, accept one with no rel.
  const tags = block.match(/<link\b[^>]*>/gi) || [];
  const attr = (tag, name) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
    return m ? (m[2] ?? m[3]) : "";
  };
  const ranked = tags
    .map((tag) => ({ href: httpUrl(attr(tag, "href")), rel: attr(tag, "rel").toLowerCase() }))
    .filter((l) => l.href && (l.rel === "" || l.rel === "alternate"))
    .sort((a, b) => (a.rel === "alternate" ? -1 : 0) - (b.rel === "alternate" ? -1 : 0));
  if (ranked.length) return ranked[0].href;
  // Last resort: a guid that is itself a URL.
  return httpUrl(inner(block, ["guid", "id"]));
}

function dateOf(block) {
  const raw = cleanText(inner(block, ["pubDate", "published", "updated", "dc:date"]), 80);
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** True when the text looks like a feed at all (as opposed to an HTML error page). */
export function looksLikeFeed(xml) {
  return /<(rss|feed|rdf:RDF)\b/i.test(String(xml || "").slice(0, 2000));
}

/**
 * @returns {{title: string, url: string, summary: string, published: string|null}[]}
 */
export function parseFeed(xml) {
  const src = String(xml || "");
  const blocks = src.match(/<item\b[\s\S]*?<\/item>/gi) || src.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const out = [];
  for (const block of blocks) {
    const title = cleanText(inner(block, ["title"]), 240);
    const url = linkOf(block);
    if (!title || !url) continue;
    out.push({
      title,
      url,
      summary: cleanText(inner(block, ["description", "summary", "content:encoded", "content"]), 400),
      published: dateOf(block),
    });
  }
  return out;
}
