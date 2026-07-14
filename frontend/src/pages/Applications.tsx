import { useEffect, useState } from "react";
import { useApp } from "../App";
import { api } from "../api";
import type { Application, Enums } from "../types";

export default function Applications() {
  const { researcher } = useApp();
  const [apps, setApps] = useState<Application[]>([]);
  const [enums, setEnums] = useState<Enums | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!researcher) return;
    setLoading(true);
    const [a, e] = await Promise.all([api.listApplications(researcher.id), api.enums()]);
    setApps(a);
    setEnums(e);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researcher]);

  async function update(id: number, patch: Partial<Application>) {
    const updated = await api.updateApplication(id, patch);
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
  }

  async function remove(id: number) {
    await api.deleteApplication(id);
    setApps((prev) => prev.filter((a) => a.id !== id));
  }

  if (!researcher) return <p className="muted">Select a researcher first.</p>;

  const statuses = enums?.application_statuses ?? [];
  const grouped = statuses.map((s) => ({ status: s, items: apps.filter((a) => a.status === s) }));

  return (
    <div>
      <header className="page-header">
        <h1>Application Tracker</h1>
        <p className="muted">
          {apps.length} tracked position{apps.length === 1 ? "" : "s"} across your pipeline.
        </p>
      </header>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : apps.length === 0 ? (
        <div className="card">
          <p className="muted">No applications yet. Track positions from the Find Jobs page.</p>
        </div>
      ) : (
        <div className="board">
          {grouped
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.status} className="board-col">
                <h3 className="col-head">
                  {g.status} <span className="count">{g.items.length}</span>
                </h3>
                {g.items.map((a) => (
                  <AppCard
                    key={a.id}
                    app={a}
                    statuses={statuses}
                    onUpdate={(patch) => update(a.id, patch)}
                    onDelete={() => remove(a.id)}
                  />
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function AppCard({
  app,
  statuses,
  onUpdate,
  onDelete,
}: {
  app: Application;
  statuses: string[];
  onUpdate: (patch: Partial<Application>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(app.notes);
  const [nextAction, setNextAction] = useState(app.next_action);
  const [nextDate, setNextDate] = useState(app.next_action_date ?? "");

  return (
    <div className="card app-card">
      <div className="app-card-head" onClick={() => setExpanded((v) => !v)}>
        <strong>{app.position?.title ?? `Position #${app.position_id}`}</strong>
        <div className="muted small">{app.position?.institution}</div>
      </div>

      <select
        value={app.status}
        onChange={(e) => onUpdate({ status: e.target.value })}
        className={`status-select status-${app.status}`}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {app.next_action && !expanded && (
        <div className="small next">→ {app.next_action} {app.next_action_date && `(${app.next_action_date})`}</div>
      )}

      {expanded && (
        <div className="app-detail">
          <label className="field-label">Next action</label>
          <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          <label className="field-label">Next action date</label>
          <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          <label className="field-label">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          <div className="row-gap">
            <button
              className="btn small"
              onClick={() =>
                onUpdate({
                  notes,
                  next_action: nextAction,
                  next_action_date: nextDate || null,
                })
              }
            >
              Save
            </button>
            <button className="btn small danger" onClick={onDelete}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
