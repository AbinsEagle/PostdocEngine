# PostdocEngine — Postdoc Decision Engine

A personal, spec-driven system that helps **Rona Maria Sunil** (ACARR-CUSAT,
tropical meteorology) run a disciplined postdoc search on a 5-day scan cycle.
It is operated collaboratively with Claude: Claude scans job boards, scores
openings against a fixed rubric, tracks deadlines, and drafts outreach — Rona
approves everything before it leaves the machine.

## Files

| File | Role |
|------|------|
| `postdoc_decision_engine_v2.md` | **The spec.** Candidate snapshot, scoring rubric (Section 2), financial map, deadlines, scored shortlist (Section 5), and the standing decision rules (Section 7). Section 0 is the operating procedure for each scan. |
| `index.html` | **The dashboard.** A self-contained page (Naukri-style job portal) that renders openings, scores, live deadline countdowns, milestones, and the scan log. Named `index.html` so it serves at the site root on any static host with no config. Only its `DATA BLOCK` (META, JOBS, MILESTONES, LOG arrays) is edited each run — the page computes everything else itself. Open it in any browser. |
| `applications_log.md` | **The log.** Append-only record of each scan: boards checked, openings scored, leads, discards, deadlines flagged, and drafted emails. |

## How a scan works (Section 0 summary)

1. Read `postdoc_decision_engine_v2.md` in full — Sections 2 (rubric) and 7 (rules) govern all decisions.
2. Browse EURAXESS, AGU Careers, Nature Careers, jobs.ac.uk, academicpositions.eu, and GEWEX for new openings matching: *monsoon, intraseasonal, BSISO, MJO, radar meteorology, QPE, precipitation, machine-learning weather, tropical convection*.
3. Score each new opening 0–10 on every rubric criterion; compute the weighted score (threshold **≥ 7.0**).
4. Check every Section 4 deadline against today; flag anything within 10 days.
5. **Show Rona the results before editing any file.** After approval: append openings ≥ 7.0 to Section 5, update the `index.html` data block, and log the run in `applications_log.md`.
6. Draft (never send) any outreach emails due this session into `applications_log.md`.

## Scoring rubric (weights)

Family & financial stability **30%** · Research fit **25%** · India-return value **20%** ·
Institution prestige **15%** · Permanence pathway **10%**. Weighted score = Σ(score × weight)/10.

## Standing rules

Nothing below 7.0 gets application time unless it is a strategic safety net · spouse
work rights are never assumed (draft an HR query instead) · every application serves the
India-return story · a portable fellowship beats a project position on ties · all
submissions land 3–4 days before the deadline · Rona approves everything before it is sent.
