// Search engine. MiniSearch supplies the inverted index, BM25 ranking, prefix and
// fuzzy matching; this module adds the query language, field vocabulary, a relaxed
// fallback, suggestions and highlighting.
import MiniSearch from "./vendor/minisearch.js";
import { passesFilters, synonymsOf } from "./query.js";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "its",
  "of", "on", "or", "that", "the", "their", "this", "to", "was", "with",
]);

/** Lower-case, strip accents, drop stop words. Used for both indexing and querying. */
export function processTerm(term) {
  const t = term.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return t.length === 0 || STOP_WORDS.has(t) ? null : t;
}

// How much a match in each field counts. Title and tags say what an entry *is*;
// the long prose fields only mention things.
const JOB_FIELDS = { title: 4, tags: 3, org: 2.5, country: 2, fit: 1, perk: 0.8, note: 0.6 };

// Ranking nudges on top of text relevance: things you can still act on come first.
const STATE_BOOST = { closing: 1.35, open: 1.25, rolling: 1.2, applied: 1, lead: 1, closed: 0.6 };

function buildTree(q, combineWith) {
  // One sub-query per word: the word itself OR any synonym (a multi-word synonym
  // needs all of its words).
  const queries = q.terms.map((term) => {
    const alternatives = synonymsOf(term).map((s) => ({ queries: s.split(" "), combineWith: "AND" }));
    return alternatives.length ? { queries: [term, ...alternatives], combineWith: "OR" } : term;
  });
  // Phrase words must be present too; the exact phrase is checked afterwards.
  for (const phrase of q.phrases) queries.push({ queries: phrase.split(/\s+/), combineWith: "AND" });
  return { queries, combineWith };
}

/**
 * @param {object[]} docs    records with an `id`
 * @param {object}   [opts]  { fields: {name: boost}, toText: {name: fn(doc)} }
 */
export function createEngine(docs, opts = {}) {
  const fields = opts.fields || JOB_FIELDS;
  const byId = new Map(docs.map((d) => [d.id, d]));
  const index = new MiniSearch({
    fields: Object.keys(fields),
    extractField: (doc, name) => {
      const v = doc[name];
      return Array.isArray(v) ? v.join(" ") : v == null ? "" : String(v);
    },
    processTerm,
    searchOptions: {
      boost: fields,
      prefix: (term) => term.length >= 2,
      fuzzy: (term) => (term.length > 3 ? 0.2 : false),
      processTerm,
    },
  });
  index.addAll(docs);

  function run(q, combineWith) {
    return index.search(buildTree(q, combineWith)).map((r) => ({
      item: byId.get(r.id),
      relevance: r.score,
      // Words actually found in this document, including fuzzy and prefix expansions.
      matched: Object.keys(r.match),
    }));
  }

  /**
   * @param {object} q    parsed query (see query.js)
   * @param {object} ctx  { saved: Set<string> }
   * @returns {{ hits: {item, relevance, matched}[], relaxed: boolean, suggestion: string|null }}
   */
  function search(q, ctx = { saved: new Set() }) {
    const keep = (h) => passesFilters(h.item, q, ctx);

    if (!q.hasText) {
      // Operators only (or nothing at all): every record that passes, unranked.
      return { hits: docs.map((item) => ({ item, relevance: 0, matched: [] })).filter(keep), relaxed: false, suggestion: null };
    }

    let hits = run(q, "AND").filter(keep);
    let relaxed = false;
    if (hits.length === 0 && q.terms.length > 1) {
      hits = run(q, "OR").filter(keep);
      relaxed = hits.length > 0;
    }

    for (const h of hits) h.relevance *= STATE_BOOST[h.item.state] ?? 1;
    hits.sort((a, b) => b.relevance - a.relevance);

    return { hits, relaxed, suggestion: hits.length === 0 ? suggest(q) : null };
  }

  /** "Did you mean": the closest indexed wording for a query that found nothing. */
  function suggest(q) {
    if (!q.terms.length) return null;
    const text = q.terms.join(" ");
    const options = index.autoSuggest(text, { fuzzy: (term) => (term.length > 2 ? 0.34 : false), prefix: true, combineWith: "AND" });
    const best = options.find((o) => o.suggestion && o.suggestion !== text);
    return best ? best.suggestion : null;
  }

  return { search, suggest, size: docs.length };
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits text into plain and matching runs so the UI can mark hits without
 * ever interpolating data into HTML itself.
 * @returns {{text: string, hit: boolean}[]}
 */
export function highlight(text, words) {
  const str = String(text || "");
  const list = [...new Set((words || []).filter((w) => w && w.length > 1))].sort((a, b) => b.length - a.length);
  if (!list.length || !str) return [{ text: str, hit: false }];
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${list.map(escapeRegExp).join("|")})`, "giu");
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    const start = m.index + m[1].length;
    const end = start + m[2].length;
    if (start > last) out.push({ text: str.slice(last, start), hit: false });
    out.push({ text: str.slice(start, end), hit: true });
    last = end;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  if (last < str.length) out.push({ text: str.slice(last), hit: false });
  return out;
}

/** Words to highlight for a hit: what the index matched, plus quoted phrases. */
export function highlightWords(q, matched) {
  return [...(matched || []), ...q.phrases];
}

/**
 * Picks the most useful sentence to show under a result: the first field that
 * contains a hit, trimmed around it. Falls back to the "fit" line.
 */
export function snippet(item, words, maxLength = 210) {
  const candidates = [item.fit, item.note, item.perk].filter(Boolean);
  const list = (words || []).filter((w) => w && w.length > 1).map((w) => w.toLowerCase());
  let source = candidates[0] || "";
  let at = -1;
  for (const c of candidates) {
    const lower = c.toLowerCase();
    const positions = list.map((w) => lower.indexOf(w)).filter((i) => i >= 0);
    if (positions.length) {
      source = c;
      at = Math.min(...positions);
      break;
    }
  }
  if (source.length <= maxLength) return source;
  if (at < maxLength * 0.6) return `${source.slice(0, maxLength).replace(/\s+\S*$/, "")}…`;
  const start = Math.max(0, at - Math.floor(maxLength * 0.35));
  const body = source.slice(start, start + maxLength).replace(/^\S*\s+/, "").replace(/\s+\S*$/, "");
  return `…${body}…`;
}
