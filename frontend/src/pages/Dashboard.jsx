import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { UploadSimple, FileText, Spinner, ArrowRight, X } from "@phosphor-icons/react";

export default function Dashboard() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [resumeText, setResumeText] = useState("");
  const [filename, setFilename] = useState("");
  const [sourceFormat, setSourceFormat] = useState("pdf");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const onUpload = async (file) => {
    if (!file) return;
    const valid = /\.(pdf|docx|txt)$/i.test(file.name);
    if (!valid) {
      toast.error("Only PDF, DOCX, or TXT files are supported.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/resumes/parse", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResumeText(r.data.text);
      setFilename(r.data.filename);
      setSourceFormat(r.data.source_format || "pdf");
      toast.success("Resume parsed successfully.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to parse resume.");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e) => {
    e?.preventDefault();
    if (!resumeText.trim()) return toast.error("Upload or paste your resume first.");
    if (!jobDescription.trim()) return toast.error("Paste the job description.");
    setScanning(true);
    try {
      const r = await api.post(
        "/resumes/scan",
        {
          resume_text: resumeText,
          job_description: jobDescription,
          job_title: jobTitle,
          company,
          source_format: sourceFormat,
        },
        { timeout: 120000 }, // 120s for the 3 parallel LLM calls
      );
      toast.success("Scan complete.");
      navigate(`/scan/${r.data.scan_id}`, { state: { scan: r.data } });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.code === "ECONNABORTED") {
        toast.error("Scan timed out. Please try again.");
      } else {
        toast.error(detail || "Scan failed. Please try again.");
      }
    } finally {
      setScanning(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onUpload(f);
  };

  return (
    <div className="fade-in">
      <div className="mb-12">
        <div className="font-mono text-xs tracking-[0.3em] text-[#002FA7] mb-3">{`// NEW SCAN`}</div>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter mb-3">Run an ATS scan.</h1>
        <p className="text-muted-foreground max-w-2xl">
          Upload your resume and paste the job description. We&apos;ll score it, rewrite it to 90+, and draft a cover letter.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-border">
        {/* Left: Resume */}
        <div className="p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-border">
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-4">01 — YOUR RESUME</div>

          {!resumeText ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              data-testid="upload-dropzone"
              className="border-2 border-dashed border-border p-12 text-center cursor-pointer hover:border-foreground transition-colors"
            >
              <UploadSimple size={36} weight="bold" className="mx-auto mb-4 text-foreground" />
              <div className="font-display font-black text-lg tracking-tight mb-2">
                {uploading ? "PARSING..." : "UPLOAD RESUME"}
              </div>
              <div className="font-mono text-xs text-muted-foreground mb-2">PDF · DOCX · TXT</div>
              <div className="text-sm text-muted-foreground">Drag & drop or click to browse</div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                data-testid="resume-file-input"
                onChange={(e) => onUpload(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div>
              <div className="border border-border p-4 flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={20} weight="bold" className="text-[#002FA7] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate" data-testid="parsed-filename">{filename || "Pasted resume"}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {resumeText.length.toLocaleString()} CHARS
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setResumeText(""); setFilename(""); setSourceFormat("pdf"); }}
                  data-testid="clear-resume-button"
                  className="p-1.5 hover:bg-black hover:text-white transition-colors"
                  aria-label="Clear resume"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                data-testid="resume-text-area"
                rows={14}
                className="w-full border border-border p-4 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#002FA7]"
              />
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground text-center">
            — or —{" "}
            <button
              type="button"
              data-testid="paste-resume-toggle"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => { setResumeText(resumeText || " "); setFilename(""); }}
            >
              paste resume text manually
            </button>
          </div>
        </div>

        {/* Right: Job */}
        <div className="p-8 lg:p-10">
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mb-4">02 — TARGET JOB</div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="font-mono text-[10px] tracking-wider text-muted-foreground block mb-2">JOB TITLE</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Product Designer"
                data-testid="job-title-input"
                className="w-full border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002FA7]"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-wider text-muted-foreground block mb-2">COMPANY</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Stripe"
                data-testid="company-input"
                className="w-full border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002FA7]"
              />
            </div>
          </div>

          <label className="font-mono text-[10px] tracking-wider text-muted-foreground block mb-2">JOB DESCRIPTION</label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            rows={16}
            data-testid="job-description-textarea"
            className="w-full border border-border p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#002FA7] resize-y"
          />
          <div className="font-mono text-[10px] text-muted-foreground mt-2">
            {jobDescription.length.toLocaleString()} CHARS
          </div>
        </div>

        {/* Footer */}
        <div className="col-span-1 lg:col-span-2 border-t border-border p-6 bg-[#FAFAFA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="font-mono text-[10px] tracking-wider text-muted-foreground">
            ANALYSIS POWERED BY CLAUDE SONNET 4.5 · ~30 SECONDS
          </div>
          <button
            type="submit"
            disabled={scanning || uploading}
            data-testid="run-scan-button"
            className="px-7 py-4 bg-[#002FA7] text-white font-mono text-xs tracking-[0.2em] hover:bg-black transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? <><Spinner size={16} weight="bold" className="animate-spin" /> SCANNING...</> : <>RUN ATS SCAN <ArrowRight size={16} weight="bold" /></>}
          </button>
        </div>
      </form>
    </div>
  );
}
