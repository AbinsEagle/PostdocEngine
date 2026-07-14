# PostdocEngine

A full-stack web app for early-career researchers that brings four things
into one place:

1. **Job finder** — browse and search a board of postdoc positions.
2. **Application tracker** — a Kanban-style pipeline (interested → applied →
   interview → offer → …) with notes and next-action reminders.
3. **Match / recommendation engine** — ranks positions against your research
   profile with an explainable keyword/field scoring model.
4. **Research productivity tool** — track papers, grants, experiments, and
   notes and their status.

## Stack

| Layer     | Tech                                                   |
|-----------|--------------------------------------------------------|
| Frontend  | React 18 + TypeScript + Vite + React Router            |
| Backend   | FastAPI + SQLAlchemy 2.0 (Pydantic v2)                 |
| Database  | SQLite by default; Postgres-ready via `DATABASE_URL`   |

```
PostdocEngine/
├── backend/          # FastAPI application
│   └── app/
│       ├── main.py           # app factory, startup, meta routes
│       ├── models.py         # SQLAlchemy models
│       ├── schemas.py        # Pydantic schemas
│       ├── matching.py       # recommendation engine
│       ├── seed.py           # sample data
│       └── routers/          # profile, positions, applications, research, recommendations
└── frontend/         # React + Vite SPA
    └── src/
        ├── api.ts            # typed API client
        ├── App.tsx           # routes + current-researcher context
        ├── components/Layout.tsx
        └── pages/            # Dashboard, Jobs, Applications, Research, Profile
```

## Running locally

You need **Python 3.11+** and **Node 18+**.

### 1. Backend (port 8000)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On first start it creates the SQLite database and seeds a demo researcher plus
a handful of sample positions. Interactive API docs: http://127.0.0.1:8000/docs

### 2. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173. The Vite dev server proxies `/api/*` to the backend
on port 8000 (configurable via `VITE_API_TARGET`).

## Configuration

Copy the example env files and edit as needed:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

To run against Postgres instead of SQLite, set in `backend/.env`:

```
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/postdocengine
```

(and `pip install psycopg[binary]`).

## API overview

All routes are under `/api`:

| Method | Path                                   | Purpose                                  |
|--------|----------------------------------------|------------------------------------------|
| GET/POST/PUT/DELETE | `/api/researchers[/{id}]` | Manage researcher profiles               |
| GET/POST/PUT/DELETE | `/api/positions[/{id}]`   | Postdoc listings; `?q=`, `?field=`, `?location=` filters |
| GET/POST/PUT/DELETE | `/api/applications[/{id}]`| Application pipeline; `?researcher_id=`, `?status=` |
| GET/POST/PUT/DELETE | `/api/research[/{id}]`    | Research items                           |
| GET    | `/api/recommendations/{researcher_id}` | Ranked matches for a researcher          |
| GET    | `/api/meta/enums`                      | Allowed status/type values               |
| GET    | `/api/health`                          | Health check                             |

## How the match engine works

`backend/app/matching.py` scores each position for a researcher in `[0, 1]` by
combining:

- **keyword-phrase overlap** between the researcher's interests and the
  position's keywords (primary signal, and the human-readable "why"),
- **token overlap** across the position's title/description/field (softer signal),
- a **field-match bonus**, and
- a small **open-deadline bonus**.

It's a transparent heuristic — no external ML dependencies — so results are fast
and explainable, and every recommendation comes with the matched keywords and a
reason string.

## Building for production

```bash
cd frontend && npm run build   # emits static assets to frontend/dist
```

Serve `frontend/dist` behind any static host and point it at the FastAPI
backend (set `VITE_API_URL` at build time, or reverse-proxy `/api`).
