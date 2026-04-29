import { useState } from "react";

const COLORS = {
  bg: "#0a0a0a",
  surface: "#111",
  border: "#222",
  accent: "#e8ff47",
  accent2: "#ff6b35",
  text: "#f0f0f0",
  muted: "#555",
  green: "#39ff8f",
  red: "#ff3b5c",
  yellow: "#ffc947",
};

function scoreColor(score) {
  if (score >= 7) return COLORS.green;
  if (score >= 4) return COLORS.yellow;
  return COLORS.red;
}

function verdictColor(verdict) {
  if (verdict === "PURSUE") return COLORS.green;
  if (verdict === "MAYBE") return COLORS.yellow;
  return COLORS.red;
}

function checkIcon(val) {
  if (val === true) return "✅";
  if (val === false) return "❌";
  return "❓";
}

async function auditLead(lead) {
  const prompt = `You are a funnel audit specialist for a consultant who helps roofing companies fix their lead-to-booking systems.

Research this roofing company using web search:
Company: ${lead.name}
Website/URL: ${lead.url || "not provided"}

Search for:
1. Their website and what it looks like
2. Their Facebook/Instagram presence and follower count
3. Whether they're running Meta/Facebook ads (search Facebook Ad Library: ${lead.name} roofing)
4. Their Google reviews count and rating
5. What their lead capture looks like

Score them 1-10 on pursuit worthiness:
- Running ads = +3 (biggest signal)
- Ads go to homepage not landing page = +2 (opportunity)
- Weak/no follow-up visible = +2
- 10+ reviews = +1 (they're active)
- Clear funnel leak = +2

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "score": <1-10>,
  "verdict": "<PURSUE|MAYBE|SKIP>",
  "running_ads": <true|false|null>,
  "ads_to_homepage": <true|false|null>,
  "review_count": "<e.g. 47 reviews 4.8 stars or unknown>",
  "follow_up_system": "<visible|weak|none|unknown>",
  "top_leaks": ["<leak 1>", "<leak 2>", "<leak 3>"],
  "opening_line": "<1-2 sentence personalized opener referencing something specific you found — not generic>",
  "skip_reason": "<if SKIP explain why, else empty string>"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1) throw new Error("No JSON in response");
  return JSON.parse(text.slice(start, end + 1));
}

export default function App() {
  const [nameInput, setNameInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [leads, setLeads] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeLoaders, setActiveLoaders] = useState([]);
  const [copied, setCopied] = useState(null);

  function addLead() {
    if (!nameInput.trim()) return;
    setLeads((prev) => [
      ...prev,
      { id: Date.now(), name: nameInput.trim(), url: urlInput.trim() },
    ]);
    setNameInput("");
    setUrlInput("");
  }

  function removeLead(id) {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  function copyOpener(text, id) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  async function runAudit() {
    if (leads.length === 0) return;
    setLoading(true);
    setResults([]);
    const toAudit = [...leads];
    setLeads([]);

    for (const lead of toAudit) {
      setActiveLoaders((prev) => [...prev, lead.id]);
      try {
        const result = await auditLead(lead);
        setResults((prev) => [...prev, { lead, result, error: null }]);
      } catch (e) {
        setResults((prev) => [...prev, { lead, result: null, error: true }]);
      }
      setActiveLoaders((prev) => prev.filter((id) => id !== lead.id));
    }
    setLoading(false);
  }

  const s = {
    page: {
      background: COLORS.bg,
      minHeight: "100vh",
      padding: "32px 20px 60px",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      color: COLORS.text,
    },
    container: { maxWidth: 700, margin: "0 auto" },
    tag: {
      display: "inline-block",
      fontSize: 10,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: COLORS.accent,
      border: `1px solid ${COLORS.accent}`,
      padding: "3px 10px",
      marginBottom: 14,
    },
    h1: {
      fontFamily: "Georgia, serif",
      fontSize: "clamp(28px,6vw,44px)",
      fontWeight: 700,
      lineHeight: 1.05,
      marginBottom: 8,
    },
    subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 36 },
    card: {
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      padding: 24,
      marginBottom: 20,
    },
    label: {
      display: "block",
      fontSize: 10,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: COLORS.muted,
      marginBottom: 6,
    },
    input: {
      width: "100%",
      background: COLORS.bg,
      border: `1px solid ${COLORS.border}`,
      color: COLORS.text,
      fontFamily: "inherit",
      fontSize: 13,
      padding: "10px 12px",
      outline: "none",
      marginBottom: 14,
    },
    row: { display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" },
    addBtn: {
      background: "none",
      border: `1px dashed ${COLORS.border}`,
      color: COLORS.muted,
      fontFamily: "inherit",
      fontSize: 12,
      padding: "10px 18px",
      cursor: "pointer",
      letterSpacing: "0.05em",
      whiteSpace: "nowrap",
    },
    auditBtn: {
      width: "100%",
      background: COLORS.accent,
      color: "#000",
      border: "none",
      fontFamily: "inherit",
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      padding: 14,
      cursor: "pointer",
      marginTop: 8,
    },
    leadItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 12px",
      background: COLORS.bg,
      border: `1px solid ${COLORS.border}`,
      marginBottom: 8,
      fontSize: 13,
    },
    resultCard: {
      border: `1px solid ${COLORS.border}`,
      marginBottom: 20,
      overflow: "hidden",
    },
    resultHeader: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "14px 18px",
      background: COLORS.surface,
      borderBottom: `1px solid ${COLORS.border}`,
    },
    resultBody: { padding: "18px 20px" },
    checksGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginBottom: 16,
    },
    checkItem: { display: "flex", gap: 8, fontSize: 12, lineHeight: 1.4 },
    checkLabel: {
      fontSize: 10,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: COLORS.muted,
      display: "block",
      marginBottom: 2,
    },
    opener: {
      fontSize: 13,
      lineHeight: 1.7,
      background: "rgba(232,255,71,0.04)",
      borderLeft: `2px solid ${COLORS.accent}`,
      padding: "12px 14px",
      marginBottom: 10,
    },
    copyBtn: {
      background: "none",
      border: `1px solid ${COLORS.border}`,
      color: COLORS.muted,
      fontFamily: "inherit",
      fontSize: 10,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "4px 12px",
      cursor: "pointer",
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 9,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: COLORS.accent,
      marginBottom: 8,
    },
    divider: { borderTop: `1px solid ${COLORS.border}`, margin: "14px 0", border: "none" },
    loader: {
      border: `1px solid ${COLORS.border}`,
      padding: "18px 20px",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontSize: 13,
      color: COLORS.muted,
    },
  };

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.7s linear infinite; }
        input:focus { border-color: #e8ff47 !important; outline: none; }
        button:hover { opacity: 0.85; }
      `}</style>

      <div style={s.container}>
        <div style={{ marginBottom: 40 }}>
          <div style={s.tag}>Roofing Lead Qualifier</div>
          <h1 style={s.h1}>
            Drop leads. <span style={{ color: COLORS.accent }}>Get the verdict.</span>
          </h1>
          <p style={s.subtitle}>
            Add company name + website. AI audits their funnel, scores it, and gives you a personalized opener.
          </p>
        </div>

        <div style={s.card}>
          {leads.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {leads.map((l) => (
                <div key={l.id} style={s.leadItem}>
                  <span style={{ flex: 1, color: COLORS.text }}>{l.name}</span>
                  <span style={{ flex: 2, color: COLORS.muted, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.url || "—"}
                  </span>
                  <button
                    onClick={() => removeLead(l.id)}
                    style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <div style={s.row}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={s.label}>Company Name</label>
              <input
                style={s.input}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && document.getElementById("urlfield").focus()}
                placeholder="Smith Roofing Co."
              />
            </div>
            <div style={{ flex: 1.5, minWidth: 180 }}>
              <label style={s.label}>Website or Social URL</label>
              <input
                id="urlfield"
                style={s.input}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLead()}
                placeholder="smithroofing.com or @smithroofing"
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 14 }}>
              <button style={s.addBtn} onClick={addLead}>+ Add</button>
            </div>
          </div>

          <button
            style={{ ...s.auditBtn, opacity: leads.length === 0 || loading ? 0.4 : 1, cursor: leads.length === 0 || loading ? "not-allowed" : "pointer" }}
            onClick={runAudit}
            disabled={leads.length === 0 || loading}
          >
            {loading ? "Auditing…" : "Audit Leads →"}
          </button>
        </div>

        {activeLoaders.map((id) => {
          const lead = leads.find((l) => l.id === id) || { name: "Lead" };
          return (
            <div key={id} style={s.loader}>
              <div className="spin" style={{ width: 16, height: 16, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: "50%", flexShrink: 0 }} />
              <span>Auditing <strong style={{ color: COLORS.text }}>{lead.name}</strong>…</span>
            </div>
          );
        })}

        {results.map(({ lead, result, error }, i) => (
          <div key={i} style={s.resultCard}>
            {error || !result ? (
              <>
                <div style={s.resultHeader}>
                  <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 20, minWidth: 52, textAlign: "center", padding: "4px 10px", border: `2px solid ${COLORS.red}`, color: COLORS.red }}>—</div>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{lead.name}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 10px", border: `1px solid ${COLORS.red}`, color: COLORS.red }}>ERROR</div>
                </div>
                <div style={{ ...s.resultBody, fontSize: 12, color: COLORS.muted }}>Couldn't complete audit. Try again.</div>
              </>
            ) : (
              <>
                <div style={s.resultHeader}>
                  <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 22, minWidth: 52, textAlign: "center", padding: "4px 10px", border: `2px solid ${scoreColor(result.score)}`, color: scoreColor(result.score) }}>
                    {result.score}/10
                  </div>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{lead.name}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 10px", border: `1px solid ${verdictColor(result.verdict)}`, color: verdictColor(result.verdict), background: `${verdictColor(result.verdict)}11` }}>
                    {result.verdict}
                  </div>
                </div>

                <div style={s.resultBody}>
                  <div style={s.checksGrid}>
                    {[
                      { icon: checkIcon(result.running_ads), label: "Running Ads", val: result.running_ads === true ? "Yes — spending money" : result.running_ads === false ? "No ads found" : "Unknown" },
                      { icon: checkIcon(result.ads_to_homepage), label: "Ads → Homepage", val: result.ads_to_homepage === true ? "Yes — big leak" : result.ads_to_homepage === false ? "Has landing page" : "Unknown" },
                      { icon: "⭐", label: "Reviews", val: result.review_count || "Unknown" },
                      { icon: result.follow_up_system === "visible" ? "✅" : result.follow_up_system === "none" ? "❌" : "⚠️", label: "Follow-Up System", val: result.follow_up_system || "Unknown" },
                    ].map((c, j) => (
                      <div key={j} style={s.checkItem}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{c.icon}</span>
                        <div>
                          <span style={s.checkLabel}>{c.label}</span>
                          <span style={{ color: COLORS.text }}>{c.val}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {result.verdict === "SKIP" && result.skip_reason && (
                    <div style={{ fontSize: 12, color: COLORS.red, padding: "10px 14px", border: `1px solid rgba(255,59,92,0.2)`, background: "rgba(255,59,92,0.05)", marginBottom: 14 }}>
                      Skip reason: {result.skip_reason}
                    </div>
                  )}

                  {result.verdict !== "SKIP" && (
                    <>
                      <hr style={s.divider} />
                      <div style={s.sectionLabel}>Personalized Opener</div>
                      <div style={s.opener}>{result.opening_line}</div>
                      <button style={s.copyBtn} onClick={() => copyOpener(result.opening_line, i)}>
                        {copied === i ? "Copied!" : "Copy opener"}
                      </button>

                      <hr style={s.divider} />
                      <div style={s.sectionLabel}>Funnel Leaks Found</div>
                      <ul style={{ listStyle: "none", padding: 0 }}>
                        {(result.top_leaks || []).map((leak, k) => (
                          <li key={k} style={{ fontSize: 12, color: COLORS.muted, padding: "4px 0", display: "flex", gap: 8 }}>
                            <span style={{ color: COLORS.accent2, flexShrink: 0 }}>→</span>{leak}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
