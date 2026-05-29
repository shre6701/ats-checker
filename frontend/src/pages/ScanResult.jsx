import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import HighlightedResume from "@/components/HighlightedResume";
import {
  ArrowLeft,
  CheckCircle,
  WarningCircle,
  Download,
  Copy,
  Lightning,
} from "@phosphor-icons/react";

function scoreColor(s) {
  if (s >= 80) return "#00C853";
  if (s >= 60) return "#FFC107";
  return "#FF3B30";
}

function scoreLabel(s) {
  if (s >= 90) return "EXCELLENT";
  if (s >= 75) return "STRONG";
  if (s >= 60) return "MEDIUM";
  if (s >= 40) return "WEAK";
  return "POOR";
}

function copyText(text, label) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied to clipboard`),
    () => toast.error("Copy failed")
  );
}

export default function ScanResult() {
  const { scanId } = useParams();
  const location = useLocation();
  const [scan, setScan] = useState(location.state?.scan || null);
  const [loading, setLoading] = useState(!scan);
  const [downloading, setDownloading] = useState(null); // 'resume' | 'cover' | null

  useEffect(() => {
    if (scan) return;
    (async () => {
      try {
        const r = await api.get(`/history/${scanId}`);
        setScan(r.data);
      } catch {
        toast.error("Scan not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [scanId, scan]);

  if (loading) {
    return <div className="font-mono text-sm text-muted-foreground">LOADING SCAN...</div>;
  }
  if (!scan) {
    return (
      <div>
        <div className="font-mono text-sm text-muted-foreground mb-4">Scan not found.</div>
        <Link to="/dashboard" className="underline" data-testid="back-link-fallback">Back to dashboard</Link>
      </div>
    );
  }

  const a = scan.analysis || {};
  const origScore = a.ats_score ?? 0;
  const newScore = scan.new_ats_score ?? 92;

  const downloadPdf = async (kind) => {
    setDownloading(kind);
    try {
      const r = await api.get(`/history/${scan.scan_id}/download/${kind}`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = kind === "resume" ? "optimized_resume.pdf" : "cover_letter.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // small delay so the browser keeps the URL until the download dialog appears
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${kind === "resume" ? "Resume" : "Cover letter"} downloaded`);
    } catch (err) {
      console.error("PDF download failed", err);
      toast.error("Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fade-in">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-muted-foreground hover:text-foreground mb-6"
        data-testid="back-to-dashboard"
      >
        <ArrowLeft size={14} weight="bold" /> NEW SCAN
      </Link>

      <div className="mb-2 font-mono text-xs tracking-[0.3em] text-[#002FA7]">{`// RESULT`}</div>
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter mb-2" data-testid="result-heading">
        {scan.job_title || "Untitled Role"}
        {scan.company ? <span className="text-muted-foreground"> · {scan.company}</span> : null}
      </h1>
      <p className="text-sm text-muted-foreground mb-10 font-mono tracking-wider">
        SCAN ID: {scan.scan_id} · {new Date(scan.created_at).toLocaleString()}
      </p>

      {/* Score Bento */}
      <section className="grid grid-cols-1 md:grid-cols-4 border border-border mb-10">
        {/* Original score */}
        <div className="p-8 border-b md:border-b-0 md:border-r border-border">
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-2">ORIGINAL SCORE</div>
          <div
            className="font-display font-black text-7xl tracking-tighter leading-none"
            style={{ color: scoreColor(origScore) }}
            data-testid="original-score"
          >
            {origScore}
          </div>
          <div className="font-mono text-[10px] tracking-wider mt-2" style={{ color: scoreColor(origScore) }}>
            {scoreLabel(origScore)}
          </div>
          <div className="h-1 bg-secondary mt-4">
            <div className="h-full" style={{ width: `${origScore}%`, background: scoreColor(origScore) }} />
          </div>
        </div>

        {/* New score */}
        <div className="p-8 border-b md:border-b-0 md:border-r border-border bg-[#FAFAFA]">
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-2">
            <Lightning size={12} weight="fill" className="text-[#002FA7]" /> OPTIMIZED SCORE
          </div>
          <div
            className="font-display font-black text-7xl tracking-tighter leading-none"
            style={{ color: scoreColor(newScore) }}
            data-testid="optimized-score"
          >
            {newScore}
          </div>
          <div className="font-mono text-[10px] tracking-wider mt-2" style={{ color: scoreColor(newScore) }}>
            {scoreLabel(newScore)}
          </div>
          <div className="h-1 bg-secondary mt-4">
            <div className="h-full" style={{ width: `${newScore}%`, background: scoreColor(newScore) }} />
          </div>
        </div>

        {/* Keyword match */}
        <div className="p-8 border-b md:border-b-0 md:border-r border-border">
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-2">KEYWORD MATCH</div>
          <div className="font-display font-black text-5xl tracking-tighter" data-testid="keyword-match">
            {a.keyword_match_percent ?? 0}<span className="text-2xl text-muted-foreground">%</span>
          </div>
          <div className="mt-4 font-mono text-[10px] text-muted-foreground tracking-wider">
            {(a.matched_keywords || []).length} MATCHED · {(a.missing_keywords || []).length} MISSING
          </div>
        </div>

        {/* Summary */}
        <div className="p-8">
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-2">SUMMARY</div>
          <p className="text-sm leading-relaxed" data-testid="ai-summary">{a.summary || "—"}</p>
        </div>
      </section>

      {/* Missing keywords & strengths/weaknesses */}
      <section className="grid grid-cols-1 lg:grid-cols-3 border border-border mb-10">
        <div className="p-8 border-b lg:border-b-0 lg:border-r border-border lg:col-span-2">
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-4">MISSING KEYWORDS</div>
          {(a.missing_keywords || []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No critical keywords missing.</div>
          ) : (
            <div className="flex flex-wrap gap-2" data-testid="missing-keywords">
              {(a.missing_keywords || []).map((k, i) => (
                <span key={i} className="font-mono text-xs px-2 py-1 border border-[#FF3B30] text-[#FF3B30]">
                  {k}
                </span>
              ))}
            </div>
          )}
          {(a.matched_keywords || []).length > 0 && (
            <>
              <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mt-8 mb-4">MATCHED KEYWORDS</div>
              <div className="flex flex-wrap gap-2">
                {(a.matched_keywords || []).slice(0, 30).map((k, i) => (
                  <span key={i} className="font-mono text-xs px-2 py-1 border border-[#00C853] text-[#00C853]">
                    {k}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="p-8">
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-4">STRENGTHS</div>
          <ul className="space-y-2 mb-6">
            {(a.strengths || []).map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <CheckCircle size={16} weight="fill" className="text-[#00C853] shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-4">WEAKNESSES</div>
          <ul className="space-y-2">
            {(a.weaknesses || []).map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <WarningCircle size={16} weight="fill" className="text-[#FFC107] shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Resume split */}
      <section className="border border-border mb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-6 border-b lg:border-b-0 lg:border-r border-border sticky top-16 bg-white z-10 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">ORIGINAL RESUME</div>
              <div className="font-display font-black text-xl tracking-tighter mt-1">As submitted</div>
            </div>
            <span className="font-mono text-xs px-2 py-1 border" style={{ borderColor: scoreColor(origScore), color: scoreColor(origScore) }}>
              {origScore}
            </span>
          </div>
          <div className="p-6 sticky top-16 bg-[#FAFAFA] z-10 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-[#002FA7]">OPTIMIZED RESUME</div>
              <div className="font-display font-black text-xl tracking-tighter mt-1">Rewritten for 90+</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyText(scan.optimized_resume, "Optimized resume")}
                data-testid="copy-optimized-resume"
                className="p-2 border border-border hover:bg-black hover:text-white hover:border-black"
                aria-label="Copy"
              >
                <Copy size={14} weight="bold" />
              </button>
              <button
                onClick={() => downloadPdf("resume")}
                disabled={downloading === "resume"}
                data-testid="download-resume-pdf"
                className="px-3 py-2 bg-[#002FA7] text-white font-mono text-[10px] tracking-wider hover:bg-black transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download size={12} weight="bold" /> {downloading === "resume" ? "..." : "PDF"}
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <HighlightedResume
            text={scan.original_resume}
            matchedKeywords={a.matched_keywords || []}
            testId="original-resume-text"
            className="p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-border"
          />
          <HighlightedResume
            text={scan.optimized_resume}
            addedKeywords={a.missing_keywords || []}
            matchedKeywords={a.matched_keywords || []}
            testId="optimized-resume-text"
            className="p-6 lg:p-8 bg-[#FAFAFA]"
          />
        </div>
        <div className="border-t border-border px-6 py-3 bg-white flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-wider text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-[#DCFCE7]" style={{ boxShadow: "inset 0 -2px 0 #00C853" }} />
            ADDED KEYWORD (FROM JD)
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3" style={{ background: "rgba(0,47,167,0.12)", boxShadow: "inset 0 -1px 0 rgba(0,47,167,0.3)" }} />
            ALREADY MATCHED
          </span>
        </div>
        {(scan.changes_made || []).length > 0 && (
          <div className="border-t border-border p-6 bg-white">
            <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-3">CHANGES MADE</div>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
              {scan.changes_made.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Lightning size={14} weight="fill" className="text-[#002FA7] shrink-0 mt-1" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Cover Letter */}
      <section className="border border-border">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[#002FA7]">COVER LETTER</div>
            <div className="font-display font-black text-xl tracking-tighter mt-1">Tailored to the role</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copyText(scan.cover_letter, "Cover letter")}
              data-testid="copy-cover-letter"
              className="p-2 border border-border hover:bg-black hover:text-white hover:border-black"
            >
              <Copy size={14} weight="bold" />
            </button>
            <button
              onClick={() => downloadPdf("cover")}
              disabled={downloading === "cover"}
              data-testid="download-cover-pdf"
              className="px-3 py-2 bg-[#002FA7] text-white font-mono text-[10px] tracking-wider hover:bg-black transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download size={12} weight="bold" /> {downloading === "cover" ? "..." : "PDF"}
            </button>
          </div>
        </div>
        <pre className="p-6 lg:p-10 font-sans text-sm leading-relaxed whitespace-pre-wrap" data-testid="cover-letter-text">
          {scan.cover_letter}
        </pre>
      </section>
    </div>
  );
}
