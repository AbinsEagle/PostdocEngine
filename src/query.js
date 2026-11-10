// Query language. Plain words are ranked full-text search; operators filter.
//
//   monsoon radar            both words (typos and prefixes tolerated)
//   "machine learning"       exact phrase
//   -theory                  exclude a word
//   is:open                  open | closing | rolling | applied | lead | closed | saved | new | urgent | broken
//   -is:closed               any list operator can be negated
//   in:japan                 country (also loc:, country:)
//   tag:radar   org:columbia
//   score:>=7   score:none   fit score
//   due:30d     due:none     deadline within N days / no deadline
//   has:contact has:deadline has:score
//   type:opening | type:lead

const FILTER_KEYS = new Set(["is", "in", "loc", "country", "tag", "org", "score", "due", "deadline", "has", "type"]);
const KEY_ALIAS = { loc: "in", country: "in", deadline: "due" };

const IS_VALUES = new Set(["open", "closing", "rolling", "applied", "lead", "closed", "saved", "new", "urgent", "broken"]);
const HAS_VALUES = new Set(["contact", "deadline", "score"]);
const TYPE_VALUES = new Set(["opening", "lead"]);

const COUNTRY_ALIAS = {
  us: "usa", america: "usa", "united states": "usa", states: "usa",
  britain: "uk", england: "uk", "united kingdom": "uk",
  emirates: "uae", "abu dhabi": "uae",
  holland: "netherlands", ksa: "saudi arabia", saudi: "saudi arabia",
};

// Field vocabulary. Each group lists ways of saying the same thing; a query word
// that matches one member also searches for the others.
const SYNONYM_GROUPS = [
  ["isv", "intraseasonal"],
  ["bsiso", "boreal summer intraseasonal"],
  ["mjo", "madden julian"],
  ["ml", "machine learning"],
  ["dl", "deep learning"],
  ["ai", "artificial intelligence"],
  ["qpe", "precipitation estimation"],
  ["s2s", "subseasonal", "sub seasonal"],
  ["da", "data assimilation"],
  ["nwp", "numerical weather prediction"],
  ["lps", "low pressure systems"],
  ["postdoc", "postdoctoral"],
  ["rainfall", "precipitation"],
  ["forecast", "forecasting", "prediction"],
];

const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const member of group) {
    if (member.includes(" ")) continue; // only single words trigger expansion
    SYNONYMS.set(member, group.filter((g) => g !== member));
  }
}

export function synonymsOf(word) {
  return SYNONYMS.get(String(word).toLowerCase()) || [];
}

/** Splits on whitespace, keeping "quoted phrases" and key:"quoted value" together. */
export function tokenize(input) {
  const out = [];
  const re = /(-?)(?:([a-z]+):)?(?:"([^"]*)"?|(\S+))/gi;
  let m;
  while ((m = re.exec(String(input))) !== null) {
    const quoted = m[3] !== undefined;
    let key = m[2] ? m[2].toLowerCase() : null;
    let value = ((quoted ? m[3] : m[4]) || "").trim();
    // "is:" with nothing after it yet: keep it as an operator with an empty value.
    const bare = !key && !quoted ? /^([a-z]+):$/i.exec(value) : null;
    if (bare) {
      key = bare[1].toLowerCase();
      value = "";
    }
    if (!value && !key) continue;
    out.push({ negated: m[1] === "-", key, value, quoted });
  }
  return out;
}

function parseScore(v) {
  if (v === "none") return { op: "none" };
  const m = /^(>=|<=|>|<|=)?(\d+(?:\.\d+)?)$/.exec(v);
  if (!m) return null;
  return { op: m[1] || ">=", value: Number(m[2]) };
}

function parseDue(v) {
  if (v === "none") return { none: true };
  const m = /^<?=?(\d+)d?$/.exec(v);
  return m ? { days: Number(m[1]) } : null;
}

/**
 * @returns {{
 *   raw: string, terms: string[], phrases: string[], exclude: string[],
 *   filters: { is: string[], in: string[], tag: string[], org: string[], has: string[], type: string[],
 *              score: {op:string,value?:number}|null, due: {days?:number,none?:boolean}|null },
 *   not: { is: string[], in: string[], tag: string[], org: string[], has: string[], type: string[] },
 *   ignored: string[], hasText: boolean, isEmpty: boolean
 * }}
 */
