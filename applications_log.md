# Applications Log

## 12 Jul 2026 — 5-day scan (Cowork)

**Boards scanned:** EURAXESS (via indexed search — portal is JS-only, coverage partial), AGU Careers, Nature Careers, jobs.ac.uk.

**Scored:** KIT/HITS ML weather calibration 6.65 (appended to shortlist as safety net, closes 30 Jul); GFZ GenAI4Earth 6.35 (closes 22 Jul); Penn State EESI PCHES-ADAPT 5.85 (closes 19 Jul); Exeter NATALIE 5.40 (closes 20 Aug). None ≥ 7.0.

**Leads added to Section 5:** Birmingham HEPPI-ML (expired ads, outreach target), MPI-M Incubator Program (MSCA/Humboldt host route).

**Discarded:** MPI-M Cloud Wave Coupling W079 (stale 2021 EURAXESS post), Brown Univ EEPS (organic geochemistry), Maynooth ROADMAP (2020 post), Oxford tropical cyclones PDRA (closed 15 Jan 2026).

**Deadlines flagged:** MSCA skeleton 23 Jul; Gothenburg target submit 28 Jul (Rule 5: land 3–4 days early).

**Actions pending:** speculative outreach email to Birmingham HEPPI-ML PI (draft on approval); decide whether to pursue MPI-M Incubator as MSCA/Humboldt host.

## 12 Jul 2026 — RAG re-run (Apify)

**NEW ≥7.0:** ICTP Trieste ESP postdoc, ML climate downscaling (Copernicus C3S, 2 posts) — 7.30. Appended to shortlist. **Deadline 18 Jul → Rule 5 target 14–15 Jul.** Apply: https://www.ictp.it/opportunity/earth-system-physics-postdoctoral-fellowships-2026 (announcement: https://www.ictp.it/news/2026/6/four-climate-postdoc-positions-available)

**Also appended (strategic, 6.80):** ICTP CLOSER extremes-attribution pair — same portal and deadline.

**Scored, not appended:** Columbia Lamont PDRS (radiation–circulation) 6.00, open until filled: https://academic.careers.columbia.edu/#!/183751

