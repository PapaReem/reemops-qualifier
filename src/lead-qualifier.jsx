import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#0a0a0a", surface: "#111", border: "#222",
  accent: "#e8ff47", accent2: "#ff6b35",
  text: "#f0f0f0", muted: "#555",
  green: "#39ff8f", red: "#ff3b5c", yellow: "#ffc947",
};

function scoreColor(s) { return s >= 7 ? COLORS.green : s >= 4 ? COLORS.yellow : COLORS.red; }
function verdictColor(v) { return v === "PURSUE" ? COLORS.green : v === "MAYBE" ? COLORS.yellow : COLORS.red; }
function checkIcon(v) { return v === true ? "✅" : v === false ? "❌" : "❓"; }

function parseSpreadsheet(text) {
  return text.trim().split("\n").map(line => {
    const parts = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ""));
    return { id: Date.now() + Math.random(), name: parts[0] || "", url: parts[1] || "", email: parts[2] || "", firstName: parts[3] || "", lastName: parts[4] || "" };
  }).filter(r => r.name);
}

async function auditLead(lead, apiKey = "") {
  const prompt = `You are a lead qualification specialist for a consultant who sells a full client acquisition system to service-based businesses. The offer includes: landing pages, email sequences, automations, funnel creation, VSLs, lead qualification systems, and a Google review agent (future add-on).

Current niche focus: roofing companies, but the system works for any local service-based business.

Research this company using web search:
Company: ${lead.name}
Website/URL: ${lead.url || "not provided"}

Search for: their website, Facebook/Instagram presence, Meta/Facebook Ad Library (${lead.name}), Google reviews, and how they currently capture and follow up with leads.

Score 1-10 on how much they need this offer:
- Running paid ads with no dedicated landing page = +3 (biggest signal, spending money into a leak)
- Homepage is the only destination for traffic = +2
- No visible follow-up system (no SMS, no email, no confirmation page) = +2
- Active business with 10+ reviews = +1 (they care about growth)
- Obvious funnel gap (no VSL, no qualification, no automation) = +2

problem_angle: 2 sentences MAX. Written from the owner's perspective. What is quietly costing them money right now. Plain language. No jargon. No HTML. No citation tags. Should sound like a doctor who just reviewed their X-ray. Reference something specific you found about them.

your_fix: Exactly 3 objects mapping their problem to a specific piece of the offer. Use these tags only: "no dedicated landing page" / "no lead capture system" / "no email sequence" / "no automation in place" / "no VSL" / "no follow-up system" / "no ad funnel" / "no review system". Each action is one short sentence describing what will specifically be built or fixed for them.

opening_line: Write the full cold email using EXACTLY this structure. Do not deviate:
"Hey [first name: ${lead.firstName || "there"}], I was looking at ${lead.name} and noticed you might be missing out on leads because of [specific problem found in one short phrase, no dashes]. I've created a full system that plugs exactly that for businesses like yours. I put together a short demo specifically for ${lead.name}. Want me to send it over? Takes about 2 minutes to watch."
Use the actual first name and company name as shown. Fill in [specific problem] with what you found. No em dashes, no long dashes anywhere.

followups: Generate all 5 follow-up emails in full. Use the real name "${lead.firstName || "there"}" and real company "${lead.name}" baked directly into each email. No placeholder tags. No dashes of any kind.

Follow-up 1 (day 3): Subject: "${lead.firstName || "there"}, still worth 2 minutes" | Body: "Wanted to make sure this didn't get buried. Short video showing exactly what [specific problem] is doing to ${lead.name} and what fixes it. No pitch. Want me to send it?"

Follow-up 2 (day 6): Subject: "This is costing you money, ${lead.firstName || "there"}" | Body: "Every week your ads send traffic to a page that wasn't built to convert, the leads that do get through don't hear back in time, and the ones that do aren't even qualified. I built a full system that turns your traffic into booked inspections for ${lead.name}. Two minute video. Want it?"

Follow-up 3 (day 9): Subject: "What roofing companies are missing" | Body: "Most roofing companies I look at have [specific problem] and never realize how much it's costing them. It shows up every time someone clicks an ad or fills out a form and just disappears. Video's ready when you are."

Follow-up 4 (day 12): Subject: "Not a sales pitch" | Body: "I know you're probably getting a lot of these. This isn't a template. I actually looked at ${lead.name} and [specific problem] stood out immediately. The video is two minutes and shows exactly what I found. If it's not relevant, no hard feelings. But if it is, it's worth the two minutes."

Follow-up 5 (day 15): Subject: "Last one, ${lead.firstName || "there"}" | Body: "I won't keep filling your inbox. If the timing's off or it's just not a fit, totally fine. But [specific problem] is still costing you jobs. If you ever want to see what I put together for ${lead.name}, it'll be here. Two minutes. No pressure."

For each follow-up, replace [specific problem] with the actual specific problem you found for this company. Keep everything else word for word.

reviews_detail: Full review breakdown: platform, count, rating, any notable themes in reviews.

Respond ONLY valid JSON no markdown:
{"score":<1-10>,"verdict":"<PURSUE|MAYBE|SKIP>","running_ads":<true|false|null>,"ads_to_homepage":<true|false|null>,"review_count":"<short e.g. 47 reviews 4.8★>","reviews_detail":"<full breakdown>","follow_up_system":"<visible|weak|none|unknown>","problem_angle":"<2 sentences max>","your_fix":[{"tag":"<tag>","action":"<sentence>"},{"tag":"<tag>","action":"<sentence>"},{"tag":"<tag>","action":"<sentence>"}],"opening_line":"<full cold email>","followups":[{"subject":"<subject>","body":"<body>"},{"subject":"<subject>","body":"<body>"},{"subject":"<subject>","body":"<body>"},{"subject":"<subject>","body":"<body>"},{"subject":"<subject>","body":"<body>"}],"skip_reason":"<if SKIP else empty>"}`;

  const res = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start === -1) throw new Error("No JSON");
  return JSON.parse(text.slice(start, end + 1));
}

