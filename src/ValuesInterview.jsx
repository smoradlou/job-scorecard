import { useState, useRef, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";

function slugify(label) {
  return (
    String(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "criterion"
  );
}

function withDedupedKeys(criteria) {
  const seen = new Map();
  return criteria.map((c) => {
    const base = slugify(c.label);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return { ...c, key: count === 1 ? base : `${base}-${count}` };
  });
}

const inputStyle = {
  background: "var(--cc-bg)",
  border: "1px solid var(--cc-border)",
  borderRadius: 8,
  color: "var(--cc-text)",
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
  padding: 10,
};

export default function ValuesInterview({ existingCriteria, onComplete, onCancel }) {
  const [phase, setPhase] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesizeError, setSynthesizeError] = useState("");
  const [draftCriteria, setDraftCriteria] = useState([]);
  const [summary, setSummary] = useState("");
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    setChatError("");
    try {
      const response = await fetch("/api/values-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setChatError((err && err.message) || "Couldn't reach the interviewer. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const buildScorecard = async () => {
    setIsSynthesizing(true);
    setSynthesizeError("");
    try {
      const response = await fetch("/api/values-synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
      setDraftCriteria(data.criteria.map((c) => ({ ...c, weight: c.weight || 3 })));
      setSummary(data.summary || "");
      setPhase("reviewing");
    } catch (err) {
      setSynthesizeError((err && err.message) || "Couldn't build your scorecard from that. Try again.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const updateRow = (index, patch) =>
    setDraftCriteria(withDedupedKeys(draftCriteria.map((c, i) => (i === index ? { ...c, ...patch } : c))));

  const removeRow = (index) => setDraftCriteria(draftCriteria.filter((_, i) => i !== index));

  const addRow = () =>
    setDraftCriteria(withDedupedKeys([...draftCriteria, { key: "", label: "", hint: "", weight: 3 }]));

  const canConfirm = draftCriteria.length > 0 && draftCriteria.every((c) => c.label.trim());

  const confirm = () => onComplete(withDedupedKeys(draftCriteria));

  return (
    <div style={{ minHeight: "100vh", background: "var(--cc-bg)", color: "var(--cc-text)", fontFamily: "'Georgia', serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--cc-accent)", fontFamily: "system-ui, sans-serif", fontWeight: 600 }}>
            Career Compass
          </div>
          <h1 style={{ fontSize: 26, margin: "6px 0 4px", fontWeight: 500, lineHeight: 1.15 }}>
            {phase === "chat" ? "What matters to you in your next job?" : "Here's what I heard"}
          </h1>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: "var(--cc-muted)", maxWidth: 520, margin: 0 }}>
            {phase === "chat"
              ? "A few questions to build a scorecard around your own priorities — not a generic template."
              : "Review, rename, reweight, or add to these before they become your scorecard."}
          </p>
          {existingCriteria && onCancel && (
            <button
              onClick={onCancel}
              style={{
                marginTop: 10, background: "none", border: "none", color: "var(--cc-dim)", cursor: "pointer",
                fontFamily: "system-ui, sans-serif", fontSize: 12, textDecoration: "underline", padding: 0,
              }}
            >
              Cancel — keep my current scorecard
            </button>
          )}
        </div>

        {phase === "chat" && (
          <>
            <div style={{
              background: "var(--cc-surface)", borderRadius: 12, border: "1px solid var(--cc-border)",
              padding: "16px 18px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 12,
              minHeight: 200, maxHeight: 420, overflowY: "auto",
            }}>
              <div style={{
                alignSelf: "flex-start", maxWidth: "85%", background: "var(--cc-bg)", borderRadius: 10,
                padding: "10px 12px", fontFamily: "system-ui, sans-serif", fontSize: 13, lineHeight: 1.5,
              }}>
                Tell me about a time at work when you felt most fully yourself — most alive in what you were doing. What were you working on, and what specifically made it feel that way?
              </div>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: m.role === "user" ? "var(--cc-accent)" : "var(--cc-bg)",
                    color: m.role === "user" ? "#161B27" : "var(--cc-text)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              ))}
              {isSending && (
                <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "var(--cc-dim)" }}>Thinking…</div>
              )}
              <div ref={transcriptEndRef} />
            </div>
            {chatError && (
              <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "var(--cc-red)", marginBottom: 8 }}>
                {chatError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <textarea
                placeholder="Type your answer…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                style={{ ...inputStyle, flex: 1, minHeight: 44, resize: "vertical" }}
              />
              <button
                onClick={sendMessage}
                disabled={isSending || !input.trim()}
                style={{
                  padding: "0 18px", borderRadius: 8, border: "none",
                  background: isSending || !input.trim() ? "var(--cc-border-dim)" : "var(--cc-accent)",
                  color: isSending || !input.trim() ? "var(--cc-purple)" : "#161B27",
                  fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 700,
                  cursor: isSending || !input.trim() ? "default" : "pointer",
                }}
              >
                Send
              </button>
            </div>
            {messages.length > 0 && (
              <>
                <button
                  onClick={buildScorecard}
                  disabled={isSynthesizing}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 10, border: "1px dashed var(--cc-border-dim)",
                    background: "none", color: isSynthesizing ? "var(--cc-border-dim)" : "var(--cc-muted)",
                    fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 600,
                    cursor: isSynthesizing ? "default" : "pointer",
                  }}
                >
                  {isSynthesizing ? "Building your scorecard…" : "Build my scorecard"}
                </button>
                {synthesizeError && (
                  <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "var(--cc-red)", marginTop: 8 }}>
                    {synthesizeError}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {phase === "reviewing" && (
          <>
            {summary && (
              <div style={{
                background: "var(--cc-surface)", borderRadius: 12, border: "1px solid var(--cc-border)",
                padding: "14px 16px", marginBottom: 16, fontFamily: "system-ui, sans-serif", fontSize: 13,
                color: "var(--cc-muted)", lineHeight: 1.5,
              }}>
                {summary}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {draftCriteria.map((c, i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--cc-surface)", borderRadius: 12, border: "1px solid var(--cc-border)",
                    padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={c.label}
                      onChange={(e) => updateRow(i, { label: e.target.value })}
                      placeholder="Criterion name"
                      style={{ ...inputStyle, flex: 1, fontWeight: 600 }}
                    />
                    <button
                      onClick={() => removeRow(i)}
                      style={{ background: "none", border: "none", color: "var(--cc-dim)", cursor: "pointer", padding: 4 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <input
                    value={c.hint}
                    onChange={(e) => updateRow(i, { hint: e.target.value })}
                    placeholder="What does this measure?"
                    style={inputStyle}
                  />
                  <div>
                    <div style={{
                      display: "flex", justifyContent: "space-between", fontFamily: "system-ui, sans-serif",
                      fontSize: 12, color: "var(--cc-muted)", marginBottom: 4,
                    }}>
                      <span>Weight</span>
                      <span style={{ color: "var(--cc-accent)" }}>{c.weight}</span>
                    </div>
                    <input
                      type="range" min="1" max="5"
                      value={c.weight}
                      onChange={(e) => updateRow(i, { weight: Number(e.target.value) })}
                      style={{ width: "100%", accentColor: "var(--cc-accent)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addRow}
              style={{
                width: "100%", padding: "12px", borderRadius: 10, border: "1px dashed var(--cc-border-dim)",
                background: "none", color: "var(--cc-muted)", fontFamily: "system-ui, sans-serif", fontSize: 13,
                marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
              }}
            >
              <Plus size={14} /> Add a criterion
            </button>
            <button
              onClick={confirm}
              disabled={!canConfirm}
              style={{
                width: "100%", padding: "12px", borderRadius: 10, border: "none",
                background: canConfirm ? "var(--cc-accent)" : "var(--cc-border-dim)",
                color: canConfirm ? "#161B27" : "var(--cc-purple)",
                fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 700,
                cursor: canConfirm ? "pointer" : "default",
              }}
            >
              Use this scorecard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