export function parseQuery(input) {
  const raw = String(input || "").trim();
  const lists = () => ({ is: [], in: [], tag: [], org: [], has: [], type: [] });
  const q = {
    raw, terms: [], phrases: [], exclude: [],
    filters: { ...lists(), score: null, due: null },
    not: lists(), // negated operators, e.g. -is:closed
    ignored: [],
  };

  for (const tok of tokenize(raw)) {
    const value = tok.value.toLowerCase();

    if (!(tok.key && FILTER_KEYS.has(tok.key))) {
      // An unknown "key:" is just text, e.g. a title containing a colon.
      const textValue = tok.key ? `${tok.key} ${value}`.trim() : value;
      if (!textValue) continue;
      if (tok.negated) q.exclude.push(textValue);
      else if (tok.quoted && textValue.includes(" ")) q.phrases.push(textValue);
      else q.terms.push(...textValue.split(/\s+/));
      continue;
    }

    if (!value) continue; // "is:" with nothing after it yet — the user is still typing

    const key = KEY_ALIAS[tok.key] || tok.key;
    const into = tok.negated ? q.not : q.filters;
    let ok = true;
    if (key === "is") ok = IS_VALUES.has(value) && (into.is.push(value), true);
    else if (key === "has") ok = HAS_VALUES.has(value) && (into.has.push(value), true);
    else if (key === "type") ok = TYPE_VALUES.has(value) && (into.type.push(value), true);
    else if (key === "in") into.in.push(COUNTRY_ALIAS[value] || value);
    else if (key === "tag") into.tag.push(value);
    else if (key === "org") into.org.push(value);
    else if (tok.negated) ok = false; // -score: and -due: have no sensible meaning
    else if (key === "score") ok = !!(q.filters.score = parseScore(value));
    else if (key === "due") ok = !!(q.filters.due = parseDue(value));
    if (!ok) q.ignored.push(`${tok.negated ? "-" : ""}${tok.key}:${tok.value}`);
  }

  const any = (o) => Object.values(o).some((v) => (Array.isArray(v) ? v.length : v));
  q.hasText = q.terms.length > 0 || q.phrases.length > 0;
  q.isEmpty = !q.hasText && !q.exclude.length && !any(q.filters) && !any(q.not);
  return q;
}

function matchesScore(item, s) {
  if (s.op === "none") return item.score === null;
  if (item.score === null) return false;
  const v = item.score;
  if (s.op === ">=") return v >= s.value;
  if (s.op === ">") return v > s.value;
  if (s.op === "<=") return v <= s.value;
  if (s.op === "<") return v < s.value;
  return v === s.value;
}

const IS_TESTS = {
  open: (it) => it.tab === "open",
  closing: (it) => it.state === "closing",
  urgent: (it) => it.state === "closing",
  rolling: (it) => it.state === "rolling",
  applied: (it) => it.state === "applied",
  lead: (it) => it.state === "lead",
  closed: (it) => it.state === "closed",
  new: (it) => !!it.isNew,
  broken: (it) => !!it.linkWarning, // the link check found a problem on something still actionable
  saved: (it, ctx) => ctx.saved.has(it.id),
};

/** Lower-cased text of everything searchable on an entry, for phrase and exclusion checks. */
export function haystack(item) {
  return [
    item.title, item.org, item.country, (item.tags || []).join(" "), item.fit, item.perk, item.note,
    item.summary, item.sourceName, // feed candidates
  ].filter(Boolean).join(" \n ").toLowerCase();
}

const lc = (s) => String(s || "").toLowerCase();

const HAS_TESTS = {
  contact: (it) => !!(it.contacts && it.contacts.length),
  deadline: (it) => !!it.deadline,
  score: (it) => it.score !== null,
};

// One test per list-type operator; used for both the positive and the negated form.
const LIST_TESTS = {
  is: (it, v, ctx) => IS_TESTS[v](it, ctx),
  type: (it, v) => it.type === v,
  in: (it, v) => lc(it.country).includes(v),
  org: (it, v) => lc(it.org).includes(v),
  tag: (it, v) => (it.tags || []).some((t) => lc(t).includes(v)),
  has: (it, v) => HAS_TESTS[v](it),
};

/** Applies operators, phrases and exclusions to one enriched entry. */
export function passesFilters(item, q, ctx = { saved: new Set() }) {
  const f = q.filters;

  for (const key of Object.keys(LIST_TESTS)) {
    const test = LIST_TESTS[key];
    if (!f[key].every((v) => test(item, v, ctx))) return false;
    if (q.not[key].some((v) => test(item, v, ctx))) return false;
  }
  if (f.score && !matchesScore(item, f.score)) return false;
  if (f.due) {
    if (f.due.none ? item.deadline !== null : !(item.deadline && item.daysLeft >= 0 && item.daysLeft <= f.due.days)) return false;
  }
  if (q.phrases.length || q.exclude.length) {
    const hay = haystack(item);
    if (!q.phrases.every((p) => hay.includes(p))) return false;
    if (q.exclude.some((x) => hay.includes(x))) return false;
  }
  return true;
}
