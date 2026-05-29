import { useMemo } from "react";

// Escape regex metacharacters so user keywords can't break the regex.
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a single regex that matches any of the keywords on word boundaries (case-insensitive).
function buildKeywordRegex(keywords) {
  const cleaned = (keywords || [])
    .map((k) => (k || "").trim())
    .filter((k) => k.length >= 2)
    .sort((a, b) => b.length - a.length); // longer first so multi-word matches win
  if (!cleaned.length) return null;
  const pattern = cleaned.map(escapeRe).join("|");
  // Use lookarounds to approximate word boundaries while allowing punctuation
  return new RegExp(`(?<![A-Za-z0-9])(${pattern})(?![A-Za-z0-9])`, "gi");
}

/**
 * Render plain resume text with keywords highlighted inline.
 * - `addedKeywords` (green): keywords that were missing in original but now appear (new wins)
 * - `matchedKeywords` (muted blue): keywords already present and aligned with the JD
 */
export default function HighlightedResume({
  text,
  addedKeywords = [],
  matchedKeywords = [],
  testId,
  className = "",
}) {
  const segments = useMemo(() => {
    if (!text) return [];
    const addedSet = new Set((addedKeywords || []).map((k) => (k || "").toLowerCase()));
    const matchedSet = new Set((matchedKeywords || []).map((k) => (k || "").toLowerCase()));
    const allKeywords = Array.from(new Set([...addedKeywords, ...matchedKeywords])).filter(Boolean);
    const re = buildKeywordRegex(allKeywords);
    if (!re) return [{ type: "text", value: text }];

    const out = [];
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
      const matchText = m[0];
      const lower = matchText.toLowerCase();
      const kind = addedSet.has(lower) ? "added" : matchedSet.has(lower) ? "matched" : "text";
      out.push({ type: kind, value: matchText });
      last = m.index + matchText.length;
      // Avoid infinite loop on zero-width matches (shouldn't happen with our pattern)
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    if (last < text.length) out.push({ type: "text", value: text.slice(last) });
    return out;
  }, [text, addedKeywords, matchedKeywords]);

  return (
    <pre
      data-testid={testId}
      className={`font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto ${className}`}
    >
      {segments.map((s, i) => {
        if (s.type === "added") {
          return (
            <mark
              key={i}
              className="bg-[#DCFCE7] text-[#006B3C] px-0.5 rounded-none"
              style={{ boxShadow: "inset 0 -2px 0 #00C853" }}
            >
              {s.value}
            </mark>
          );
        }
        if (s.type === "matched") {
          return (
            <span
              key={i}
              className="text-[#002FA7] font-medium"
              style={{ boxShadow: "inset 0 -1px 0 rgba(0,47,167,0.3)" }}
            >
              {s.value}
            </span>
          );
        }
        return <span key={i}>{s.value}</span>;
      })}
    </pre>
  );
}
