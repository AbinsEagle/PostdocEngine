import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../App";
import { api } from "../api";
import type { Application, Recommendation, ResearchItem } from "../types";

export default function Dashboard() {
  const { researcher } = useApp();
  const [apps, setApps] = useState<Application[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!researcher) return;
    setLoading(true);
    Promise.all([
      api.listApplications(researcher.id),
      api.recommendations(researcher.id, 3),
      api.listResearch(researcher.id),
    ])
      .then(([a, r, rs]) => {
        setApps(a);
        setRecs(r);
        setResearch(rs);
      })
      .finally(() => setLoading(false));
  }, [researcher]);

  if (!researcher) return <Empty />;

  const active = apps.filter(
    (a) => !["rejected", "declined", "accepted"].includes(a.status)
  );
  const upcoming = apps
    .filter((a) => a.next_action_date)
    .sort((a, b) => (a.next_action_date! < b.next_action_date! ? -1 : 1))
    .slice(0, 5);
  const activeResearch = research.filter((r) => r.status !== "done" && r.status !== "published");

  return (
    <div>
      <header className="page-header">
        <h1>Welcome back, {researcher.name.split(" ").slice(-1)[0] || researcher.name}</h1>
        <p className="muted">{researcher.field || "Set your field in Profile"} · {researcher.institution}</p>
      </header>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="stat-row">
            <Stat label="Active applications" value={active.length} to="/applications" />
            <Stat label="Top matches" value={recs.length} to="/jobs" />
            <Stat label="Research in progress" value={activeResearch.length} to="/research" />
            <Stat label="Total tracked" value={apps.length} to="/applications" />
          </div>

          <div className="dash-grid">
            <section className="card">
              <div className="card-head">
                <h2>Recommended for you</h2>
                <Link to="/jobs" className="link">View all</Link>
              </div>
              {recs.length === 0 ? (
                <p className="muted">No matches yet — add keywords to your profile.</p>
              ) : (
                recs.map((r) => (
                  <div key={r.position.id} className="mini-item">
                    <div>
                      <strong>{r.position.title}</strong>
                      <div className="muted small">{r.position.institution}</div>
                      <div className="small">{r.reason}</div>
                    </div>
                    <span className="score">{Math.round(r.score * 100)}%</span>
                  </div>
                ))
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Upcoming actions</h2>
                <Link to="/applications" className="link">Manage</Link>
              </div>
              {upcoming.length === 0 ? (
                <p className="muted">Nothing scheduled. Add next actions to your applications.</p>
              ) : (
                upcoming.map((a) => (
                  <div key={a.id} className="mini-item">
                    <div>
                      <strong>{a.next_action || "Follow up"}</strong>
                      <div className="muted small">{a.position?.title}</div>
                    </div>
                    <span className="date">{a.next_action_date}</span>
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </Link>
  );
}

function Empty() {
  return (
    <div className="card">
      <h2>No researcher profile yet</h2>
      <p className="muted">
        Create your profile to start tracking postdoc opportunities.
      </p>
      <Link to="/profile" className="btn">Go to Profile</Link>
    </div>
  );
}
