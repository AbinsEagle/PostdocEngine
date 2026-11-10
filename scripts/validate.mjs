// Schema check for the curated data files. No dependencies; run with `node scripts/validate.mjs`.
// CI runs this on every push so a malformed hand-edit never reaches the live site.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const JOB_KEYS = new Set([
  "id", "title", "org", "country", "type", "applied", "closed", "deadline", "url",
  "score", "subscores", "added", "tags", "fit", "perk", "note", "contacts",
]);

function isRealDate(s) {
  if (typeof s !== "string" || !ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isHttpUrl(s) {
  if (typeof s !== "string") return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const text = (v) => typeof v === "string" && v.trim().length > 0;

export function validateJobs(data) {
  const errors = [];
  if (!data || typeof data !== "object") return ["jobs file is not an object"];
  if (data.schema !== 2) errors.push(`schema must be 2 (got ${JSON.stringify(data.schema)})`);
  if (!isRealDate(data.updated)) errors.push("updated must be a YYYY-MM-DD date");
  if (!Array.isArray(data.jobs)) return [...errors, "jobs must be an array"];

  const seen = new Set();
  data.jobs.forEach((j, i) => {
    const at = `jobs[${i}]${j && j.id ? ` (${j.id})` : ""}`;
    const err = (m) => errors.push(`${at}: ${m}`);
    if (!j || typeof j !== "object") return err("not an object");

    for (const k of Object.keys(j)) if (!JOB_KEYS.has(k)) err(`unknown field "${k}"`);

    if (typeof j.id !== "string" || !ID.test(j.id)) err("id must be a lowercase-hyphen slug");
    else if (seen.has(j.id)) err("duplicate id");
    else seen.add(j.id);

    for (const k of ["title", "org", "country", "fit", "perk", "note"]) {
      if (!text(j[k])) err(`${k} must be non-empty text`);
    }
    if (j.type !== "opening" && j.type !== "lead") err('type must be "opening" or "lead"');
    if (j.applied !== null && j.applied !== "submitted") err('applied must be null or "submitted"');
    if ("closed" in j && j.closed !== true) err("closed, when present, must be true");
    if (j.deadline !== null && !isRealDate(j.deadline)) err("deadline must be null or a real YYYY-MM-DD date");
    if (!isHttpUrl(j.url)) err("url must be an http(s) URL");
    if (!isRealDate(j.added)) err("added must be a real YYYY-MM-DD date");

    if (j.score !== null && !(typeof j.score === "number" && j.score >= 0 && j.score <= 10)) {
      err("score must be null or a number from 0 to 10");
    }
    if (j.subscores !== null) {
      const ok = Array.isArray(j.subscores) && j.subscores.length === 5 &&
        j.subscores.every((n) => typeof n === "number" && n >= 0 && n <= 10);
      if (!ok) err("subscores must be null or five numbers from 0 to 10");
    }
    if ((j.score === null) !== (j.subscores === null)) err("score and subscores must be set or null together");
    if (j.type === "lead" && j.applied) err("a lead cannot be applied to; make it an opening");

    if (!Array.isArray(j.tags) || !j.tags.every(text)) err("tags must be an array of non-empty strings");

    if ("contacts" in j) {
      if (!Array.isArray(j.contacts) || j.contacts.length === 0) err("contacts, when present, must be a non-empty array");
      else j.contacts.forEach((c, n) => {
        if (!c || !text(c.name)) err(`contacts[${n}].name must be non-empty text`);
        if (!c || typeof c.email !== "string" || !EMAIL.test(c.email)) err(`contacts[${n}].email is not a valid address`);
      });
    }
  });
  return errors;
}

export function validateBoard(data) {
  const errors = [];
  if (!data || typeof data !== "object") return ["board file is not an object"];
  if (!data.meta || !isRealDate(data.meta.lastScan)) errors.push("meta.lastScan must be a YYYY-MM-DD date");
  if (!data.meta || !isRealDate(data.meta.nextScan)) errors.push("meta.nextScan must be a YYYY-MM-DD date");
  if (!Array.isArray(data.milestones)) errors.push("milestones must be an array");
  else data.milestones.forEach((m, i) => {
    if (!m || !isRealDate(m.date)) errors.push(`milestones[${i}].date must be a real YYYY-MM-DD date`);
    if (!m || !text(m.text)) errors.push(`milestones[${i}].text must be non-empty text`);
  });
  if (!Array.isArray(data.log) || !data.log.every(text)) errors.push("log must be an array of non-empty strings");
  return errors;
}

export function validateSources(data) {
  const errors = [];
  if (!data || !Array.isArray(data.sources)) return ["sources file must contain a sources array"];
  const seen = new Set();
  data.sources.forEach((s, i) => {
    const at = `sources[${i}]${s && s.id ? ` (${s.id})` : ""}`;
    if (!s || typeof s.id !== "string" || !ID.test(s.id)) errors.push(`${at}: id must be a lowercase-hyphen slug`);
    else if (seen.has(s.id)) errors.push(`${at}: duplicate id`);
    else seen.add(s.id);
    if (!s || !text(s.name)) errors.push(`${at}: name must be non-empty text`);
    if (!s || s.type !== "feed") errors.push(`${at}: type must be "feed"`);
    if (!s || typeof s.enabled !== "boolean") errors.push(`${at}: enabled must be true or false`);
    if (!s || typeof s.url !== "string" || !isHttpUrl(s.url.replace("{q}", "x"))) errors.push(`${at}: url must be an http(s) URL`);
    const needsQueries = s && typeof s.url === "string" && s.url.includes("{q}");
    if (needsQueries && !(Array.isArray(s.queries) && s.queries.length && s.queries.every(text))) {
      errors.push(`${at}: url uses {q}, so queries must be a non-empty array of strings`);
    }
  });
  return errors;
}

const HEALTH_KINDS = new Set(["ok", "dead", "not-a-page", "redirected-home", "soft-closed", "blocked", "error"]);

/** data/health.json is written by scripts/check-links.mjs. */
export function validateHealth(data) {
  const errors = [];
  if (!data || typeof data !== "object") return ["health file is not an object"];
  if (data.checked !== null && typeof data.checked !== "string") errors.push("checked must be null or a timestamp");
  if (!data.links || typeof data.links !== "object" || Array.isArray(data.links)) return [...errors, "links must be an object keyed by job id"];
  for (const [id, rec] of Object.entries(data.links)) {
    const at = `links.${id}`;
    if (!ID.test(id)) errors.push(`${at}: key is not a job id`);
    if (!rec || typeof rec !== "object") { errors.push(`${at}: not an object`); continue; }
    if (!isHttpUrl(rec.url)) errors.push(`${at}: url must be an http(s) URL`);
    if (!HEALTH_KINDS.has(rec.kind)) errors.push(`${at}: unknown kind ${JSON.stringify(rec.kind)}`);
    if (rec.http !== null && typeof rec.http !== "number") errors.push(`${at}: http must be null or a number`);
    if (!isRealDate(rec.checked)) errors.push(`${at}: checked must be a YYYY-MM-DD date`);
    if ("detail" in rec && typeof rec.detail !== "string") errors.push(`${at}: detail must be text`);
  }
  return errors;
}

/** data/discover.json is written by scripts/discover.mjs. */
export function validateDiscover(data) {
  const errors = [];
  if (!data || typeof data !== "object") return ["discover file is not an object"];
  if (data.generated !== null && typeof data.generated !== "string") errors.push("generated must be null or a timestamp");
  if (!Array.isArray(data.sources)) errors.push("sources must be an array");
  if (!Array.isArray(data.items)) return [...errors, "items must be an array"];
  const seen = new Set();
  data.items.forEach((it, i) => {
    const at = `items[${i}]`;
    if (!it || typeof it !== "object") return void errors.push(`${at}: not an object`);
    if (!text(it.id)) errors.push(`${at}: id must be non-empty text`);
    else if (seen.has(it.id)) errors.push(`${at}: duplicate id ${it.id}`);
    else seen.add(it.id);
    if (!text(it.title)) errors.push(`${at}: title must be non-empty text`);
    if (!isHttpUrl(it.url)) errors.push(`${at}: url must be an http(s) URL`);
    if (!text(it.sourceName)) errors.push(`${at}: sourceName must be non-empty text`);
    if (typeof it.summary !== "string") errors.push(`${at}: summary must be text`);
    if (!Array.isArray(it.matched)) errors.push(`${at}: matched must be an array`);
    if (it.published !== null && typeof it.published !== "string") errors.push(`${at}: published must be null or a timestamp`);
  });
  return errors;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const load = (name) => JSON.parse(fs.readFileSync(path.join(root, "data", name), "utf8"));
  const checks = [
    ["data/jobs.json", () => validateJobs(load("jobs.json"))],
    ["data/board.json", () => validateBoard(load("board.json"))],
    ["data/sources.json", () => validateSources(load("sources.json"))],
    ["data/health.json", () => validateHealth(load("health.json"))],
    ["data/discover.json", () => validateDiscover(load("discover.json"))],
  ];
  let failed = 0;
  for (const [name, run] of checks) {
    let errors;
    try {
      errors = run();
    } catch (e) {
      errors = [`could not be read as JSON: ${e.message}`];
    }
    if (errors.length) {
      failed += errors.length;
      console.error(`✗ ${name}`);
      for (const e of errors) console.error(`    ${e}`);
    } else {
      console.log(`✓ ${name}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