**Source added to Section 0:** GEWEX position announcements (https://www.gewex.org/resources/position-announcements/) — confirmed TU Delft EuRadCA (submitted) listing; Oslo ACTIVATE and ISSM Lipari school deadlines already passed.

**Priority conflict flagged:** ICTP application (by 14–15 Jul) vs 13 Jul Gothenburg-push session — needs a call on sequencing. CV Europe version (no photo) required for ICTP; pending items per Section 6: Google Scholar profile, Sen Gupta referee confirmation.

## 14 Jul 2026 — 5-day scan (Claude Code)

**Environment limitation (honest note):** this run was on Claude Code web, whose
network policy blocks all outbound web fetching (proxy refuses CONNECT to
jobs.ac.uk, EURAXESS, Nature, academicpositions, GEWEX, AGU with a policy 403;
WebFetch fails on every host). Only keyword search was available — it returns
titles and URLs but no openable pages, so no posting could be verified against
the rubric. **No new openings were scored or appended** (scoring from
unverifiable snippets would break the "verify per posting" rule and Rule 2). The
live board browse needs the Cowork environment (Apify RAG browser) or a widened
egress policy. Sections below are the parts completable offline.

**Deadline audit (today 14 Jul, flag ≤10 days):**
- ICTP ESP C3S 7.30 — closes 18 Jul (4 d). **Rule-5 target 14–15 Jul = now.** Prereqs still open (Europe CV, Google Scholar, Sen Gupta referee).
- ICTP ESP CLOSER 6.80 — closes 18 Jul (4 d), same portal (strategic).
- Penn State EESI 5.85 — 19 Jul (5 d) — below threshold, not pursued.
- GFZ GenAI4Earth 6.35 — 22 Jul (8 d) — below threshold, not pursued.
- MSCA-PF skeleton (track 8.05) — due 23 Jul (9 d) — deliverable.
- KIT/HITS 6.65 (decide 26 Jul / close 30 Jul) and Gothenburg 6.45 (submit 28 Jul / close 31 Jul) — just outside window.

**Unverified lead to check next scan:** 2-year postdoc on Asian summer monsoon
extreme precipitation over the Tibetan Plateau under warming (WRF + observations),
surfaced via search only; no citable posting/deadline captured — do not score
until the posting is opened and verified.

**ICTP C3S go/no-go checklist (submit by 15 Jul per Rule 5):**
1. Confirm the C3S post is still open on the ICTP portal (needs web — do first).
2. Compile the Europe CV (no photo) with the Section 6 tailoring patch.
3. Create the Google Scholar profile (quick; strengthens the application).
4. Get Sen Gupta referee confirmation (draft below); confirm Manoj + Shinto are ready.
5. Tailor the cover letter / research statement to ML climate downscaling (Copernicus C3S).
6. Register on the portal, upload, and submit by 15 Jul.

---

### Drafted emails (DRAFTS — not sent; Rona approves before anything leaves)

**Draft 1 — Sen Gupta referee confirmation (unblocks ICTP)**

Subject: Request to confirm you as a referee for my postdoc applications

Dear Professor Sen Gupta,

I hope you are well. I am in the final year of my PhD in tropical meteorology at
ACARR, CUSAT, working on monsoon onset dynamics, intraseasonal variability, and
machine learning prediction.

I am starting my postdoc applications this cycle. May I list you as a referee.
A few applications have short deadlines, the first this week, so a brief
confirmation would help me a lot.

If it is useful, I can send my current CV and a short summary of each application.
Thank you for considering this.

With gratitude,
Rona Maria Sunil
[phone] · [email] · [ORCID]

**Draft 2 — Birmingham HEPPI-ML PI (speculative outreach)**

*Named contacts found 17 Aug 2026: Dr. Martin Widmann (m.widmann@bham.ac.uk) and
Dr. Nadezhda Mamontova (n.mamontova@bham.ac.uk), listed on the HEPPI-ML posting
(jobs.ac.uk DQU681). This was the placeholder blocking this draft — ready to send
to either or both once Rona picks a name.*

Subject: Postdoc collaboration on monsoon precipitation post-processing with ML

Dear Dr Widmann / Dr Mamontova,

I am writing with interest in the HEPPI-ML work on heavy precipitation forecast
post-processing over India within WCSSP India. My PhD research is a close match to
this theme.

I work on Indian monsoon prediction using deep learning. My GRU-LSTM system
predicted the 2026 monsoon onset in real time, verified within one day of the IMD
date, with a hindcast MAE of 4.3 days over 2019 to 2026 and no false alarms. I
also work with VHF radar observations and intraseasonal variability, including
BSISO.

I understand the advertised posts have closed. I wanted to ask if you expect
further openings, or whether you would consider hosting a fellowship application.
I can bring portable funding routes such as the MSCA Postdoctoral Fellowship or
Humboldt, and I would value the chance to contribute to HEPPI-ML.

I have attached my CV. Thank you for your time.

Best wishes,
Rona Maria Sunil

**Draft 3 — IAP-CAS spouse work-rights query (Rule 2; to HR, before any PI outreach)**

Subject: Query on accompanying spouse work rights for a postdoctoral appointment

Dear Sir or Madam,

I am considering applying for a postdoctoral position at the Institute of
Atmospheric Physics. Before I proceed, I would like to understand the visa terms
for my family.

If I take up a postdoc appointment, my spouse would relocate with me. Could you
tell me whether an accompanying spouse on a dependent visa is permitted to work in
China, and under what conditions. Any pointer to the relevant policy would be very
helpful.

Thank you for your assistance.

Kind regards,
Rona Maria Sunil

**Actions pending Rona's approval:** fill the bracketed details (referee title,
Birmingham PI name, contact block), then send drafts 1 and 3 today; hold draft 2
until the CV is compiled. Verify ICTP portal status and decide go/no-go on C3S.

