# Postdoc Decision Engine — v2
**Owner:** Rona Maria Sunil, ACARR-CUSAT | **Updated:** 12 July 2026 | **Cycle:** review every 5 days

---

## 0. Instructions for Claude Cowork (read this first)

You are running Rona's 5-day postdoc scan. On every session:
1. Read this whole file. Sections 2 (rubric) and 7 (rules) govern all decisions.
2. Browse EURAXESS, AGU Careers, Nature Careers, jobs.ac.uk, academicpositions.eu, and
   GEWEX position announcements (https://www.gewex.org/resources/position-announcements/)
   for new postdoc openings matching: *monsoon, intraseasonal, BSISO, MJO, radar meteorology,
   QPE, precipitation, machine learning weather, tropical convection*.
   Tooling note: EURAXESS is JavaScript-only — plain fetches fail and URL keyword params are
   ignored. Use the Apify RAG web browser (search mode + rendering job pages); facet URLs
   (f[0]=job_research_field:ID) do work if the facet ID is known.
3. Score each new opening 0-10 on every Section 2 criterion; compute the weighted score.
4. Check every Section 4 deadline against today's date; flag anything within 10 days.
5. Show Rona the results BEFORE editing this file. After approval, append openings
   scoring ≥ 7.0 to the Section 5 table and log actions in applications_log.md.
   ALSO update index.html (the dashboard; served at the site root) on every run:
   edit only its DATA BLOCK (META, JOBS,
   MILESTONES, LOG arrays) — the page renders itself and computes countdowns live.
6. Draft (never send) any outreach emails due this session into applications_log.md.
   Email style: genuine, humble, concise, short sentences, no em dashes.

## 1. Candidate snapshot

- Final-year PhD, tropical meteorology: monsoon onset dynamics, BSISO/ISV, VHF radar, GRU-LSTM prediction. Thesis submission late 2026; postdoc start early-mid 2027.
- First-author: Atmospheric Research (2023), URSI Radio Science Letters (2025); under review: Climate Dynamics (Arabian Sea cyclones); imminent: npj Climate & Atmospheric Science (BSISO-Rossby nonlinearity); in prep: Atmospheric Research (TEJ regimes). Co-author: Theor. Appl. Climatology 2025, Climate Dynamics 2025.
- Signature result: GRU-LSTM system predicted the 2026 Indian monsoon onset in real time, verified within one day of the IMD date (hindcast MAE 4.3 days, 2019-2026, zero false alarms).
- Hands-on: world's first 205 MHz VHF ST wind-profiling radar (ACARR).
- Awards: URSI AP-RASC 2025 Student Paper Prize (Sydney), CARE-25 Best Paper, AGU 2024 Travel Grant, DST-INSPIRE Fellowship, FERCC Fellowship (2026), ANRF Travel Grant (2026).
- End goal (6-8 yr): Scientist position in India (IITM / ISRO / NCMRWF); return route via Ramanujan / Ramalingaswami / INSPIRE Faculty.
- Family: married (Abins, V-Guard Kerala); relocation decided per opportunity. Spouse visa WORK RIGHTS are a first-class criterion.

## 2. Scoring rubric (score each opening 0-10 per criterion)

| # | Criterion | Weight | What to check |
|---|-----------|--------|---------------|
| 1 | Family & financial stability | 30% | Net salary vs cost of living; realistic couple savings in ₹ (target ≥ ₹20 lakh/yr); spouse visa with work rights; family allowance; contract ≥ 2 yr |
| 2 | Research fit | 25% | Group's last 3 yrs of papers vs ISV/BSISO + radar + ML; is Rona's toolkit an asset from day 1? |
| 3 | India-return value | 20% | Brand weight at IITM/ISRO/MoES boards; alumni who returned to Indian scientist posts; India collaborations |
| 4 | Institution prestige | 15% | Field-specific reputation over general rankings |
| 5 | Permanence pathway | 10% | Secondary; permanence plan is India |

**Weighted score = Σ(score × weight)/10. Shortlist threshold: ≥ 7.0**

## 3. Financial reality map (approximate — verify per posting)

| Venue | Couple savings/yr | Spouse work rights | Note |
|-------|-------------------|--------------------|------|
| Switzerland (ETH/EPFL) | ₹30-45 L | Yes | Highest academic savings tier |
| KAUST (Saudi) | ₹35-50 L | Dependent visa; campus jobs | Tax-free + housing; verify research fit |
| Singapore (CCRS/NUS/NTU) | ₹25-40 L | Yes (DP + pass) | Exceptional monsoon/ISV fit; 4 hr from Kochi |
| Netherlands (30% ruling / MSCA) | ₹18-28 L | Yes, full | MSCA adds family allowance |
| Germany (TV-L E13/14, MPI) | ₹15-25 L | Yes | Strong science |
| Scandinavia | ₹15-22 L | Yes | High stability |
| Japan (JSPS) | ₹12-20 L | Work needs permission | Prestige high; spouse work harder |
| China (CAS postdoc + talent top-ups) | ₹15-25 L (est.) | Unclear — Rule 2 HR query | Strong monsoon/ISV groups (IAP-CAS, NUIST); verify per posting |
| USA (university) | ₹10-20 L | J-2 EAD workable | Highest visa friction |
| Industry (DeepMind/Nvidia/MSFT) | ₹50 L+ | Strong support | Opportunistic applications |

## 4. Deadlines & milestones

| Date | Item | Status |
|------|------|--------|
| 31 Jul 2026 | Gothenburg PAR 2026/530 — SUBMIT (target: 28 Jul) | In progress |
| 1-7 Aug 2026 | AOGS Fukuoka — poster AS45-A005; JSPS host scouting; KEEP BOARDING PASSES | Registered |
| ~1 Sep 2026 | ETH Zurich fellowship cycle — host PI contacted by 27 Aug | Host TBD |
| ~10 Sep 2026 | MSCA-PF SUBMIT (verify exact date on EU portal; target: 6 Sep) | Skeleton due 23 Jul |
| Oct 2026 | Humboldt Fellowship draft/submit | Not started |
| ~5 Nov 2026 | ANRF travel claim: form + original boarding passes + Best Available Fare cert (courier by 16 Oct) | Certificate to request |
| Rolling | CCRS Singapore, KAUST — watch + expressions of interest | Watching |

## 5. Scored shortlist (append new rows below; never delete history)

| Opening | Stab(30) | Fit(25) | India(20) | Prestige(15) | Perm(10) | Weighted | Status |
|---------|----------|---------|-----------|--------------|----------|----------|--------|
| CCRS Singapore | 9 | 9 | 7 | 7 | 7 | 8.10 | Find contact |
| MSCA @ TU Delft (QPE×ISV) | 8 | 9 | 8 | 8 | 6 | 8.05 | Draft due |
| ETH Zurich fellowship | 9 | 7 | 8 | 9 | 6 | 7.80 | Host PI TBD |
| TU Delft EuRadCA (direct) | 7 | 9 | 8 | 8 | 6 | 7.75 | Submitted |
| JSPS Japan | 6 | 7 | 8 | 8 | 6 | 6.95 | Scout at AOGS |
| KAUST | 10 | 5 | 6 | 6 | 5 | 6.85 | Verify fit |
| Gothenburg PAR 2026/530 | 7 | 6 | 6 | 7 | 6 | 6.45 | Submitting |
| KIT/HITS Heidelberg — ML weather calibration (WOW project) | 6 | 7 | 7 | 8 | 5 | 6.65 | Safety net; closes 30 Jul 2026 |
| ICTP Trieste — ESP postdoc, ML climate downscaling (C3S, 2 posts) | 6 | 8 | 9 | 8 | 5 | 7.30 | URGENT — closes 18 Jul; submit by 14-15 Jul |
| ICTP Trieste — ESP postdoc, extremes attribution (CLOSER, 2 posts) | 6 | 6 | 9 | 8 | 5 | 6.80 | Same portal/deadline as C3S; strategic |

**Leads to track (12 Jul 2026 scan — not live openings):**
- *Birmingham HEPPI-ML* (Heavy Precipitation forecast Post-processing over India with ML, WCSSP India): both adverts expired, but ~9/10 research fit — draft speculative outreach email to the PI.
- *MPI-M Hamburg Incubator Program*: funded 2 wk–3 mo stay (€2,500/mo) to write MSCA-PF or Humboldt proposal with an MPI-M host; apply with 1-page idea + CV to a group leader (tropical/wave-driven circulation groups fit BSISO). Directly serves MSCA skeleton (23 Jul) and Humboldt (Oct) tracks.
- *Kyoto Univ. RISH — Radar Atmospheric Science Lab*: prime JSPS host target (MU radar = sister VHF ST instrument to ACARR). Scout at AOGS 1–7 Aug.
- *IAP-CAS Beijing — Monsoon/ISV group (Prof. Lin Wang)*: group states postdoc openings, contact PI directly (https://sforest81.github.io/en/). Spouse work rights in China unverified → Rule 2 HR query first.
- Scan notes 12 Jul: also scored GFZ GenAI4Earth 6.35 (closes 22 Jul), Penn State EESI PCHES-ADAPT 5.85 (closes 19 Jul), Exeter NATALIE 5.40 (closes 20 Aug) — all below threshold, not appended. MPI-M "Cloud Wave Coupling W079" on EURAXESS is a stale 2021 post.

## 6. CV status

Master CV: LaTeX curve class. Tailoring patch (CV_final_tailor_patch.md) applies 10 fixes:
typos, ORCID in header, Research Highlights block (lead with 2026 onset verification),
SRF achievement bullets, "First Class with Distinction" on both degrees, publications
split first-author/co-author with DOIs, add FERCC + ANRF awards, referees reordered
(Manoj → Sen Gupta → Shinto Mathew), photo toggle (photo for Japan, none for Europe),
Python stack spelled out. Pending: Google Scholar profile creation; Sen Gupta referee
confirmation email; compiled Europe + Japan PDF versions.

## 7. Standing decision rules

1. Nothing below 7.0 weighted gets application time unless it is a strategic safety net.
2. Spouse work rights unclear → draft an HR query email; never assume.
3. Every application must serve the India-return story.
4. Fellowship (portable money) beats project position when scores tie.
5. All submissions land 3-4 days before their deadline — never on deadline day.
6. Cowork drafts emails and edits; Rona approves everything before it leaves the machine.

## 8. Cowork session map (synced to Google Calendar, every 5 days, 9:00 IST)

Jul 13 Gothenburg push + Sen Gupta email + CV quick fixes · Jul 18 CV highlights + Google
Scholar · Jul 23 MSCA skeleton · Jul 28 SUBMIT Gothenburg + AOGS prep · Aug 2 & 7 (AOGS)
mobile check-ins only · Aug 12 follow-up emails + ANRF paperwork · Aug 17 MSCA draft v1 ·
Aug 22 MSCA revision · Aug 27 MSCA v2 + ETH host contact · Sep 1 ETH cycle + MSCA polish ·
Sep 6 MSCA final · Sep 11 retro + Humboldt/CCRS/KAUST track · Sep 16-Oct 31 Humboldt,
outreach, ANRF claim (courier by Oct 16), thesis balance.
