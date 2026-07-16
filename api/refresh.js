// Vercel serverless function: live postdoc-opening scan via Claude + web search.
//
// The dashboard's "Refresh" button POSTs here. This runs server-side on Vercel,
// calls the Anthropic Messages API with the server-side web_search tool (the
// search itself runs on Anthropic's infrastructure, so this function only needs
// to reach api.anthropic.com — not the job boards directly), asks Claude to find
// NEW postdoc openings matching Rona's profile and score them against the Section 2
// rubric, and returns them in the same shape as the dashboard's JOBS array.
//
// Requires the ANTHROPIC_API_KEY environment variable to be set in the Vercel
// project (Settings -> Environment Variables). Without it, this returns 501 and
// the dashboard falls back to its committed data.
//
// Results are flagged live:true and are UNVERIFIED — they are candidates to review,
// not an approved shortlist. The durable record stays the git-tracked JOBS array,
// updated during the 5-day Cowork scan.

const MODEL = "claude-opus-4-8";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

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

// Section 1 candidate snapshot + Section 2 rubric, condensed for the model.
const PROMPT = `You are running the 5-day postdoc scan for Rona Maria Sunil (ACARR-CUSAT),
a final-year PhD in tropical meteorology: monsoon onset dynamics, BSISO/intraseasonal
variability, VHF radar, and GRU-LSTM machine-learning prediction. Thesis late 2026,
postdoc start early-mid 2027. Spouse relocates with her, so spouse visa WORK RIGHTS
are a first-class criterion. End goal: return to an Indian scientist post (IITM/ISRO/NCMRWF).

Use web_search to find CURRENTLY-OPEN postdoc positions (not papers, not expired ads)
matching: ${KEYWORDS}. Prefer the academic job boards.

Score each opening 0-10 on each criterion, then compute weighted = (30*stability +
25*fit + 20*india + 15*prestige + 10*perm)/1000, rounded to 2 decimals:
- stability (30%): net salary vs cost of living, spouse work rights, contract >= 2yr
- fit (25%): group's ISV/BSISO + radar + ML match to Rona's toolkit
- india (20%): brand weight for an India return; India collaborations
- prestige (15%): field-specific reputation
- perm (10%): permanence pathway (secondary; permanence plan is India)

Return ONLY a JSON array (no prose, no markdown fence) of up to 8 openings you could
actually verify from a real posting, each exactly:
{"t": title, "org": institution, "loc": country, "score": weighted number,
 "s": [stability,fit,india,prestige,perm], "status": short note incl. deadline if known,
 "tier": "shortlist" if score>=7 else "watch", "deadline": "YYYY-MM-DD" or null,
 "link": posting URL, "tags": [3-6 short keywords]}
If you cannot verify any live posting, return [].`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(501).json({
      error: "not_configured",
      message:
        "Live refresh needs ANTHROPIC_API_KEY set in the Vercel project. " +
        "Showing the committed data instead.",
    });
    return;
  }

  const tools = [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: 8,
      allowed_domains: BOARDS,
    },
  ];

  // The web_search tool runs a server-side loop that can stop with
  // stop_reason "pause_turn"; re-send with the assistant turn appended to resume.
  let messages = [{ role: "user", content: PROMPT }];
  let finalText = "";

  try {
    for (let i = 0; i < 6; i++) {
      const resp = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 8000,
          tools,
          messages,
        }),
      });

      if (!resp.ok) {
        const detail = await resp.text();
        res.status(502).json({ error: "anthropic_error", status: resp.status, detail: detail.slice(0, 500) });
        return;
      }

      const data = await resp.json();
      finalText = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      if (data.stop_reason === "pause_turn") {
        messages = [
          { role: "user", content: PROMPT },
          { role: "assistant", content: data.content },
        ];
        continue;
      }
      break;
    }

    const jobs = extractJobs(finalText).map((j) => ({
      ...j,
      s: Array.isArray(j.s) ? j.s : null,
      tags: Array.isArray(j.tags) ? j.tags : [],
      live: true, // flag: live, unverified — not part of the approved shortlist
    }));

    res.status(200).json({
      scannedAt: new Date().toISOString(),
      count: jobs.length,
      jobs,
    });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err).slice(0, 300) });
  }
};

// Tolerantly pull a JSON array out of the model's final text.
function extractJobs(text) {
  if (!text) return [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Allow up to 60s (web search + reasoning); default Hobby cap is 10s.
module.exports.config = { maxDuration: 60 };