// ─── Follow-up Sequences ───────────────────────────────────────────────────────
function getNoResponseEmail(step, firstName, bizName, problem) {
  const emails = [
    {
      subject: `{{first_name}}, still worth 2 minutes`,
      body: `Wanted to make sure this didn't get buried. Short video showing exactly what {{specific_problem}} is doing to {{organization_name}} and what fixes it. No pitch. Want me to send it?`
    },
    {
      subject: `This is costing you money, {{first_name}}`,
      body: `Every week your ads send traffic to a page that wasn't built to convert, the leads that do get through don't hear back in time, and the ones that do aren't even qualified. I built a full system that turns your traffic into booked inspections for {{organization_name}}. Two minute video. Want it?`
    },
    {
      subject: `What roofing companies are missing`,
      body: `Most roofing companies I look at have {{specific_problem}} and never realize how much it's costing them. It shows up every time someone clicks an ad or fills out a form and just disappears. Video's ready when you are.`
    },
    {
      subject: `Not a sales pitch`,
      body: `I know you're probably getting a lot of these. This isn't a template. I actually looked at {{organization_name}} and {{specific_problem}} stood out immediately. The video is two minutes and shows exactly what I found. If it's not relevant, no hard feelings. But if it is, it's worth the two minutes.`
    },
    {
      subject: `Last one, {{first_name}}`,
      body: `I won't keep filling your inbox. If the timing's off or it's just not a fit, totally fine. But {{specific_problem}} is still costing you jobs. If you ever want to see what I put together for {{organization_name}}, it'll be here. Two minutes. No pressure.`
    },
  ];
  return emails[step] || null;
}

function getDidntPayEmail(step, firstName, bizName, problem) {
  const emails = [
    {
      subject: `Still thinking it over, ${firstName}?`,
      body: `Hey ${firstName}, saw you checked out the breakdown for ${bizName}. If something wasn't clear or you had questions about what's included, just reply here and I'll clear it up. Otherwise the link's still live whenever you're ready.\n\n[Stripe link]`
    },
    {
      subject: `What's usually holding people back`,
      body: `Most of the time when someone watches the video and doesn't move forward it's one of two things. Either the timing's off or they're not sure if it'll work for their specific situation. Both are fair. If it's timing, no pressure. If it's the second one, that's exactly what the system is built for. ${bizName} has the leak and the fix is straightforward. Link's below.\n\n[Stripe link]`
    },
    {
      subject: `${firstName}, the leak's still there`,
      body: `While you're thinking it over, leads are still coming in and some are slipping out. The video showed you exactly where. The fix is ready. If you want to move forward it's one step.\n\n[Stripe link]`
    },
    {
      subject: `Quick question`,
      body: `Real question. Was there something in the video that didn't add up for ${bizName}? If the diagnosis was off, I want to know. If it was accurate and you're just not ready, that's fine too. Either way, reply and let me know. I'd rather know than guess.`
    },
    {
      subject: `Life gets busy, still here when you're ready`,
      body: `No guilt. Sometimes the timing just isn't right and the inbox piles up. If that's where you're at, I get it. The breakdown for ${bizName} is still accurate and the offer hasn't changed. Whenever you're ready, the link's here.\n\n[Stripe link]`
    },
    {
      subject: `One option if budget's the hold-up, ${firstName}`,
      body: `If the investment's the reason you haven't pulled the trigger, I have a split option. Half now, half when the first piece is delivered. Same work, same result, just two smaller steps instead of one. If that makes it easier to move forward, reply and I'll send you the link for that instead.`
    },
    {
      subject: `Last one, ${firstName}`,
      body: `This is the last one. If you're ready the link's below. If the timing still isn't right, no hard feelings. You know where to find me when it is.\n\n[Stripe link]`
    },
  ];
  return emails[step] || null;
}

