# ATS-checker

An ATS resume scanner and cover letter generator powered by Claude Sonnet 4.5.

Upload your resume (PDF / DOCX / TXT) and paste a job description — get an honest 0–100 ATS score, an optimized resume rewritten to break 90, and a tailored cover letter. Save your history, download both as PDF.

## Features

- **Emergent Google OAuth** — one-click sign-in.
- **PDF / DOCX / TXT resume upload** with drag-and-drop.
- **ATS score breakdown** — overall score, keyword match %, missing keywords, strengths, weaknesses.
- **Resume optimization** — rewritten to target 90+ while staying 100% truthful (never invents experience).
- **Tailored cover letter** — 3-paragraph, role-specific.
- **Split-pane diff** with inline keyword highlighting (green = added from JD, blue = already matched).
- **History** — every scan saved per user, with delete and revisit.
- **PDF downloads** for both optimized resume and cover letter (instant inline download).

## Tech Stack

- **Frontend**: React 19, react-router-dom, shadcn/ui, Tailwind CSS, @phosphor-icons/react, axios, sonner
- **Backend**: FastAPI, Motor (async MongoDB), emergentintegrations (Claude Sonnet 4.5), pdfplumber, python-docx, reportlab
- **Database**: MongoDB
- **Auth**: Emergent-managed Google OAuth (httpOnly cookie + Bearer fallback)

## Setup

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # then fill in your values
```

`backend/.env` requires:

| Variable           | Description                                                              |
|--------------------|--------------------------------------------------------------------------|
| `MONGO_URL`        | MongoDB connection string (local or Atlas).                              |
| `DB_NAME`          | Database name.                                                           |
| `CORS_ORIGINS`     | Comma-separated allowed origins (use `*` for dev).                       |
| `EMERGENT_LLM_KEY` | Universal LLM key from Emergent → Profile → Universal Key.               |

Run:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend

```bash
cd frontend
yarn install
cp .env.example .env  # then point REACT_APP_BACKEND_URL at your backend
yarn start
```

`frontend/.env` requires:

| Variable                | Description                                |
|-------------------------|--------------------------------------------|
| `REACT_APP_BACKEND_URL` | Public backend URL (no trailing slash).    |

The frontend will be available on `http://localhost:3000`.

## Project Structure

```
backend/
  server.py            # FastAPI app: auth, parse, scan, history, PDF download
  .env.example
  requirements.txt
frontend/
  src/
    App.js
    pages/             # LandingPage, AuthCallback, Dashboard, ScanResult, History
    components/        # AppShell, HighlightedResume, ui/...
    lib/               # api.js, auth.jsx
  .env.example
  package.json
```

## API Quick Reference

| Method | Path                                       | Description                              |
|--------|--------------------------------------------|------------------------------------------|
| POST   | `/api/auth/session`                        | Exchange Emergent session_id → cookie.   |
| GET    | `/api/auth/me`                             | Current user.                            |
| POST   | `/api/auth/logout`                         | Clear session.                           |
| POST   | `/api/resumes/parse`                       | Upload PDF/DOCX/TXT → extract text.      |
| POST   | `/api/resumes/scan`                        | Run analyze + optimize + cover letter.   |
| GET    | `/api/history`                             | List user scans.                         |
| GET    | `/api/history/{scan_id}`                   | Full scan detail.                        |
| DELETE | `/api/history/{scan_id}`                   | Delete a scan.                           |
| GET    | `/api/history/{scan_id}/download/{kind}`   | Download PDF (`resume` or `cover`).      |

## Security

- API keys live in `.env` files, which are gitignored — never committed.
- All routes (except `/api/auth/session`) require an authenticated session via httpOnly cookie or Bearer token.
- LLM calls are isolated per scan with retry + graceful 502 on transient provider failures.

## License

MIT.