## 16 Jul 2026 — CV sync + weekly automation (Claude Code)

**CV audit (uploaded master CV vs the Section 6 tailoring patch):** patch not yet
applied. Still open: "Tropica Jet Streams" typo (Skills); ORCID missing from header;
no Research Highlights block; publications not split first-author/co-author (DOI only
on Atmos. Res. 2023); FERCC + ANRF awards absent; no "First Class with Distinction";
referees still Manoj + Shinto Mathew only — Sen Gupta not yet added (the 14 Jul
confirmation draft still unsent). Google Scholar and compiled Europe/Japan PDFs also
pending. The CV itself was deliberately NOT committed to the repo — it carries personal
contact details, and the repo's files are publicly served by the Vercel deployment.

**Spec updates:** Section 1 snapshot enriched with CV-verified facts (INSPIRE SRF
IF190594, supervisor, thesis title, publication specifics + DOI, prize amounts
$500/$1,000, EGU + AOGS memberships, toolkit, India conference network). Section 6
"pending" list replaced with the concrete 16 Jul audit. Section 8 notes the new
automation cadence.

**Automation armed:** weekly Claude Code Routine, Mondays 9:00 IST. Standing rules for
automated runs (approved by Abins, 16 Jul): deadline audit + LOG/META refresh +
UNVERIFIED lead surfacing via keyword search only; never scores openings or appends to
the Section 5 shortlist; commits and pushes so the dashboard redeploys.

**Deadline flags (today 16 Jul):** ICTP ESP C3S closes 18 Jul (2 days) — the Rule-5
target (14–15 Jul) has passed; final go/no-go needed immediately. MSCA-PF skeleton due
23 Jul (7 days). Penn State 19 Jul and GFZ 22 Jul below threshold (not pursued).

## 21 Jul 2026 — data refresh (Claude Code)

**State advanced against today (21 Jul):** ICTP ESP C3S and CLOSER (18 Jul) and Penn
State EESI (19 Jul) have **closed** — statuses updated on the dashboard; kept in the
list as history, none were submitted. GFZ GenAI4Earth closes 22 Jul (below threshold).
Live/actionable now: **MSCA-PF skeleton due 23 Jul (2 days)**, KIT/HITS decision ~26 Jul
(closes 30 Jul), Gothenburg submit target 28 Jul (closes 31 Jul), AOGS Fukuoka 1–7 Aug.

**New lead (UNVERIFIED):** *UChicago — Project Cirrus* (Profs. Hassanzadeh, Shaw, Jina;
Boos at UC Berkeley) — AI weather forecasting for the tropics / S2S, explicitly built on
their Indian-monsoon-onset AI that was disseminated to ~38M farmers via India's Ministry
of Agriculture. ~9/10 fit for the profile. The advertised cohort reviewed on a rolling
basis **until 15 Jan 2026 (start before 1 Mar 2026)** — that window has passed, so it is a
**watch / speculative-outreach** target for the next round, not a live application. Added
to Section 5 as a lead only (score null); NOT scored or shortlisted.

**Also surfaced, parked as generic leads to verify:** a 2-yr postdoc on Asian-summer-
monsoon extreme precipitation over the Tibetan Plateau (WRF); ECMWF ML-weather roles;
a EURAXESS "machine learning for climate predictions" post. No citable live deadlines
captured — verify on portal before scoring.

**Method note:** WebFetch to job boards remains blocked by this environment's egress
policy, so this refresh used WebSearch only. Per standing rules, no opening was scored or
appended to the Section 5 shortlist; leads are flagged UNVERIFIED with their URLs.

**Still pending from prior runs:** ICTP was not submitted (window closed); Sen Gupta
referee confirmation, the CV tailoring patch, and Google Scholar remain open.

## 28 Jul 2026 — weekly scan (Claude Code + research subagent)

