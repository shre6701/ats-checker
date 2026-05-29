import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { ArrowRight, Lightning, Target, FileText, ShieldCheck } from "@phosphor-icons/react";

export default function LandingPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-mono text-sm tracking-wider text-muted-foreground">LOADING...</div>
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const features = [
    { icon: Target, title: "ATS SCORE", desc: "Get an honest 0-100 score graded the way Workday, Greenhouse and Lever grade you." },
    { icon: Lightning, title: "REWRITE TO 90+", desc: "AI rewrites your resume — keywords, phrasing, structure — without inventing experience." },
    { icon: FileText, title: "TAILORED COVER LETTER", desc: "A 3-paragraph cover letter generated for the exact role, ready to download as PDF." },
    { icon: ShieldCheck, title: "TRUTHFUL OUTPUT", desc: "We never fabricate titles, dates, or skills. Only surface what's genuinely there." },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#002FA7] flex items-center justify-center">
              <FileText size={18} weight="bold" color="white" />
            </div>
            <div className="font-display font-black text-lg tracking-tighter">ATS<span className="text-[#002FA7]">/</span>RANK</div>
          </div>
          <button
            onClick={handleLogin}
            data-testid="header-login-button"
            className="px-4 py-2 font-mono text-xs tracking-wider border border-foreground hover:bg-black hover:text-white transition-colors"
          >
            SIGN IN →
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-grid border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8">
            <div className="font-mono text-xs tracking-[0.3em] text-[#002FA7] mb-6">{`// RESUME INTELLIGENCE PLATFORM`}</div>
            <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl tracking-tighter leading-[0.95] mb-8">
              Score, rewrite,<br />
              and apply — without<br />
              the <span className="text-[#002FA7]">guesswork</span>.
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              Drop in your resume and the job description. Get an ATS score graded like a real tracking system,
              a rewrite tuned to break 90, and a cover letter tailored to the role — all in under a minute.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleLogin}
                data-testid="hero-cta-button"
                className="px-7 py-4 bg-[#002FA7] text-white font-mono text-xs tracking-[0.2em] hover:bg-black transition-colors flex items-center gap-3"
              >
                SIGN IN WITH GOOGLE
                <ArrowRight size={16} weight="bold" />
              </button>
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
                FREE · NO CARD REQUIRED
              </span>
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="border border-border bg-white p-6">
              <div className="font-mono text-[10px] tracking-wider text-muted-foreground mb-4">SAMPLE OUTPUT</div>
              <div className="flex items-end justify-between mb-3">
                <span className="font-mono text-xs text-muted-foreground">ATS SCORE</span>
                <span className="font-mono text-[10px] text-muted-foreground">/100</span>
              </div>
              <div className="font-display font-black text-7xl tracking-tighter text-[#00C853] leading-none">92</div>
              <div className="h-1 bg-secondary mt-4 mb-6">
                <div className="h-full bg-[#00C853]" style={{ width: "92%" }} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-t border-border"><span className="text-muted-foreground">KEYWORDS</span><span className="font-mono">94%</span></div>
                <div className="flex justify-between py-2 border-t border-border"><span className="text-muted-foreground">FORMAT</span><span className="font-mono">PASS</span></div>
                <div className="flex justify-between py-2 border-t border-border"><span className="text-muted-foreground">EXPERIENCE</span><span className="font-mono">STRONG</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-b border-border">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="p-8 lg:p-10 border-r border-b border-border">
                <Icon size={28} weight="bold" className="text-[#002FA7] mb-6" />
                <div className="font-display font-black text-lg tracking-tight mb-3">{f.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Process strip */}
      <section className="bg-foreground text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-20">
          <div className="font-mono text-xs tracking-[0.3em] text-white/50 mb-8">{`// PROCESS`}</div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              ["01", "UPLOAD", "PDF or DOCX resume + paste the job description."],
              ["02", "ANALYZE", "Claude Sonnet 4.5 grades you like an ATS engine — keywords, gaps, format."],
              ["03", "DELIVER", "Get an optimized resume + tailored cover letter. Download as PDF."],
            ].map(([n, t, d]) => (
              <div key={n} className="border-t border-white/20 pt-6">
                <div className="font-mono text-xs tracking-wider text-white/40 mb-3">STEP {n}</div>
                <div className="font-display font-black text-2xl tracking-tight mb-3">{t}</div>
                <p className="text-sm text-white/70 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <button
              onClick={handleLogin}
              data-testid="bottom-cta-button"
              className="px-7 py-4 bg-white text-foreground font-mono text-xs tracking-[0.2em] hover:bg-[#002FA7] hover:text-white transition-colors flex items-center gap-3"
            >
              GET STARTED — IT&apos;S FREE
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-6 font-mono text-[10px] tracking-wider text-muted-foreground flex justify-between">
          <span>ATS/RANK © 2026</span>
          <span>BUILT WITH PRECISION</span>
        </div>
      </footer>
    </div>
  );
}
