// Vercel serverless function: postdoc-opening scan for the dashboard's Refresh button.
//
// Two providers, auto-selected by which key is present (override with ?provider=):
//
//   ANTHROPIC (ANTHROPIC_API_KEY)  — uses the server-side web_search tool, so it
//     actually browses the job boards on Anthropic's infra (this function only
//     needs to reach api.anthropic.com). Returns genuine live postings, scored
//     against the Section 2 rubric, flagged live:true (live · unverified).
//
//   NVIDIA (NVIDIA_API_KEY)        — OpenAI-compatible inference endpoint with NO
//     web access. It therefore CANNOT fetch real vacancies. To respect Rule 2
//     ("verify per posting; never assume"), the NVIDIA path returns matching
//     research groups / fellowship programs to VERIFY — real institutions with
//     stable careers-page links, deadline:null — flagged suggested:true (ai · verify),
//     never presented as confirmed openings.
//
// Set the key(s) in Vercel -> Settings -> Environment Variables, then redeploy.
// With no key the endpoint returns 501 and the dashboard shows its committed data.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-opus-4-8";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
// Override with the NVIDIA_MODEL env var (any model id from build.nvidia.com).
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct";

const BOARDS = [
  "euraxess.ec.europa.eu",
  "jobs.ac.uk",
  "academicpositions.com",
  "findajob.agu.org",
  "nature.com",
  "gewex.org",
];

const KEYWORDS =
  "monsoon, intraseasonal, BSISO, MJO, radar meteorology, QPE, precipitation, " +
  "machine learning weather, tropical convection";

const PROFILE = `Rona Maria Sunil (ACARR-CUSAT), final-year PhD in tropical meteorology:
monsoon onset dynamics, BSISO/intraseasonal variability, VHF radar, and GRU-LSTM
machine-learning prediction. Thesis late 2026, postdoc start early-mid 2027. Spouse
relocates with her, so spouse visa WORK RIGHTS are a first-class criterion. End goal:
return to an Indian scientist post (IITM/ISRO/NCMRWF).`;

const RUBRIC = `Score each 0-10 per criterion, then weighted = (30*stability + 25*fit +
20*india + 15*prestige + 10*perm)/1000, rounded to 2 decimals:
- stability (30%): net salary vs cost of living, spouse work rights, contract >= 2yr
- fit (25%): group's ISV/BSISO + radar + ML match to Rona's toolkit
- india (20%): brand weight for an India return; India collaborations
- prestige (15%): field-specific reputation
- perm (10%): permanence pathway (secondary; plan is India)`;

const SHAPE = `each object exactly:
{"t": title, "org": institution, "loc": country, "score": weighted number,
 "s": [stability,fit,india,prestige,perm], "status": short note,
 "tier": "shortlist" if score>=7 else "watch", "deadline": "YYYY-MM-DD" or null,
 "link": URL, "tags": [3-6 short keywords]}`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasNvidia = !!process.env.NVIDIA_API_KEY;

  // Provider selection: explicit ?provider= wins, else auto (Anthropic preferred).
  let requested = "";
  try {
    requested = (new URL(req.url, "http://x").searchParams.get("provider") || "").toLowerCase();
  } catch { /* ignore */ }

  let provider = requested;
  if (!provider) provider = hasAnthropic ? "anthropic" : hasNvidia ? "nvidia" : "";

  if (provider === "anthropic" && !hasAnthropic) {
    return res.status(501).json({ error: "not_configured", provider,
      message: "Set ANTHROPIC_API_KEY in the Vercel project to use the Anthropic (web-search) provider." });
  }
  if (provider === "nvidia" && !hasNvidia) {
    return res.status(501).json({ error: "not_configured", provider,
      message: "Set NVIDIA_API_KEY in the Vercel project to use the NVIDIA provider." });
  }
  if (!provider) {
    return res.status(501).json({ error: "not_configured",
      message: "Live refresh needs ANTHROPIC_API_KEY or NVIDIA_API_KEY set in the Vercel project. Showing the committed data instead." });
  }

  try {
    const jobs = provider === "anthropic" ? await scanAnthropic() : await scanNvidia();
    res.status(200).json({ provider, scannedAt: new Date().toISOString(), count: jobs.length, jobs });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.code || "server_error", provider, message: String(err.message || err).slice(0, 400) });
  }
};

