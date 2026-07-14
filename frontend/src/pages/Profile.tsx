import { useEffect, useState } from "react";
import { useApp } from "../App";
import { api } from "../api";
import type { Researcher } from "../types";

export default function Profile() {
  const { researcher, refreshResearcher, reloadResearchers, setResearcherId } = useApp();
  const [form, setForm] = useState<Partial<Researcher>>({});
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", email: "", field: "", keywords: "" });

  useEffect(() => {
    if (researcher) setForm(researcher);
  }, [researcher]);

  async function save() {
    if (!researcher) return;
    try {
      await api.updateResearcher(researcher.id, {
        name: form.name,
        email: form.email,
        field: form.field,
        institution: form.institution,
        keywords: form.keywords,
        bio: form.bio,
      });
      await refreshResearcher();
      await reloadResearchers();
      setMessage("Profile saved.");
      setTimeout(() => setMessage(""), 2500);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function createResearcher() {
    try {
      const r = await api.createResearcher(newForm);
      await reloadResearchers();
      await setResearcherId(r.id);
      setCreating(false);
      setNewForm({ name: "", email: "", field: "", keywords: "" });
      setMessage("New researcher created.");
      setTimeout(() => setMessage(""), 2500);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <div>
      <header className="page-header">
        <div className="header-row">
          <div>
            <h1>Profile</h1>
            <p className="muted">Your interests power the match engine. Keep keywords sharp.</p>
          </div>
          <button className="btn secondary" onClick={() => setCreating((v) => !v)}>
            {creating ? "Cancel" : "+ New researcher"}
          </button>
        </div>
      </header>

      {message && <div className="banner">{message}</div>}

      {creating && (
        <div className="card form-card">
          <h2>Create researcher</h2>
          <div className="form-grid">
            <div><label className="field-label">Name</label>
              <input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} /></div>
            <div><label className="field-label">Email</label>
              <input value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} /></div>
            <div><label className="field-label">Field</label>
              <input value={newForm.field} onChange={(e) => setNewForm({ ...newForm, field: e.target.value })} /></div>
            <div className="full"><label className="field-label">Keywords (comma-separated)</label>
              <input value={newForm.keywords} onChange={(e) => setNewForm({ ...newForm, keywords: e.target.value })} /></div>
          </div>
          <button className="btn" onClick={createResearcher}>Create</button>
        </div>
      )}

      {researcher ? (
        <div className="card form-card">
          <div className="form-grid">
            <div>
              <label className="field-label">Name</label>
              <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Field</label>
              <input value={form.field ?? ""} onChange={(e) => setForm({ ...form, field: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Institution</label>
              <input value={form.institution ?? ""} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
            </div>
            <div className="full">
              <label className="field-label">Research keywords (comma-separated)</label>
              <input
                value={form.keywords ?? ""}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="machine learning, nlp, transformers"
              />
              <div className="hint">These drive your job matches — be specific.</div>
            </div>
            <div className="full">
              <label className="field-label">Bio</label>
              <textarea value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
            </div>
          </div>
          <button className="btn" onClick={save}>Save profile</button>
        </div>
      ) : (
        <div className="card"><p className="muted">No researcher selected. Create one to get started.</p></div>
      )}
    </div>
  );
}
