"""ATS Resume Scanner + Cover Letter Generator - Backend"""
import os
import io
import json
import uuid
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request, Response, Cookie, Header
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import httpx
import pdfplumber
from docx import Document
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_LEFT

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="ATS Resume Scanner API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ----------------- MODELS -----------------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ScanRequest(BaseModel):
    resume_text: str
    job_description: str
    job_title: Optional[str] = ""
    company: Optional[str] = ""


# ----------------- AUTH HELPERS -----------------
async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> User:
    # cookie first then bearer
    token = request.cookies.get("session_token")
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


# ----------------- AUTH ROUTES -----------------
@api.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id from Emergent OAuth for a persistent session_token."""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", ""), "picture": data.get("picture", "")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": data.get("name", ""),
                "picture": data.get("picture", ""),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {
        "user_id": user_id,
        "email": email,
        "name": data.get("name", ""),
        "picture": data.get("picture", ""),
    }


@api.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


# ----------------- FILE PARSING -----------------
def extract_text_from_pdf(content: bytes) -> str:
    text_parts: List[str] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            text_parts.append(t)
    return "\n".join(text_parts).strip()


def extract_text_from_docx(content: bytes) -> str:
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


@api.post("/resumes/parse")
async def parse_resume(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    content = await file.read()
    name = (file.filename or "").lower()
    try:
        if name.endswith(".pdf"):
            text = extract_text_from_pdf(content)
        elif name.endswith(".docx"):
            text = extract_text_from_docx(content)
        elif name.endswith(".txt"):
            text = content.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=400, detail="Only PDF, DOCX, TXT supported")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"parse failed: {e}")
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file")
    return {"text": text, "filename": file.filename}


# ----------------- LLM HELPERS -----------------
def _new_chat(session_id: str, system: str) -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")


def _parse_json_response(text: str) -> dict:
    """Robustly extract a JSON object from an LLM response."""
    t = (text or "").strip()
    # Strip markdown fences
    if t.startswith("```"):
        t = t[3:]
        if t.lower().startswith("json"):
            t = t[4:]
        if t.endswith("```"):
            t = t[:-3]
    t = t.strip()
    # Try direct first
    try:
        return json.loads(t)
    except Exception:
        pass
    # Slice between the first { and matching closing }
    start = t.find("{")
    if start == -1:
        raise ValueError("No JSON object in LLM response")
    depth = 0
    end = -1
    for i in range(start, len(t)):
        c = t[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        end = t.rfind("}")
    return json.loads(t[start : end + 1])


# Input size caps to keep LLM calls fast and within token budget
MAX_RESUME_CHARS = 12000
MAX_JD_CHARS = 8000


def _truncate(s: str, limit: int) -> str:
    s = (s or "").strip()
    return s if len(s) <= limit else s[:limit] + "\n[...truncated for length...]"


async def _retry_llm(coro_factory, label: str, attempts: int = 2):
    """Call an async LLM-producing callable with one retry on transient failure."""
    last_err = None
    for i in range(attempts):
        try:
            return await coro_factory()
        except Exception as e:
            last_err = e
            logger.warning(f"{label} attempt {i + 1}/{attempts} failed: {e}")
            await asyncio.sleep(0.6)
    raise last_err


async def llm_analyze(resume: str, jd: str, job_title: str, company: str) -> dict:
    system = (
        "You are an expert ATS (Applicant Tracking System) analyzer. You evaluate resumes "
        "against job descriptions exactly as systems like Workday, Greenhouse, Lever, and "
        "Taleo do. Return STRICT JSON only, no commentary, no markdown fences."
    )
    prompt = f"""Analyze this resume against the job description and return ONLY a JSON object with these exact keys:

{{
  "ats_score": <integer 0-100>,
  "keyword_match_percent": <integer 0-100>,
  "matched_keywords": [<strings>],
  "missing_keywords": [<strings of critical keywords from JD not in resume>],
  "strengths": [<3-5 short strings>],
  "weaknesses": [<3-5 short strings>],
  "format_issues": [<short strings about formatting/parsing issues>],
  "summary": "<2-3 sentence honest assessment>"
}}