// ─── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ entry, index, onRetry, onSaveNote, onCopy, onDelete, onSaveFollowupStep, copied }) {
  const { lead, result, error, loading } = entry;
  const [open, setOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [noteText, setNoteText] = useState(entry.note || "");
  const [noteSaved, setNoteSaved] = useState(false);
  const [noRespStep, setNoRespStep] = useState(entry.noRespStep || 0);
  const [didntPayStep, setDidntPayStep] = useState(entry.didntPayStep || 0);
  const [followupEmail, setFollowupEmail] = useState(null);
  const [followupCopied, setFollowupCopied] = useState(false);

  const firstName = lead.name.split(" ")[0] || lead.name;
  const bizName = result?.opening_line?.match(/specifically for (.+?)\./)?.[1] || lead.name;
  // Use the first fix tag as a short problem label e.g. "no dedicated landing page" or "weak follow-up"
  const fixTag = result?.your_fix?.[0]?.tag || "";
  const fixAction = result?.your_fix?.[0]?.action || "";
  const problem = fixTag ? `${fixTag.toLowerCase()}` : "gaps in your current funnel";

  function generateNoResp() {
    const email = getNoResponseEmail(noRespStep, firstName, bizName, problem);
    if (!email) return;
    setFollowupEmail({ ...email, type: "No Response", step: noRespStep + 1, total: 5 });
    const next = noRespStep + 1;
    setNoRespStep(next);
    onSaveFollowupStep(index, { noRespStep: next, didntPayStep });
  }

  function generateDidntPay() {
    const email = getDidntPayEmail(didntPayStep, firstName, bizName, problem);
    if (!email) return;
    setFollowupEmail({ ...email, type: "Didn't Pay", step: didntPayStep + 1, total: 7 });
    const next = didntPayStep + 1;
    setDidntPayStep(next);
    onSaveFollowupStep(index, { noRespStep, didntPayStep: next });
  }

  function copyFollowup() {
    if (!followupEmail) return;
    const text = `Subject: ${followupEmail.subject}\n\n${followupEmail.body}`;
    navigator.clipboard.writeText(text).then(() => {
      setFollowupCopied(true);
      setTimeout(() => setFollowupCopied(false), 1500);
    });
  }

  function saveNote() {
    onSaveNote(index, noteText);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  }

  const s = {
    card: { border: `1px solid ${COLORS.border}`, marginBottom: 8, overflow: "hidden" },
    header: { display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", background: COLORS.surface, cursor: loading ? "default" : "pointer", userSelect: "none" },
    body: { padding: "16px 18px", borderTop: `1px solid ${COLORS.border}` },
    sectionLabel: { fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 },
    divider: { border: "none", borderTop: `1px solid ${COLORS.border}`, margin: "12px 0" },
  };

  if (loading) return (
    <div style={s.card}>
      <div style={{ ...s.header, cursor: "default" }}>
        <div className="spin" style={{ width: 14, height: 14, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: "50%", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: COLORS.muted }}>Auditing <strong style={{ color: COLORS.text }}>{lead.name}</strong>… <span style={{ color: COLORS.muted, fontSize: 11 }}>(this may take 10-20s)</span></span>
      </div>
    </div>
  );

  if (error) return (
    <div style={s.card}>
      <div style={{ ...s.header, cursor: "default" }}>
        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 48, textAlign: "center", padding: "2px 8px", border: `1px solid ${COLORS.red}`, color: COLORS.red, fontFamily: "Georgia,serif" }}>—</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{lead.name}</span>
        <span style={{ fontSize: 10, padding: "3px 10px", border: `1px solid ${COLORS.red}`, color: COLORS.red, letterSpacing: "0.1em", textTransform: "uppercase" }}>Error</span>
        <button onClick={() => onRetry(index)} style={{ background: "none", border: `1px solid ${COLORS.red}`, color: COLORS.red, fontFamily: "inherit", fontSize: 11, padding: "4px 12px", cursor: "pointer" }}>↺ Retry</button>
        <button onClick={() => onDelete(index)} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontFamily: "inherit", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );

  if (!result) return null;

  const sc = scoreColor(result.score);
  const vc = verdictColor(result.verdict);
  const fi = result.follow_up_system === "visible" ? "✅" : result.follow_up_system === "none" ? "❌" : "⚠️";

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={{ ...s.header, background: open ? "#161616" : COLORS.surface }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 48, textAlign: "center", padding: "2px 8px", border: `1px solid ${sc}`, color: sc, fontFamily: "Georgia,serif" }}>{result.score}/10</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{lead.name}</span>
        <span style={{ fontSize: 10, padding: "3px 10px", border: `1px solid ${vc}`, color: vc, background: `${vc}18`, letterSpacing: "0.1em", textTransform: "uppercase" }}>{result.verdict}</span>
        <span style={{ display: "flex", gap: 6, fontSize: 12, marginLeft: 4 }}>
          <span title="Ads">{checkIcon(result.running_ads)}</span>
          <span title="Ads→HP">{checkIcon(result.ads_to_homepage)}</span>
          <span title="Follow-up">{fi}</span>
        </span>
        {entry.note && <span style={{ fontSize: 10, color: COLORS.accent, border: `1px solid rgba(232,255,71,0.3)`, padding: "1px 6px" }}>note</span>}
        <button onClick={e => { e.stopPropagation(); onDelete(index); }} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontFamily: "inherit", fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>✕</button>
        <span style={{ fontSize: 14, color: COLORS.muted, marginLeft: 4, display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </div>

      {/* Body */}
      {open && (
        <div style={s.body}>

          {result.verdict === "SKIP" && result.skip_reason && (
            <div style={{ fontSize: 12, color: COLORS.red, padding: "8px 12px", border: `1px solid rgba(255,59,92,0.2)`, background: "rgba(255,59,92,0.05)", marginBottom: 12 }}>
              Skip: {result.skip_reason}
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", marginBottom: 14, fontSize: 12 }}>
            <div><span style={{ color: COLORS.muted }}>Ads running: </span><span>{result.running_ads === true ? "Yes" : result.running_ads === false ? "No" : "Unknown"}</span></div>
            <div><span style={{ color: COLORS.muted }}>Ads → homepage: </span><span>{result.ads_to_homepage === true ? "Yes — leak" : result.ads_to_homepage === false ? "No — has LP" : "Unknown"}</span></div>
            <div><span style={{ color: COLORS.muted }}>Follow-up: </span><span>{result.follow_up_system || "Unknown"}</span></div>

            {/* Reviews with dropdown */}
            <div>
              <span style={{ color: COLORS.muted }}>Reviews: </span>
              <span>{result.review_count || "Unknown"}</span>
              {result.reviews_detail && (
                <span
                  onClick={e => { e.stopPropagation(); setReviewsOpen(o => !o); }}
                  style={{ marginLeft: 6, fontSize: 10, color: COLORS.accent, cursor: "pointer", border: `1px solid rgba(232,255,71,0.3)`, padding: "1px 5px" }}
                >{reviewsOpen ? "▴" : "▾"}</span>
              )}
              {reviewsOpen && result.reviews_detail && (
                <div style={{ marginTop: 6, fontSize: 11, color: COLORS.muted, lineHeight: 1.6, background: "rgba(232,255,71,0.03)", border: `1px solid rgba(232,255,71,0.1)`, padding: "8px 10px" }}>
                  {result.reviews_detail}
                </div>
              )}
            </div>
          </div>

          {result.verdict !== "SKIP" && (
            <>
              <hr style={s.divider} />
              {/* Problem angle */}
              <div style={{ ...s.sectionLabel, color: COLORS.accent2 }}>Problem angle</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, borderLeft: `2px solid ${COLORS.accent2}`, padding: "10px 12px", background: "rgba(255,107,53,0.05)", marginBottom: 14 }}>
                {result.problem_angle}
              </div>

              {/* Your fix */}
              <div style={{ ...s.sectionLabel, color: COLORS.accent }}>Your fix</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {(result.your_fix || []).map((f, k) => (
                  <div key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12 }}>
                    <span style={{ background: "rgba(232,255,71,0.1)", color: COLORS.accent, fontSize: 10, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0, border: `1px solid rgba(232,255,71,0.2)` }}>{f.tag}</span>
                    <span style={{ color: COLORS.muted, lineHeight: 1.5 }}>{f.action}</span>
                  </div>
                ))}
              </div>

              <hr style={s.divider} />
              {/* Opener */}
              <div style={{ ...s.sectionLabel, color: COLORS.muted }}>Opener</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, borderLeft: `2px solid ${COLORS.accent}`, padding: "10px 12px", background: "rgba(232,255,71,0.03)", marginBottom: 8 }}>
                {result.opening_line}
              </div>
              <button onClick={() => onCopy(result.opening_line, `op-${index}`)} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 12px", cursor: "pointer", marginBottom: 14 }}>
                {copied === `op-${index}` ? "Copied!" : "Copy opener"}
              </button>
            </>
          )}

          <hr style={s.divider} />
          {/* Follow-up buttons */}
          <div style={{ ...s.sectionLabel, color: COLORS.muted }}>Follow-up</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={generateNoResp}
              disabled={noRespStep >= 5}
              style={{ background: noRespStep >= 5 ? "none" : "rgba(232,255,71,0.08)", border: `1px solid ${noRespStep >= 5 ? COLORS.border : "rgba(232,255,71,0.3)"}`, color: noRespStep >= 5 ? COLORS.muted : COLORS.accent, fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 12px", cursor: noRespStep >= 5 ? "not-allowed" : "pointer", opacity: noRespStep >= 5 ? 0.4 : 1 }}
            >
              No Response {noRespStep > 0 ? `(${noRespStep}/5)` : ""}
            </button>
            <button
              onClick={generateDidntPay}
              disabled={didntPayStep >= 7}
              style={{ background: didntPayStep >= 7 ? "none" : "rgba(255,107,53,0.08)", border: `1px solid ${didntPayStep >= 7 ? COLORS.border : "rgba(255,107,53,0.3)"}`, color: didntPayStep >= 7 ? COLORS.muted : COLORS.accent2, fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 12px", cursor: didntPayStep >= 7 ? "not-allowed" : "pointer", opacity: didntPayStep >= 7 ? 0.4 : 1 }}
            >
              Didn't Pay {didntPayStep > 0 ? `(${didntPayStep}/7)` : ""}
            </button>
          </div>

          {/* Generated follow-up email */}
          {followupEmail && (
            <div style={{ border: `1px solid ${followupEmail.type === "No Response" ? "rgba(232,255,71,0.2)" : "rgba(255,107,53,0.2)"}`, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: followupEmail.type === "No Response" ? "rgba(232,255,71,0.05)" : "rgba(255,107,53,0.05)", borderBottom: `1px solid ${followupEmail.type === "No Response" ? "rgba(232,255,71,0.15)" : "rgba(255,107,53,0.15)"}` }}>
                <span style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: followupEmail.type === "No Response" ? COLORS.accent : COLORS.accent2 }}>{followupEmail.type} — Email {followupEmail.step} of {followupEmail.total}</span>
                <button onClick={copyFollowup} style={{ background: "none", border: "none", color: COLORS.muted, fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}>
                  {followupCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>Subject: <span style={{ color: COLORS.text }}>{followupEmail.subject}</span></div>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: COLORS.text, whiteSpace: "pre-wrap" }}>{followupEmail.body}</div>
              </div>
            </div>
          )}

          <hr style={s.divider} />
          {/* Notes */}
          <div style={{ ...s.sectionLabel, color: COLORS.muted }}>Notes</div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add notes about this lead…"
            style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: "inherit", fontSize: 12, padding: "9px 11px", outline: "none", resize: "vertical", minHeight: 72, marginBottom: 8 }}
          />
          <button onClick={saveNote} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 12px", cursor: "pointer" }}>
            {noteSaved ? "Saved ✓" : "Save note"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── History Panel ─────────────────────────────────────────────────────────────
function HistoryPanel({ history, onRestore, onAppend, onMerge, onClear }) {
  const [open, setOpen] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [selected, setSelected] = useState([]);

  if (history.length === 0) return null;

  function toggleSelect(bi) {
    setSelected(prev => prev.includes(bi) ? prev.filter(i => i !== bi) : [...prev, bi]);
  }

  function handleMerge() {
    if (selected.length < 2) return;
    onMerge(selected);
    setSelected([]);
  }

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", background: COLORS.surface, cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: COLORS.muted }}>History</span>
          <span style={{ fontSize: 10, background: "rgba(232,255,71,0.1)", color: COLORS.accent, border: `1px solid rgba(232,255,71,0.2)`, padding: "1px 7px" }}>{history.length} batch{history.length !== 1 ? "es" : ""}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={e => { e.stopPropagation(); onClear(); }} style={{ background: "none", border: "none", color: COLORS.muted, fontFamily: "inherit", fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>Clear all</button>
          <span style={{ fontSize: 14, color: COLORS.muted, display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
          {history.map((batch, bi) => {
            const pursue  = batch.entries.filter(e => e.result?.verdict === "PURSUE").length;
            const maybe   = batch.entries.filter(e => e.result?.verdict === "MAYBE").length;
            const skip    = batch.entries.filter(e => e.result?.verdict === "SKIP").length;
            const pending = batch.entries.filter(e => !e.result && !e.error).length;
            const errors  = batch.entries.filter(e => e.error).length;
            const isExp   = expandedBatch === bi;
            const isSel   = selected.includes(bi);

            return (
              <div key={bi} style={{ borderBottom: `1px solid ${COLORS.border}`, background: isSel ? "rgba(232,255,71,0.04)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", flexWrap: "wrap" }}>
                  {/* Checkbox */}
                  <div
                    onClick={e => { e.stopPropagation(); toggleSelect(bi); }}
                    style={{ width: 14, height: 14, border: `1px solid ${isSel ? COLORS.accent : COLORS.border}`, background: isSel ? COLORS.accent : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {isSel && <span style={{ fontSize: 9, color: "#000", fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>

                  {/* Batch info — clickable to expand */}
                  <span onClick={() => setExpandedBatch(isExp ? null : bi)} style={{ fontSize: 12, color: COLORS.muted, flex: 1, minWidth: 100, cursor: "pointer" }}>{batch.date} — {batch.entries.length} leads</span>
                  <span style={{ fontSize: 11, color: COLORS.green }}>{pursue} pursue</span>
                  <span style={{ fontSize: 11, color: COLORS.yellow }}>{maybe} maybe</span>
                  <span style={{ fontSize: 11, color: COLORS.red }}>{skip} skip</span>
                  {errors > 0 && <span style={{ fontSize: 11, color: COLORS.red, opacity: 0.6 }}>{errors} err</span>}
                  {pending > 0 && <span style={{ fontSize: 11, color: COLORS.muted }}>{pending} pending</span>}
                  <button onClick={e => { e.stopPropagation(); onRestore(batch, bi); }} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontFamily: "inherit", fontSize: 10, padding: "3px 10px", cursor: "pointer", letterSpacing: "0.08em" }}>Restore</button>
                  <button onClick={e => { e.stopPropagation(); onAppend(bi); }} style={{ background: "rgba(232,255,71,0.08)", border: `1px solid rgba(232,255,71,0.2)`, color: COLORS.accent, fontFamily: "inherit", fontSize: 10, padding: "3px 10px", cursor: "pointer", letterSpacing: "0.08em" }}>+ Append</button>
                  <span onClick={() => setExpandedBatch(isExp ? null : bi)} style={{ fontSize: 12, color: COLORS.muted, display: "inline-block", transform: isExp ? "rotate(180deg)" : "none", cursor: "pointer" }}>▾</span>
                </div>

                {isExp && (
                  <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "8px 16px 12px" }}>
                    {batch.entries.map((e, ei) => {
                      const vc = e.result ? verdictColor(e.result.verdict) : COLORS.muted;
                      const sc = e.result ? scoreColor(e.result.score) : COLORS.muted;
                      return (
                        <div key={ei} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: ei < batch.entries.length - 1 ? `1px solid ${COLORS.border}` : "none", fontSize: 12 }}>
                          <span style={{ color: sc, minWidth: 36, fontFamily: "Georgia,serif", fontWeight: 700 }}>{e.result ? `${e.result.score}/10` : e.error ? "err" : "—"}</span>
                          <span style={{ flex: 1 }}>{e.lead.name}</span>
                          <span style={{ color: vc, fontSize: 10, letterSpacing: "0.08em" }}>{e.result ? e.result.verdict : e.error ? "ERROR" : "pending"}</span>
                          {e.note && <span style={{ fontSize: 10, color: COLORS.accent, border: `1px solid rgba(232,255,71,0.3)`, padding: "1px 5px" }}>note</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Merge bar */}
          {selected.length >= 2 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${COLORS.border}`, background: "rgba(232,255,71,0.06)" }}>
              <span style={{ fontSize: 11, color: COLORS.accent }}>{selected.length} batches selected</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSelected([])} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontFamily: "inherit", fontSize: 10, padding: "4px 12px", cursor: "pointer", letterSpacing: "0.08em" }}>Cancel</button>
                <button onClick={handleMerge} style={{ background: COLORS.accent, border: "none", color: "#000", fontFamily: "inherit", fontWeight: 700, fontSize: 10, padding: "4px 14px", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>Merge →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
function buildChainSentence(fixes, bizName) {
  const map = {
    "no dedicated landing page": "your ads send traffic to a page that wasn't built to convert",
    "no lead capture system":    "leads hit your site with no way to capture their information",
    "no email sequence":         "there's no follow-up sequence running after someone submits",
    "no automation in place":    "nothing fires automatically when a lead comes in",
    "no follow-up system":       "leads don't hear back fast enough to stay interested",
    "no ad funnel":              "your ad spend isn't being sent through a funnel built to close",
    "no VSL":                    "there's nothing selling the value before they decide to book",
    "no review system":          "you're not collecting reviews consistently after every job",
  };

  const f = (fixes || []).slice(0, 3).map(f => map[f.tag] || f.tag.toLowerCase());

  if (f.length === 0) return "";
  if (f.length === 1) return `Every week ${f[0]}, you're leaving jobs on the table. I built a full system that turns your traffic into booked inspections for ${bizName}. Two minute video. Want it?`;
  if (f.length === 2) return `Every week ${f[0]} and ${f[1]}, you're leaving jobs on the table. I built a full system that turns your traffic into booked inspections for ${bizName}. Two minute video. Want it?`;

  return `Every week ${f[0]}, the leads that do get through ${f[1]}, and the ones that do aren't even closing properly because ${f[2]}. I built a full system that turns your traffic into booked inspections for ${bizName}. Two minute video. Want it?`;
}

export default function App() {
  const [tab, setTab] = useState("manual"); // manual | paste
  const [nameInput, setNameInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [firstNameInput, setFirstNameInput] = useState("");
  const [lastNameInput, setLastNameInput] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [leads, setLeads] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [apiKey, setApiKey] = useState(() => { try { return localStorage.getItem("lq_apikey") || ""; } catch { return ""; } });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [useApiKey, setUseApiKey] = useState(() => { try { return localStorage.getItem("lq_useapikey") === "true"; } catch { return false; } });
  const [activeBatchIndex, setActiveBatchIndex] = useState(null); // which batch is currently loaded
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lq_history") || "[]"); } catch { return []; }
  });

  // Persist current results back into history whenever they change (if a batch is active)
  function persistResults(updatedResults, batchIndex) {
    if (batchIndex === null) return;
    setHistory(prev => {
      const updated = prev.map((b, i) => i === batchIndex ? { ...b, entries: updatedResults } : b);
      try { localStorage.setItem("lq_history", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  function saveHistory(entries) {
    const batch = {
      id: Date.now(),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      entries,
    };
    const updated = [batch, ...history].slice(0, 20);
    setHistory(updated);
    setActiveBatchIndex(0); // new batch is always at index 0
    try { localStorage.setItem("lq_history", JSON.stringify(updated)); } catch {}
  }

  function appendToBatch(batchIndex, newEntries) {
    setHistory(prev => {
      const updated = prev.map((b, i) => i === batchIndex ? { ...b, entries: [...b.entries, ...newEntries] } : b);
      try { localStorage.setItem("lq_history", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  function clearHistory() {
    setHistory([]);
    try { localStorage.removeItem("lq_history"); } catch {}
  }

  function mergeBatches(indices) {
    // Merge all selected batches into the earliest one (highest index = oldest)
    const sorted = [...indices].sort((a, b) => a - b);
    const targetIdx = sorted[0];
    const merged = sorted.flatMap(i => history[i].entries);
    const targetBatch = { ...history[targetIdx], entries: merged, date: history[targetIdx].date + " (merged)" };
    const updated = history.map((b, i) => i === targetIdx ? targetBatch : b).filter((_, i) => !sorted.slice(1).includes(i));
    setHistory(updated);
    try { localStorage.setItem("lq_history", JSON.stringify(updated)); } catch {}
    // If any of the merged batches was active, update activeBatchIndex
    setActiveBatchIndex(null);
    setResults([]);
  }

  function addLead() {
    if (!nameInput.trim()) return;
    setLeads(p => [...p, { id: Date.now(), name: nameInput.trim(), url: urlInput.trim(), email: emailInput.trim(), firstName: firstNameInput.trim(), lastName: lastNameInput.trim() }]);
    setNameInput(""); setUrlInput(""); setEmailInput(""); setFirstNameInput(""); setLastNameInput("");
  }

  function removeLead(id) { setLeads(p => p.filter(l => l.id !== id)); }

  function parsePaste() {
    const parsed = parseSpreadsheet(pasteText);
    setLeads(parsed);
    setPasteText("");
    setTab("manual");
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function deleteResult(index) {
    setResults(prev => {
      const u = prev.filter((_, i) => i !== index);
      persistResults(u, activeBatchIndex);
      return u;
    });
  }

  function saveFollowupStep(index, steps) {
    setResults(prev => {
      const u = [...prev];
      u[index] = { ...u[index], ...steps };
      persistResults(u, activeBatchIndex);
      return u;
    });
  }

  function saveNote(index, note) {
    setResults(prev => {
      const u = [...prev];
      u[index] = { ...u[index], note };
      persistResults(u, activeBatchIndex);
      return u;
    });
  }

  async function retryResult(index) {
    await sleep(3000);
    setResults(prev => { const u=[...prev]; u[index]={...u[index],error:false,loading:true}; return u; });
    try {
      const result = await auditLead(results[index].lead, useApiKey ? apiKey : "");
      setResults(prev => {
        const u=[...prev];
        u[index]={...u[index],lead:results[index].lead,result,error:false,loading:false};
        persistResults(u, activeBatchIndex);
        return u;
      });
    } catch {
      setResults(prev => {
        const u=[...prev];
        u[index]={...u[index],lead:results[index].lead,result:null,error:true,loading:false};
        persistResults(u, activeBatchIndex);
        return u;
      });
    }
  }

  function deleteResult(index) {
    setResults(prev => {
      const u = prev.filter((_, i) => i !== index);
      persistResults(u, activeBatchIndex);
      return u;
    });
  }

  const cancelRef = useRef(false);

  function cancelAudit() {
    cancelRef.current = true;
    setLoading(false);
    // Mark all still-loading entries as cancelled errors so they show retry
    setResults(prev => {
      const u = prev.map(r => r.loading ? { ...r, loading: false, error: true } : r);
      persistResults(u, activeBatchIndex);
      return u;
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function auditWithRetry(lead, retries = 3, delay = 8000) {
    for (let i = 0; i < retries; i++) {
      if (cancelRef.current) throw new Error("cancelled");
      try {
        return await auditLead(lead, useApiKey ? apiKey : "");
      } catch (e) {
        if (e.message === "cancelled") throw e;
        if (i === retries - 1) throw e;
        await sleep(delay * (i + 1));
      }
    }
  }

  async function runAudit(appendToBatchIdx = null) {
    if (leads.length === 0) return;
    cancelRef.current = false;
    setLoading(true);

    const toAudit = [...leads];
    setLeads([]);

    // If appending, start with existing results already loaded
    const baseResults = appendToBatchIdx !== null ? [...results] : [];
    if (appendToBatchIdx === null) setResults([]);

    const newEntries = [];

    for (let i = 0; i < toAudit.length; i++) {
      if (cancelRef.current) break;
      const lead = toAudit[i];
      setResults(prev => [...prev, { lead, result: null, error: false, loading: true, note: "" }]);

      if (i > 0) await sleep(i % 5 === 0 ? 15000 : 5000);

      try {
        const result = await auditWithRetry(lead);
        const entry = { lead, result, error: false, loading: false, note: "" };
        newEntries.push(entry);
        setResults(prev => {
          const u=[...prev];
          const idx=u.findIndex(r=>r.lead.id===lead.id);
          if(idx!==-1) u[idx]=entry;
          // Persist immediately after each result
          const targetIdx = appendToBatchIdx !== null ? appendToBatchIdx : 0;
          if (appendToBatchIdx !== null) {
            // Update the existing batch with all entries so far
            setHistory(ph => {
              const updated = ph.map((b, bi) => bi === appendToBatchIdx ? { ...b, entries: [...baseResults, ...u.filter(r => !baseResults.find(br => br.lead.id === r.lead.id))] } : b);
              try { localStorage.setItem("lq_history", JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
          return u;
        });
      } catch {
        const entry = { lead, result: null, error: true, loading: false, note: "" };
        newEntries.push(entry);
        setResults(prev => {
          const u=[...prev];
          const idx=u.findIndex(r=>r.lead.id===lead.id);
          if(idx!==-1) u[idx]=entry;
          return u;
        });
      }
    }

    if (appendToBatchIdx !== null) {
      // Final persist of appended batch
      setResults(prev => {
        setHistory(ph => {
          const updated = ph.map((b, bi) => bi === appendToBatchIdx ? { ...b, entries: prev } : b);
          try { localStorage.setItem("lq_history", JSON.stringify(updated)); } catch {}
          return updated;
        });
        return prev;
      });
      setActiveBatchIndex(appendToBatchIdx);
    } else {
      // New batch — save normally, activeBatchIndex set inside saveHistory
      setResults(prev => { saveHistory(prev); return prev; });
    }

    setLoading(false);
  }

  const done = results.filter(r => r.result);
  const pursue = done.filter(r => r.result.verdict === "PURSUE").length;
  const maybe  = done.filter(r => r.result.verdict === "MAYBE").length;
  const skip   = done.filter(r => r.result.verdict === "SKIP").length;

  const cs = { // common styles
    page: { background: COLORS.bg, minHeight: "100vh", padding: "28px 16px 80px", fontFamily: "'DM Mono','Courier New',monospace", color: COLORS.text },
    card: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: 20, marginBottom: 20 },
    label: { display: "block", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.muted, marginBottom: 5 },
    input: { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: "inherit", fontSize: 13, padding: "9px 11px", outline: "none", marginBottom: 0 },
    leadItem: { display: "flex", alignItems: "center", gap: 10, padding: "7px 11px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, marginBottom: 6, fontSize: 13 },
    tab: (active) => ({ background: "none", border: "none", borderBottom: active ? `2px solid ${COLORS.accent}` : "2px solid transparent", color: active ? COLORS.accent : COLORS.muted, fontFamily: "inherit", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px", cursor: "pointer" }),
  };

  return (
    <div style={cs.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.7s linear infinite; }
        input:focus, textarea:focus { border-color: #e8ff47 !important; outline: none; }
        button:hover { opacity: 0.8; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; }
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "inline-block", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.accent, border: `1px solid ${COLORS.accent}`, padding: "2px 9px", marginBottom: 10 }}>Lead Qualifier</div>
          <h1 style={{ fontFamily: "Georgia,serif", fontSize: "clamp(22px,5vw,36px)", fontWeight: 700, lineHeight: 1.05, marginBottom: 6 }}>
            Drop leads. <span style={{ color: COLORS.accent }}>Get the verdict.</span>
          </h1>
          <p style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.6 }}>Audits any service-based business. Scores their funnel, maps the fix to your offer, gives you the opener.</p>
        </div>

        {/* API Key */}
        <div style={{ border: `1px solid ${useApiKey && apiKey ? "rgba(57,255,143,0.3)" : COLORS.border}`, marginBottom: 20, padding: "12px 16px", background: useApiKey && apiKey ? "rgba(57,255,143,0.04)" : COLORS.surface }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: useApiKey && apiKey ? COLORS.green : COLORS.muted }}>
              {useApiKey && apiKey ? "Using Your API Key" : "Using Claude Usage"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {apiKey && (
                <button
                  onClick={() => {
                    const next = !useApiKey;
                    setUseApiKey(next);
                    try { localStorage.setItem("lq_useapikey", String(next)); } catch {}
                  }}
                  style={{ background: useApiKey ? "rgba(57,255,143,0.1)" : "rgba(232,255,71,0.08)", border: `1px solid ${useApiKey ? "rgba(57,255,143,0.3)" : "rgba(232,255,71,0.2)"}`, color: useApiKey ? COLORS.green : COLORS.accent, fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 12px", cursor: "pointer" }}
                >
                  {useApiKey ? "Switch to Claude Usage" : "Switch to API Key"}
                </button>
              )}
              {apiKey && <button onClick={() => setShowApiKey(o => !o)} style={{ background: "none", border: "none", color: COLORS.muted, fontFamily: "inherit", fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>{showApiKey ? "Hide" : "Change key"}</button>}
            </div>
          </div>
          {(!apiKey || showApiKey) && (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                style={{ flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: "inherit", fontSize: 12, padding: "8px 11px", outline: "none" }}
              />
              <button
                onClick={() => {
                  const k = apiKeyInput.trim();
                  if (!k) return;
                  setApiKey(k);
                  setUseApiKey(true);
                  try { localStorage.setItem("lq_apikey", k); localStorage.setItem("lq_useapikey", "true"); } catch {}
                  setApiKeySaved(true);
                  setShowApiKey(false);
                  setApiKeyInput("");
                  setTimeout(() => setApiKeySaved(false), 2000);
                }}
                style={{ background: COLORS.accent, color: "#000", border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", padding: "8px 16px", cursor: "pointer" }}
              >
                {apiKeySaved ? "Saved ✓" : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* History */}
        <HistoryPanel
          history={history}
          onRestore={(batch, bi) => { setResults(batch.entries); setActiveBatchIndex(bi); }}
          onAppend={(bi) => { setResults(history[bi].entries); setActiveBatchIndex(bi); }}
          onMerge={mergeBatches}
          onClear={clearHistory}
        />

        {/* Input card */}
        <div style={cs.card}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 16, gap: 4 }}>
            <button style={cs.tab(tab === "manual")} onClick={() => setTab("manual")}>Manual</button>
            <button style={cs.tab(tab === "paste")} onClick={() => setTab("paste")}>Paste Spreadsheet</button>
          </div>

          {tab === "manual" && (
            <>
              {leads.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  {leads.map(l => (
                    <div key={l.id} style={cs.leadItem}>
                      <span style={{ flex: 1 }}>{l.name}</span>
                      <span style={{ flex: 2, color: COLORS.muted, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url || "—"}</span>
                      <button onClick={() => removeLead(l.id)} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 17 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={cs.label}>Company Name</label>
                  <input style={cs.input} value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && document.getElementById("uf").focus()} placeholder="Smith Roofing Co." />
                </div>
                <div style={{ flex: 1.5, minWidth: 160 }}>
                  <label style={cs.label}>Website or Social URL</label>
                  <input id="uf" style={cs.input} value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && document.getElementById("ef").focus()} placeholder="smithroofing.com or @handle" />
                </div>
                <div style={{ flex: 1.5, minWidth: 160 }}>
                  <label style={cs.label}>Email</label>
                  <input id="ef" style={cs.input} value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addLead()} placeholder="owner@smithroofing.com" />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button onClick={addLead} style={{ background: "none", border: `1px dashed ${COLORS.border}`, color: COLORS.muted, fontFamily: "inherit", fontSize: 12, padding: "9px 16px", cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
                </div>
              </div>
            </>
          )}

          {tab === "paste" && (
            <div style={{ marginBottom: 12 }}>
              <label style={cs.label}>Paste from spreadsheet (Company · URL · Email · First Name · Last Name — one per line)</label>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Smith Roofing Co.\tsmithroofing.com\towner@smithroofing.com\tJohn\tSmith\nJones Roofing\tjonesroofing.com\towner@jonesroofing.com\tBob\tJones\n..."}
                style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: "inherit", fontSize: 12, padding: "10px 12px", outline: "none", resize: "vertical", minHeight: 120, marginBottom: 10 }}
              />
              <button onClick={parsePaste} disabled={!pasteText.trim()} style={{ background: COLORS.accent, color: "#000", border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", padding: "9px 18px", cursor: pasteText.trim() ? "pointer" : "not-allowed", opacity: pasteText.trim() ? 1 : 0.4 }}>
                Import Leads →
              </button>
              {leads.length > 0 && <span style={{ fontSize: 11, color: COLORS.green, marginLeft: 12 }}>✓ {leads.length} leads ready</span>}
            </div>
          )}

          {activeBatchIndex !== null && results.length > 0 && leads.length > 0 && (
            <div style={{ fontSize: 11, color: COLORS.accent, marginBottom: 8, padding: "6px 10px", background: "rgba(232,255,71,0.06)", border: `1px solid rgba(232,255,71,0.15)` }}>
              New leads will be appended to the current batch
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => runAudit(activeBatchIndex !== null && results.length > 0 ? activeBatchIndex : null)}
              disabled={leads.length === 0 || loading}
              style={{ flex: 1, background: COLORS.accent, color: "#000", border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", padding: 13, cursor: leads.length === 0 || loading ? "not-allowed" : "pointer", opacity: leads.length === 0 || loading ? 0.4 : 1, marginTop: tab === "manual" ? 0 : 8 }}
            >
              {loading ? "Auditing…" : `Audit ${leads.length > 0 ? leads.length + " " : ""}Leads →`}
            </button>
            {loading && (
              <button
                onClick={cancelAudit}
                style={{ background: "none", border: `1px solid ${COLORS.red}`, color: COLORS.red, fontFamily: "inherit", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", padding: "13px 18px", cursor: "pointer", marginTop: tab === "manual" ? 0 : 8 }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Summary */}
        {done.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.muted }}>
              <span><span style={{ color: COLORS.green, fontWeight: 700 }}>{pursue}</span> pursue</span>
              <span><span style={{ color: COLORS.yellow, fontWeight: 700 }}>{maybe}</span> maybe</span>
              <span><span style={{ color: COLORS.red, fontWeight: 700 }}>{skip}</span> skip</span>
            </div>
            <button
              onClick={() => {
                const rows = done.filter(e => e.result && e.result.verdict !== "SKIP");
                if (rows.length === 0) return;
                const headers = ["first_name", "last_name", "email", "opener", "followup_1_subject", "followup_1_body", "followup_2_subject", "followup_2_body", "followup_3_subject", "followup_3_body", "followup_4_subject", "followup_4_body", "followup_5_subject", "followup_5_body"];
                const csv = [
                  headers.join(","),
                  ...rows.map(e => {
                    const r = e.result;
                    const stripTags = s => (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
                    const followups = r.followups || [];
                    const row = [
                      e.lead.firstName || "",
                      e.lead.lastName || "",
                      e.lead.email || "",
                      stripTags(r.opening_line?.replace(/"/g, '""') || ""),
                      stripTags(followups[0]?.subject?.replace(/"/g, '""') || ""),
                      stripTags(followups[0]?.body?.replace(/"/g, '""') || ""),
                      stripTags(followups[1]?.subject?.replace(/"/g, '""') || ""),
                      stripTags(followups[1]?.body?.replace(/"/g, '""') || ""),
                      stripTags(followups[2]?.subject?.replace(/"/g, '""') || ""),
                      stripTags(followups[2]?.body?.replace(/"/g, '""') || ""),
                      stripTags(followups[3]?.subject?.replace(/"/g, '""') || ""),
                      stripTags(followups[3]?.body?.replace(/"/g, '""') || ""),
                      stripTags(followups[4]?.subject?.replace(/"/g, '""') || ""),
                      stripTags(followups[4]?.body?.replace(/"/g, '""') || ""),
                    ];
                    return row.map(v => `"${v}"`).join(",");
                  })
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `reemops-leads-${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{ background: "rgba(232,255,71,0.08)", border: `1px solid rgba(232,255,71,0.3)`, color: COLORS.accent, fontFamily: "inherit", fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 14px", cursor: "pointer" }}
            >
              Export CSV →
            </button>
          </div>
        )}

        {/* Results */}
        {results.map((entry, i) => (
          <ResultCard
            key={i}
            index={i}
            entry={entry}
            onRetry={retryResult}
            onSaveNote={saveNote}
            onCopy={copyText}
            onDelete={deleteResult}
            onSaveFollowupStep={saveFollowupStep}
            copied={copied}
          />
        ))}
      </div>
    </div>
  );
}