**Deadline audit (today 28 Jul):**
- MSCA-PF skeleton (due 23 Jul) has **passed** — status advanced to "skeleton done, drafting toward the 10 Sep submit."
- KIT/HITS ML calibration 6.65 — **closes 30 Jul (2 days)**; the "decide by 26 Jul" note is stale, so this is the final safety-net decision point now.
- Gothenburg PAR 2026/530 6.45 — **submit target is TODAY (28 Jul)**; portal closes 31 Jul (Rule 5: land it today, not on the 31st).
- ETH Zurich (host contact by 27 Aug / cycle ~1 Sep) and MSCA-PF (submit ~10 Sep) remain the next live deliverables.
- ICTP C3S & CLOSER (18 Jul), Penn State (19 Jul), GFZ (22 Jul) remain **closed** — kept as history, none submitted.
- Next scan after **AOGS Fukuoka 1–7 Aug** (JSPS host scouting there); META.nextScan set to 2026-08-04.

**Live board sweep (research subagent, WebSearch only — WebFetch still egress-blocked, so all UNVERIFIED):**
- **Added as leads (score null, not shortlisted):**
  - *Argonne National Laboratory — ML for Weather & Climate (Stormer → S2S)* — strong fit (S2S + ML weather + calibrated ensembles ↔ her GRU-LSTM/S2S profile). Careers portal: https://argonne.wd1.myworkdayjobs.com/en-US/Argonne_Careers — verify openness + deadline (spouse work = J-2 EAD; confirm monsoon relevance).
  - *National University of Singapore — Research Fellow, ML for Hydro-Meteorology* — medium/strong (physics-informed ML for convective rainfall, tropical, strong spouse work rights). https://careers.nus.edu.sg/ — verify openness + deadline.
