# ATS Resume Scanner & Cover Letter Generator — PRD

## Original Problem Statement
> Can you build an ATS resume scanner and a cover letter generator for me, such that whenever I enter my resume and job application, you can tell me the ATS score, and customize the resume to ensure the ATS score is now 90, and also generate a cover letter for me

## User Choices (locked-in)
- LLM: **Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929` via emergentintegrations)
- Resume input: **PDF / DOCX upload** (also TXT)
- Output: **Plain-text preview + PDF download** for both optimized resume and cover letter
- Accounts: **Yes**, with persistent history
- Auth: **Emergent-managed Google OAuth**
- API key: **Emergent Universal LLM Key**

## Architecture
- Backend: FastAPI + MongoDB (motor) + emergentintegrations (Claude Sonnet 4.5) + pdfplumber + python-docx + reportlab
- Frontend: React 19, react-router-dom, axios, sonner toasts, shadcn/ui, @phosphor-icons/react
- Auth: Emergent OAuth session_id → backend session_token → httpOnly secure cookie (+ Bearer fallback)
- Design: Swiss / brutalist (Chivo + IBM Plex Sans/Mono, 0px radius, primary #002FA7)

## User Personas
- Active job-seeker tailoring applications to multiple roles
- Career-switcher needing keyword alignment to a new domain
- Recruiter sanity-checking candidate alignment to a JD

## Core Requirements (static)
1. Authenticated users only (Google login).
2. Upload resume (PDF/DOCX/TXT) or paste text.
3. Paste job description + optional title/company.
4. Generate ATS score, missing keywords, strengths/weaknesses.
5. Generate an optimized resume targeting 90+.
6. Generate a tailored cover letter.
7. Persist every scan; browse, view, delete from history.
8. Download optimized resume + cover letter as PDF.

## What's Implemented (2026-02-XX)
- [x] Emergent Google OAuth login + session cookie + /api/auth/me + logout
- [x] Resume file parser (PDF, DOCX, TXT) — `/api/resumes/parse`
- [x] Full scan pipeline — `/api/resumes/scan` (analyze → optimize → cover letter, sequential Claude Sonnet 4.5 calls)
- [x] History list/detail/delete — `/api/history`
- [x] PDF generation (reportlab) for resume + cover letter — `/api/history/{id}/download/{kind}`
- [x] Landing page with hero + features + process
- [x] Dashboard with drag-drop upload + JD input
- [x] Scan result page with bento score grid, keyword chips, split-pane resume diff, cover letter
- [x] History page with table + delete + view
- [x] Tested end-to-end (backend pytest 11/11 + frontend Playwright pass)

## Backlog (P1/P2)
- **P1** Parallelize analyze + optimize LLM calls to cut latency from ~30s to ~15s.
- **P1** Inline keyword diff highlighting (added in green, removed strikethrough) on split-pane resume view.
- **P1** Save user's "master resume" so they don't re-upload every time.
- **P2** Multiple resume variants per scan (concise / detailed / executive).
- **P2** Editable optimized resume + re-scan button.
- **P2** Share-via-link (read-only) for scans.
- **P2** Stripe upgrade to Pro tier (unlimited scans, DOCX download, AI interview prep) — revenue path.
- **P2** Cover letter style toggle (formal / conversational / startup).
- **P2** Email cover letter directly through Gmail integration.
- **P2** Browser extension to one-click scan against any job posting.
