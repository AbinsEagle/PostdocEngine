import { useEffect, useState } from "react";
import { useApp } from "../App";
import { api } from "../api";
import type { Position, Recommendation } from "../types";

export default function Jobs() {
  const { researcher } = useApp();
  const [tab, setTab] = useState<"matches" | "browse">("matches");
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [q, setQ] = useState("");
  const [field, setField] = useState("");
  const [tracked, setTracked] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");

  async function loadTracked() {
    if (!researcher) return;
    const apps = await api.listApplications(researcher.id);
    setTracked(new Set(apps.map((a) => a.position_id)));
  }

  async function loadMatches() {
    if (!researcher) return;
    setRecs(await api.recommendations(researcher.id, 20));
  }

  async function search() {
    setPositions(await api.listPositions({ q, field }));
  }

  useEffect(() => {
    loadMatches();
    loadTracked();
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researcher]);

  async function track(positionId: number) {
    if (!researcher) return;
    try {
      await api.createApplication({
        researcher_id: researcher.id,
        position_id: positionId,
        status: "interested",
      });
      setTracked((prev) => new Set(prev).add(positionId));
      setMessage("Added to your applications.");
      setTimeout(() => setMessage(""), 2500);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1>Find Postdoc Positions</h1>
        <p className="muted">Ranked matches from your profile, or search the full board.</p>
      </header>

      {message && <div className="banner">{message}</div>}

      <div className="tabs">
        <button className={tab === "matches" ? "tab active" : "tab"} onClick={() => setTab("matches")}>
          Best matches
        </button>
        <button className={tab === "browse" ? "tab active" : "tab"} onClick={() => setTab("browse")}>
          Browse all
        </button>
      </div>

      {tab === "matches" ? (
        <div className="job-list">
          {recs.length === 0 && <p className="muted">No matches — add keywords in Profile.</p>}
          {recs.map((r) => (
            <PositionCard
              key={r.position.id}
              position={r.position}
              score={r.score}
              reason={r.reason}
              matched={r.matched_keywords}
              tracked={tracked.has(r.position.id)}
              onTrack={() => track(r.position.id)}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="search-bar">
            <input
              placeholder="Search title, institution, keywords…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <input
              placeholder="Field (e.g. Physics)"
              value={field}
              onChange={(e) => setField(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button className="btn" onClick={search}>Search</button>
          </div>
          <div className="job-list">
            {positions.length === 0 && <p className="muted">No positions found.</p>}
            {positions.map((p) => (
              <PositionCard
                key={p.id}
                position={p}
                tracked={tracked.has(p.id)}
                onTrack={() => track(p.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PositionCard({
  position,
  score,
  reason,
  matched,
  tracked,
  onTrack,
}: {
  position: Position;
  score?: number;
  reason?: string;
  matched?: string[];
  tracked: boolean;
  onTrack: () => void;
}) {
  const salary =
    position.salary_min && position.salary_max
      ? `$${position.salary_min.toLocaleString()}–${position.salary_max.toLocaleString()}`
      : null;
  return (
    <div className="card job-card">
      <div className="job-main">
        <div className="job-title-row">
          <h3>{position.title}</h3>
          {score !== undefined && <span className="score">{Math.round(score * 100)}% match</span>}
        </div>
        <div className="muted">
          {position.institution} · {position.location || "Location N/A"}
        </div>
        <p className="small">{position.description}</p>
        {reason && <div className="reason">✦ {reason}</div>}
        <div className="tag-row">
          {position.field && <span className="tag">{position.field}</span>}
          {(matched && matched.length
            ? matched
            : position.keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 4)
          ).map((k) => (
            <span key={k} className="tag subtle">{k}</span>
          ))}
        </div>
        <div className="job-meta">
          {salary && <span>{salary}/yr</span>}
          {position.deadline && <span>Deadline: {position.deadline}</span>}
          {position.source && <span>via {position.source}</span>}
        </div>
      </div>
      <div className="job-actions">
        <button className="btn" onClick={onTrack} disabled={tracked}>
          {tracked ? "Tracked ✓" : "Track"}
        </button>
      </div>
    </div>
  );
}