- **Noted, not added:** Oxford "Predictability of Weather & Climate" group (potential S2S host — https://www.physics.ox.ac.uk/research/group/predictability-weather-and-climate/current-job-vacancies, no live ad visible); Argonne Convective Storms / Land-atmosphere extremes (medium/weak); an ICTP "Climate Dynamics / Ocean-Atmosphere" listing distinct from the closed ESP posts (no confirmable open deadline).
- **Tracked items — no change confirmable:** UChicago Project Cirrus still listed (no new cohort/deadline visible); Birmingham/WCSSP-India — no fresh vacancy this week.

**Method note:** subagent ran 8 WebSearches across EURAXESS/jobs.ac.uk/AGU/Nature/GEWEX/academicpositions; titles+snippets+URLs only, no posting pages openable. Per standing rules nothing was scored or appended to the Section 5 shortlist; leads flagged UNVERIFIED with their URLs for manual verification.

### Live "Refresh" run — done internally (28 Jul)

**Why internal:** the dashboard's Refresh button POSTs to `/api/refresh`, which returns **501 (not_configured)** until an `ANTHROPIC_API_KEY` or `NVIDIA_API_KEY` is set in the Vercel project. I also cannot call the live endpoint from this session — the agent proxy denies CONNECT to `postdoc-engine.vercel.app` (403), and there is no API key in this environment to run `api/refresh.js` locally (verified: the handler correctly returns the 501 fallback). So I ran the scan the button *would* run, myself, via WebSearch.

**New currently-open find (added as a lead):**
- *NTU Ocean Center, National Taiwan University (Taiwan)* — "Postdoctoral Research (or Higher-Level) Opportunity in Data Assimilation and AI-enhanced S2S forecast", with the Central Weather Administration, on the in-house GEPSv3 coupled ocean–atmosphere system. **Open until filled.** Apply: email CV + publication list to Prof. Yu-heng Tseng (tsengyh@ntu.edu.tw), subject "Postdoc Application-DA & AI S2S forecast". Listing: https://www.egu.eu/jobs/7871/ — **strong fit** (AI S2S / DA ↔ her ML-onset + MJO/BSISO work). Confirmed across two independent search results; spouse work rights unverified → Rule 2 before outreach.

**Seen, not added:** MIT/Caltech CliMA postdoc (GPU climate model, Julia — ocean component, weak fit); UW College of the Environment "ML for Extreme Weather Events" (medium); Oxford "Predictability of Weather & Climate" vacancies (medium, potential host); the recurring Tibetan-Plateau monsoon-extreme-precip WRF post (no citable deadline).

**Re-confirmed closed:** ICTP ESP C3S (18 Jul); TU Delft EuRadCA (30 Jun, already submitted); UChicago Project Cirrus (rolling to 1 Jan 2026).

**To make the on-site button live:** set `ANTHROPIC_API_KEY` (best — its web_search runs on Anthropic's infra, which this env's proxy actually allows) or a free `NVIDIA_API_KEY` (inference-only → returns groups to verify) in Vercel → Settings → Environment Variables, then redeploy. WebFetch to job boards remains blocked here, so all leads stay UNVERIFIED until opened on their portals.

## 10 Aug 2026 — data update (Claude Code)

**Board re-synced to today (10 Aug); prior updates had drifted on a stale 28 Jul anchor — corrected.**

**Deadline audit (today 10 Aug):**
- KIT/HITS 6.65 — **closed 30 Jul**; safety net lapsed, not pursued.
- Gothenburg PAR 2026/530 6.45 — **closed 31 Jul**; marked submitted.
- AOGS Fukuoka (1–7 Aug) — **past**; JSPS host scouting done there.
- Live deliverables now: ETH Zurich (host contact by 27 Aug, closes 1 Sep); MSCA-PF (submit ~6 Sep, closes 10 Sep); Exeter NATALIE closes 20 Aug (10 days — below threshold, not pursued).

**WebSearch sweep:** no new scored openings. Re-confirmed the open leads — NTU Ocean Center S2S (still open until filled); UChicago now also lists a second "AI weather forecasting across scales" (CeTD / Hassanzadeh) S2S call at https://geosci.uchicago.edu/postdoctoral-scholar-ai-weather-forecasting-across-scales/ alongside the closed Project Cirrus cohort — noted on the Cirrus lead. Re-confirmed closed: ICTP ESP C3S/CLOSER (18 Jul). WebFetch still egress-blocked; leads remain UNVERIFIED. META.nextScan → 17 Aug.

## 17 Aug 2026 — weekly scan (Claude Code)

**Deadline audit (today 17 Aug):** Exeter NATALIE now closes in 3 days (20 Aug) —
still below threshold, not pursued. ETH host contact due in 10 days (27 Aug).
MSCA-PF submit target ~6 Sep (closes 10 Sep) remains the next live deliverable.

**Notable find:** the Birmingham HEPPI-ML posting is indexed again on jobs.ac.uk
(job IDs DQT515 / DQU681), but the listing references a Nov/Dec 2025 start date —
this is the same already-expired ad re-surfacing in search, **not** a fresh
reopening. It did surface two named PI contacts for the first time: **Dr. Martin
Widmann** (m.widmann@bham.ac.uk) and **Dr. Nadezhda Mamontova**
(n.mamontova@bham.ac.uk). Draft 2 above has been updated with these names —
this was the one placeholder blocking it since 14 Jul. Dashboard entry link
updated from the generic jobs.ac.uk homepage to the specific listing.

**Seen, not added:** Univ. of Leeds ML-for-agroclimatic-adaptation (off-core —
agriculture, not monsoon/radar); Oxford AUSPICE postdoc (deadline passed 5 Jan
2026); Alan Turing Institute "AI for Weather Forecasting" Research Lead / Theme
Lead (senior/PI-level roles, closed 31 May — not postdoc-level).

**Method note:** WebSearch only; WebFetch to job boards remains blocked. No
opening scored or added to the Section 5 shortlist. META.nextScan → 24 Aug.

**Action ready for Rona's approval:** send Draft 2 to Dr. Widmann and/or
Dr. Mamontova now that both names are confirmed.
