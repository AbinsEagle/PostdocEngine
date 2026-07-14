import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useApp } from "../App";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/jobs", label: "Find Jobs" },
  { to: "/applications", label: "Applications" },
  { to: "/research", label: "Research" },
  { to: "/profile", label: "Profile" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { researcher, researchers, setResearcherId } = useApp();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◆</span> PostdocEngine
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <label className="field-label">Signed in as</label>
          <select
            value={researcher?.id ?? ""}
            onChange={(e) => setResearcherId(Number(e.target.value))}
          >
            {researchers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
