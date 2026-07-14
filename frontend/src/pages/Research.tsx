import { useEffect, useState } from "react";
import { useApp } from "../App";
import { api } from "../api";
import type { Enums, ResearchItem } from "../types";

const emptyForm = { title: "", type: "paper", status: "idea", url: "", notes: "" };

export default function Research() {
  const { researcher } = useApp();
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [enums, setEnums] = useState<Enums | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    if (!researcher) return;
    const [i, e] = await Promise.all([api.listResearch(researcher.id), api.enums()]);
    setItems(i);
    setEnums(e);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researcher]);

  async function create() {
    if (!researcher || !form.title.trim()) return;
    await api.createResearch({ researcher_id: researcher.id, ...form });
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  async function update(id: number, patch: Partial<ResearchItem>) {
    const updated = await api.updateResearch(id, patch);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
  }

  async function remove(id: number) {
    await api.deleteResearch(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  if (!researcher) return <p className="muted">Select a researcher first.</p>;

  const types = enums?.research_types ?? [];
  const statuses = enums?.research_statuses ?? [];

  return (
    <div>
      <header className="page-header">
        <div className="header-row">
          <div>
            <h1>Research Tracker</h1>
            <p className="muted">Papers, grants, experiments and notes in one place.</p>
          </div>
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New item"}
          </button>
        </div>
      </header>

      {showForm && (
        <div className="card form-card">
          <div className="form-grid">
            <div className="full">
              <label className="field-label">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. NeurIPS submission on graph transformers"
              />
            </div>
            <div>
              <label className="field-label">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="full">
              <label className="field-label">Link (optional)</label>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="full">
              <label className="field-label">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <button className="btn" onClick={create}>Add item</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card"><p className="muted">No research items yet.</p></div>
      ) : (
        <div className="research-list">
          {items.map((item) => (
            <div key={item.id} className="card research-item">
              <div className="research-main">
                <span className={`type-badge type-${item.type}`}>{item.type}</span>
                <div>
                  <strong>{item.title}</strong>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" className="link small"> ↗ link</a>
                  )}
                  {item.notes && <div className="muted small">{item.notes}</div>}
                </div>
              </div>
              <div className="research-actions">
                <select value={item.status} onChange={(e) => update(item.id, { status: e.target.value })}>
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="btn small danger" onClick={() => remove(item.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
