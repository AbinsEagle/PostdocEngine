import type {
  Application,
  Enums,
  Position,
  Recommendation,
  ResearchItem,
  Researcher,
} from "./types";

// Same-origin by default; the Vite dev server proxies /api to the backend.
const BASE = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Meta
  enums: () => request<Enums>("/api/meta/enums"),

  // Researchers
  listResearchers: () => request<Researcher[]>("/api/researchers"),
  getResearcher: (id: number) => request<Researcher>(`/api/researchers/${id}`),
  createResearcher: (data: Partial<Researcher>) =>
    request<Researcher>("/api/researchers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateResearcher: (id: number, data: Partial<Researcher>) =>
    request<Researcher>(`/api/researchers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Positions
  listPositions: (params: { q?: string; field?: string; location?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][]
    ).toString();
    return request<Position[]>(`/api/positions${qs ? `?${qs}` : ""}`);
  },
  createPosition: (data: Partial<Position>) =>
    request<Position>("/api/positions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Applications
  listApplications: (researcherId: number, status?: string) => {
    const qs = new URLSearchParams({ researcher_id: String(researcherId) });
    if (status) qs.set("status", status);
    return request<Application[]>(`/api/applications?${qs.toString()}`);
  },
  createApplication: (data: Partial<Application>) =>
    request<Application>("/api/applications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateApplication: (id: number, data: Partial<Application>) =>
    request<Application>(`/api/applications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteApplication: (id: number) =>
    request<void>(`/api/applications/${id}`, { method: "DELETE" }),

  // Research items
  listResearch: (researcherId: number) =>
    request<ResearchItem[]>(`/api/research?researcher_id=${researcherId}`),
  createResearch: (data: Partial<ResearchItem>) =>
    request<ResearchItem>("/api/research", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateResearch: (id: number, data: Partial<ResearchItem>) =>
    request<ResearchItem>(`/api/research/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteResearch: (id: number) =>
    request<void>(`/api/research/${id}`, { method: "DELETE" }),

  // Recommendations
  recommendations: (researcherId: number, limit = 10) =>
    request<Recommendation[]>(
      `/api/recommendations/${researcherId}?limit=${limit}`
    ),
};