Be strict — if the resume barely matches the JD, score it low (30-50). If it strongly matches with most keywords, score 75-90.

JOB TITLE: {job_title or "N/A"}
COMPANY: {company or "N/A"}

JOB DESCRIPTION:
\"\"\"
{jd}
\"\"\"

RESUME:
\"\"\"
{resume}
\"\"\"

Return ONLY the JSON object."""
    chat = _new_chat(f"analyze-{uuid.uuid4().hex[:8]}", system)
    resp = await chat.send_message(UserMessage(text=prompt))
    return _parse_json_response(resp)


async def llm_optimize(resume: str, jd: str, missing_kw: List[str], target: int = 92) -> dict:
    system = (
        "You are an elite resume writer who rewrites resumes to score 90+ on ATS systems "
        "while remaining 100% truthful (you NEVER invent jobs, companies, dates, or skills "
        "the candidate doesn't have). You rephrase, surface real but understated skills, "
        "use exact JD keywords, and reformat for ATS parseability. Return STRICT JSON only."
    )
    prompt = f"""Rewrite the resume below to maximize its ATS score against the target job description.

Target ATS score: {target}+
Critical keywords currently missing: {", ".join(missing_kw) if missing_kw else "none"}

Rules:
- Use a clean, plain-text ATS-friendly format with these sections (only if relevant content exists): SUMMARY, SKILLS, EXPERIENCE, EDUCATION, CERTIFICATIONS, PROJECTS.
- Naturally incorporate missing keywords ONLY if the candidate's existing experience legitimately covers that area (rephrase, don't fabricate).
- Use strong action verbs, quantified achievements where possible, concise bullets.
- Keep all real dates, titles, companies, and degrees unchanged.

Return ONLY this JSON:
{{
  "optimized_resume": "<the full rewritten resume as a single string with \\n line breaks>",
  "changes_made": [<3-6 short bullet strings describing key improvements>],
  "new_ats_score_estimate": <integer 0-100>
}}

JOB DESCRIPTION:
\"\"\"
{jd}
\"\"\"

ORIGINAL RESUME:
\"\"\"
{resume}
\"\"\"

Return ONLY the JSON."""
    chat = _new_chat(f"optimize-{uuid.uuid4().hex[:8]}", system)
    resp = await chat.send_message(UserMessage(text=prompt))
    return _parse_json_response(resp)


async def llm_cover_letter(resume: str, jd: str, job_title: str, company: str, applicant_name: str) -> str:
    system = (
        "You are an expert career coach writing tailored, professional cover letters. "
        "Your letters are confident, concise (3-4 paragraphs), specific to the role, "
        "and reference real evidence from the candidate's resume. No clichés like "
        "'I am writing to apply'. No invented facts."
    )
    prompt = f"""Write a tailored cover letter for the candidate below applying to the role.

Candidate name: {applicant_name or "[Your Name]"}
Job title: {job_title or "the role"}
Company: {company or "the company"}

