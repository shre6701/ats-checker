import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { SignOut, Gauge, ClockCounterClockwise, FileText } from "@phosphor-icons/react";

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = [
    { to: "/dashboard", label: "NEW SCAN", icon: Gauge, id: "nav-dashboard" },
    { to: "/history", label: "HISTORY", icon: ClockCounterClockwise, id: "nav-history" },
  ];
  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="border-b border-border bg-white sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3" data-testid="brand-link">
            <div className="w-8 h-8 bg-[#002FA7] flex items-center justify-center">
              <FileText size={18} weight="bold" color="white" />
            </div>
            <div className="font-display font-black text-lg tracking-tighter">ATS<span className="text-[#002FA7]">/</span>RANK</div>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = loc.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  data-testid={n.id}
                  className={`px-4 py-2 font-mono text-xs tracking-wider flex items-center gap-2 transition-colors ${
                    active ? "bg-[#002FA7] text-white" : "text-foreground hover:bg-black hover:text-white"
                  }`}
                >
                  <Icon size={14} weight="bold" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-8 h-8 object-cover border border-border" />
            ) : (
              <div className="w-8 h-8 bg-[#002FA7] text-white flex items-center justify-center font-mono text-xs">
                {(user?.name || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="hidden md:block">
              <div className="font-mono text-[10px] text-muted-foreground tracking-wider">USER</div>
              <div className="text-sm font-medium leading-none">{user?.name}</div>
            </div>
            <button
              onClick={logout}
              data-testid="logout-button"
              className="ml-2 px-3 py-2 border border-border font-mono text-xs tracking-wider hover:bg-black hover:text-white hover:border-black transition-colors flex items-center gap-1.5"
            >
              <SignOut size={14} weight="bold" />
              LOGOUT
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">{children}</main>
      <footer className="border-t border-border mt-20">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-6 font-mono text-[10px] tracking-wider text-muted-foreground flex justify-between">
          <span>ATS/RANK © 2026</span>
          <span>POWERED BY CLAUDE SONNET 4.5</span>
        </div>
      </footer>
    </div>
  );
}
