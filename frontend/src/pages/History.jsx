import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Trash, ArrowRight, FileText } from "@phosphor-icons/react";

function scoreColor(s) {
  if (s >= 80) return "#00C853";
  if (s >= 60) return "#FFC107";
  return "#FF3B30";
}

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/history");
      setItems(r.data);
    } catch {
      toast.error("Could not load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Delete this scan permanently?")) return;
    try {
      await api.delete(`/history/${id}`);
      setItems((prev) => prev.filter((x) => x.scan_id !== id));
      toast.success("Deleted.");
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="fade-in">
      <div className="mb-10">
        <div className="font-mono text-xs tracking-[0.3em] text-[#002FA7] mb-3">{`// HISTORY`}</div>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter">Your past scans.</h1>
      </div>

      {loading ? (
        <div className="font-mono text-sm text-muted-foreground">LOADING...</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center" data-testid="history-empty-state">
          <FileText size={36} weight="bold" className="mx-auto mb-4 text-muted-foreground" />
          <div className="font-display font-black text-xl mb-2">No scans yet</div>
          <p className="text-sm text-muted-foreground mb-6">Run your first scan to see it listed here.</p>
          <Link
            to="/dashboard"
            data-testid="history-empty-cta"
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#002FA7] text-white font-mono text-xs tracking-[0.2em] hover:bg-black transition-colors"
          >
            NEW SCAN <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      ) : (
        <div className="border border-border">
          <div className="grid grid-cols-12 px-6 py-3 border-b border-border bg-[#FAFAFA] font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            <div className="col-span-5">ROLE</div>
            <div className="col-span-2">ORIG</div>
            <div className="col-span-2">OPTIMIZED</div>
            <div className="col-span-2">DATE</div>
            <div className="col-span-1 text-right">ACTIONS</div>
          </div>
          {items.map((it) => {
            const orig = it?.analysis?.ats_score ?? 0;
            const opt = it?.new_ats_score ?? 0;
            return (
              <div
                key={it.scan_id}
                className="grid grid-cols-12 px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#FAFAFA] items-center"
                data-testid={`history-row-${it.scan_id}`}
              >
                <div className="col-span-5">
                  <Link to={`/scan/${it.scan_id}`} className="font-medium hover:underline">
                    {it.job_title || "Untitled role"}
                  </Link>
                  {it.company && <div className="text-xs text-muted-foreground">{it.company}</div>}
                </div>
                <div className="col-span-2 font-mono text-sm" style={{ color: scoreColor(orig) }}>{orig}</div>
                <div className="col-span-2 font-mono text-sm" style={{ color: scoreColor(opt) }}>{opt}</div>
                <div className="col-span-2 font-mono text-xs text-muted-foreground">
                  {new Date(it.created_at).toLocaleDateString()}
                </div>
                <div className="col-span-1 flex justify-end gap-1">
                  <Link
                    to={`/scan/${it.scan_id}`}
                    className="p-2 hover:bg-black hover:text-white border border-border"
                    data-testid={`view-${it.scan_id}`}
                    aria-label="View"
                  >
                    <ArrowRight size={14} weight="bold" />
                  </Link>
                  <button
                    onClick={() => remove(it.scan_id)}
                    className="p-2 hover:bg-[#FF3B30] hover:text-white hover:border-[#FF3B30] border border-border"
                    data-testid={`delete-${it.scan_id}`}
                    aria-label="Delete"
                  >
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