// ---- Anthropic: real web search, returns live postings ----
async function scanAnthropic() {
  const prompt =
`You are running the 5-day postdoc scan for ${PROFILE}

Use web_search to find CURRENTLY-OPEN postdoc positions (not papers, not expired ads)
matching: ${KEYWORDS}. Prefer the academic job boards.

${RUBRIC}

Return ONLY a JSON array (no prose, no markdown fence) of up to 8 openings you could
actually verify from a real posting, ${SHAPE}
If you cannot verify any live posting, return [].`;

  let messages = [{ role: "user", content: prompt }];
  let finalText = "";
  for (let i = 0; i < 6; i++) {
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 8000,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, allowed_domains: BOARDS }],
        messages,
      }),
    });
    if (!resp.ok) throw apiError("anthropic_error", resp.status, (await resp.text()).slice(0, 400));
    const data = await resp.json();
    finalText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    if (data.stop_reason === "pause_turn") { messages = [{ role: "user", content: prompt }, { role: "assistant", content: data.content }]; continue; }
    break;
  }
  return extractJobs(finalText).map((j) => normalize(j, { live: true }));
}

// ---- NVIDIA: inference only, returns groups/programs to verify (no fake vacancies) ----
async function scanNvidia() {
  const prompt =
`You are helping run a postdoc target-search for ${PROFILE}

You do NOT have web access. Do NOT invent specific vacancies, deadlines, or apply URLs.
Instead, from your knowledge, list research groups, labs, or fellowship programs that
RECURRENTLY recruit postdocs in these areas and fit the profile: ${KEYWORDS}.
These are LEADS TO VERIFY, not confirmed openings.

${RUBRIC}

Return ONLY a JSON array (no prose, no markdown fence) of up to 8 targets, ${SHAPE}
Rules: set "deadline" to null always; "link" must be the group's or program's official
careers/opportunities homepage (a real, stable URL you are confident exists), not a
specific job posting; "status" must say "verify current openings". Prefer groups with
strong monsoon/ISV/radar/ML fit and good India-return brand.`;

  const resp = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        { role: "system", content: "You output only a raw JSON array, no prose, no markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!resp.ok) throw apiError("nvidia_error", resp.status, (await resp.text()).slice(0, 400));
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "";
  return extractJobs(text).map((j) => normalize(j, { suggested: true, deadline: null, status: j.status || "verify current openings" }));
}

// ---- helpers ----
function apiError(code, status, detail) {
  const e = new Error(detail || code); e.code = code; e.status = status === 401 ? 401 : 502; return e;
}

function normalize(j, extra) {
  return {
    t: j.t || "Untitled", org: j.org || "", loc: j.loc || "",
    score: typeof j.score === "number" ? j.score : null,
    s: Array.isArray(j.s) ? j.s : null,
    status: j.status || "", tier: j.tier || "watch",
    deadline: "deadline" in extra ? extra.deadline : (j.deadline || null),
    link: j.link || "", tags: Array.isArray(j.tags) ? j.tags : [],
    live: !!extra.live, suggested: !!extra.suggested,
  };
}

function extractJobs(text) {
  if (!text) return [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("["), end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try { const p = JSON.parse(candidate.slice(start, end + 1)); return Array.isArray(p) ? p : []; }
  catch { return []; }
}

// Allow up to 60s (web search + reasoning); default Hobby cap is 10s.
module.exports.config = { maxDuration: 60 };