Structure:
- Date (today's, format: Month DD, YYYY)
- Greeting ("Dear Hiring Manager,")
- Opening hook (1-2 lines, specific to the company/role)
- Body paragraph 1: top 2 achievements / skills aligning with JD
- Body paragraph 2: why this company / culture fit (only use info in resume; otherwise keep generic but role-specific)
- Closing paragraph + call to action
- Sign-off: "Sincerely,\\n{applicant_name or "[Your Name]"}"

Return ONLY the cover letter text (no JSON, no markdown).

JOB DESCRIPTION:
\"\"\"
{jd}
\"\"\"

RESUME:
\"\"\"
{resume}
\"\"\"
"""
    chat = _new_chat(f"cover-{uuid.uuid4().hex[:8]}", system)
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp.strip()


# ----------------- SCAN PIPELINE -----------------
@api.post("/resumes/scan")
async def scan_resume(req: ScanRequest, user: User = Depends(get_current_user)):
    if not req.resume_text.strip() or not req.job_description.strip():
        raise HTTPException(status_code=400, detail="Resume and job description required")

    resume = _truncate(req.resume_text, MAX_RESUME_CHARS)
    jd = _truncate(req.job_description, MAX_JD_CHARS)
    jt = (req.job_title or "")[:200]
    co = (req.company or "")[:200]

    # All three LLM calls run in parallel; each has its own retry.
    # We use return_exceptions so a partial failure surfaces a clean 502, not a crash.
    results = await asyncio.gather(
        _retry_llm(lambda: llm_analyze(resume, jd, jt, co), "analyze"),
        _retry_llm(lambda: llm_optimize(resume, jd, [], target=92), "optimize"),
        _retry_llm(lambda: llm_cover_letter(resume, jd, jt, co, user.name), "cover_letter"),
        return_exceptions=True,
    )
    analysis, optimization, cover_letter = results
    failures = [name for name, r in zip(("analyze", "optimize", "cover_letter"), results) if isinstance(r, Exception)]
    if failures:
        logger.error(f"Scan failed for steps: {failures}; errors: {[r for r in results if isinstance(r, Exception)]}")
        raise HTTPException(
            status_code=502,
            detail=f"AI service unavailable for: {', '.join(failures)}. Please retry.",
        )

    scan_id = f"scan_{uuid.uuid4().hex[:12]}"
    doc = {
        "scan_id": scan_id,
        "user_id": user.user_id,
        "job_title": req.job_title or "",
        "company": req.company or "",
        "job_description": req.job_description,
        "original_resume": req.resume_text,
        "analysis": analysis,
        "optimized_resume": optimization["optimized_resume"],
        "changes_made": optimization.get("changes_made", []),
        "new_ats_score": optimization.get("new_ats_score_estimate", 90),
        "cover_letter": cover_letter,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.scans.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ----------------- HISTORY -----------------
@api.get("/history")
async def get_history(user: User = Depends(get_current_user)):
    items = await db.scans.find(
        {"user_id": user.user_id},
        {
            "_id": 0,
            "scan_id": 1,
            "job_title": 1,
            "company": 1,
            "created_at": 1,
            "analysis.ats_score": 1,
            "new_ats_score": 1,
        },
    ).sort("created_at", -1).to_list(200)
    return items


@api.get("/history/{scan_id}")
async def get_scan(scan_id: str, user: User = Depends(get_current_user)):
    doc = await db.scans.find_one({"scan_id": scan_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@api.delete("/history/{scan_id}")
async def delete_scan(scan_id: str, user: User = Depends(get_current_user)):
    res = await db.scans.delete_one({"scan_id": scan_id, "user_id": user.user_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ----------------- PDF DOWNLOAD -----------------
def build_pdf(title: str, body_text: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=LETTER, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.75 * inch, bottomMargin=0.75 * inch)
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "body", parent=styles["Normal"], fontName="Helvetica", fontSize=10.5, leading=14, alignment=TA_LEFT, spaceAfter=6,
    )
    h_style = ParagraphStyle(
        "h", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, spaceAfter=8,
    )
    flow = [Paragraph(title, h_style), Spacer(1, 6)]
    for line in body_text.split("\n"):
        line = line.strip()
        if not line:
            flow.append(Spacer(1, 6))
            continue
        # Detect simple headings (UPPERCASE line of 3-40 chars)
        if line.isupper() and 3 <= len(line) <= 40:
            flow.append(Paragraph(f"<b>{line}</b>", body_style))
        else:
            flow.append(Paragraph(line.replace("<", "&lt;").replace(">", "&gt;"), body_style))
    doc.build(flow)
    buf.seek(0)
    return buf.read()


@api.get("/history/{scan_id}/download/{kind}")
async def download_pdf(scan_id: str, kind: str, user: User = Depends(get_current_user)):
    doc = await db.scans.find_one({"scan_id": scan_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if kind == "resume":
        pdf = build_pdf("Optimized Resume", doc["optimized_resume"])
        filename = "optimized_resume.pdf"
    elif kind == "cover":
        pdf = build_pdf("Cover Letter", doc["cover_letter"])
        filename = "cover_letter.pdf"
    else:
        raise HTTPException(status_code=400, detail="kind must be 'resume' or 'cover'")
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ----------------- HEALTH -----------------
@api.get("/")
async def root():
    return {"service": "ATS Resume Scanner", "ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
