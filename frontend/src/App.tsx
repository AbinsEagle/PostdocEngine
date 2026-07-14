import { createContext, useContext, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { api } from "./api";
import Layout from "./components/Layout";
import Applications from "./pages/Applications";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Profile from "./pages/Profile";
import Research from "./pages/Research";
import type { Researcher } from "./types";

interface AppContextValue {
  researcher: Researcher | null;
  researchers: Researcher[];
  setResearcherId: (id: number) => void;
  refreshResearcher: () => Promise<void>;
  reloadResearchers: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// Convenience hook; throws if used outside the provider so mistakes surface early.
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContext");
  return ctx;
}

export default function App() {
  const [researchers, setResearchers] = useState<Researcher[]>([]);
  const [researcher, setResearcher] = useState<Researcher | null>(null);

  async function reloadResearchers() {
    const list = await api.listResearchers();
    setResearchers(list);
    // Default to the first researcher if none is selected yet.
    setResearcher((current) => current ?? list[0] ?? null);
  }

  async function setResearcherId(id: number) {
    const r = await api.getResearcher(id);
    setResearcher(r);
  }

  async function refreshResearcher() {
    if (researcher) setResearcher(await api.getResearcher(researcher.id));
  }

  useEffect(() => {
    reloadResearchers();
  }, []);

  return (
    <AppContext.Provider
      value={{
        researcher,
        researchers,
        setResearcherId,
        refreshResearcher,
        reloadResearchers,
      }}
    >
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/research" element={<Research />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
    </AppContext.Provider>
  );
}
