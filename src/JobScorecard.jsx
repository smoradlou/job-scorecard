import { useState, useEffect, useRef } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, Sun, Moon } from "lucide-react";
import ValuesInterview from "./ValuesInterview.jsx";

const emptyJobFor = (criteriaList, n) => ({
  id: Date.now() + Math.random(),
  name: `Offer ${n}`,
  scores: Object.fromEntries(criteriaList.map((c) => [c.key, 5])),
  notes: "",
  status: "saved",
  appliedAt: null,
  statusNote: "",
});

const STATUS_OPTIONS = [
  { value: "saved",        label: "Saved" },
  { value: "applied",      label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "closed",       label: "Offer / Closed" },
];

const BOARD_COLUMNS = [
  { status: "saved",        label: "Saved",          dot: "#5A6178" },
  { status: "applied",      label: "Applied",         dot: "#8A8FD1" },
  { status: "interviewing", label: "Interviewing",    dot: "#E8B04B" },
  { status: "closed",       label: "Offer / Closed",  dot: "#6FBF73" },
];

const scoreColor = (score) => {
  if (score >= 80) return "#8A8FD1";
  if (score >= 65) return "#6FBF73";
  return "#E8B04B";
};

const daysAgo = (isoString) => {
  if (!isoString) return null;
  try {
    const ms = Date.now() - new Date(isoString).getTime();
    return isNaN(ms) ? null : Math.floor(ms / 86400000);
  } catch {
    return null;
  }
};

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem("cc-theme");
    if (saved) return saved;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

export default function JobScorecard() {
  const [criteria, setCriteria] = useState(null);
  const [interviewMode, setInterviewMode] = useState(false);
  const [weights, setWeights] = useState({});
  const [jobs, setJobs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showWeights, setShowWeights] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [jdText, setJdText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchUrlError, setFetchUrlError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [viewMode, setViewMode] = useState("ranking");
  const [theme, setTheme] = useState(getInitialTheme);
  const saveTimeout = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("cc-theme", theme); } catch {}
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/offers");
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.criteria) && data.criteria.length > 0) setCriteria(data.criteria);
          if (data.weights) setWeights(data.weights);
          if (Array.isArray(data.jobs) && data.jobs.length > 0) {
            setJobs(data.jobs.map((j) => ({
              ...j,
              status: j.status ?? "saved",
              appliedAt: j.appliedAt ?? null,
              statusNote: j.statusNote ?? "",
            })));
            setExpanded(data.jobs[0].id);
          }
        }
      } catch {
        // API server unreachable — keep local defaults.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !criteria) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/offers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ criteria, weights, jobs }),
        });
        if (!response.ok) throw new Error("Save failed");
        setSaveError("");
      } catch {
        setSaveError("Couldn't save changes — check that the API server is running.");
      }
    }, 500);
    return () => clearTimeout(saveTimeout.current);
  }, [criteria, weights, jobs, loaded]);

  const emptyJob = (n) => emptyJobFor(criteria, n);

  const completeValuesInterview = (newCriteria) => {
    setCriteria(newCriteria);
    setWeights(Object.fromEntries(newCriteria.map((c) => [c.key, c.weight ?? 3])));
    setJobs((prevJobs) =>
      prevJobs.length === 0
        ? [emptyJobFor(newCriteria, 1)]
        : prevJobs.map((j) => ({
            ...j,
            scores: { ...Object.fromEntries(newCriteria.map((c) => [c.key, 5])), ...j.scores },
          }))
    );
    setInterviewMode(false);
  };

  const fetchJDFromUrl = async () => {
    if (!jdUrl.trim()) return;
    setIsFetchingUrl(true);
    setFetchUrlError("");
    try {
      const response = await fetch("/api/fetch-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jdUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
      setJdText(data.text || "");
    } catch (err) {
      setFetchUrlError((err && err.message) || "Couldn't fetch that URL. Try pasting the text instead.");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const analyzeJD = async () => {
    if (!jdText.trim()) return;
    setIsAnalyzing(true);
    setAnalyzeError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, criteria }),
      });
      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed?.error || `Request failed (${response.status})`);
      if (!parsed.scores) throw new Error("Response was missing a scores object");

      const name =
        [parsed.role_title, parsed.company].filter(Boolean).join(" — ") ||
        `Offer ${jobs.length + 1}`;

      const newJob = {
        id: Date.now() + Math.random(),
        name,
        url: jdUrl.trim() || undefined,
        scores: { ...Object.fromEntries(criteria.map((c) => [c.key, 5])), ...parsed.scores },
        notes: parsed.rationale || "",
        status: "saved",
        appliedAt: null,
        statusNote: "",
      };

      setJobs([...jobs, newJob]);
      setExpanded(newJob.id);
      setJdText("");
      setShowAnalyze(false);
    } catch (err) {
      setAnalyzeError(
        (err && err.message) || "Couldn't parse that job description. Try again, or add manually below."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const weightedTotal = (job) => {
    const maxPossible = criteria.reduce((s, c) => s + (weights[c.key] ?? 3) * 10, 0);
    const raw = criteria.reduce((s, c) => s + (weights[c.key] ?? 3) * (job.scores[c.key] ?? 5), 0);
    return Math.round((raw / maxPossible) * 100);
  };

  const addJob = () => {
    const j = emptyJob(jobs.length + 1);
    setJobs([...jobs, j]);
    setExpanded(j.id);
  };

  const removeJob = (id) => {
    const job = jobs.find((j) => j.id === id);
    if (job?.url) {
      fetch("/api/retire-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: job.url }) });
    }
    setJobs(jobs.filter((j) => j.id !== id));
  };

  const updateJob = (id, patch) =>
    setJobs(jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const updateScore = (id, key, value) =>
    setJobs(jobs.map((j) => (j.id === id ? { ...j, scores: { ...j.scores, [key]: value } } : j)));

  const updateJobStatus = (id, newStatus) => {
    setJobs(jobs.map((j) => {
      if (j.id !== id) return j;
      const wasApplied = j.status === "applied";
      const isApplied = newStatus === "applied";
      return {
        ...j,
        status: newStatus,
        appliedAt: isApplied ? new Date().toISOString() : wasApplied ? null : j.appliedAt,
      };
    }));
  };

  const radarData = criteria
    ? criteria.map((c) => {
        const point = { criterion: c.label };
        jobs.forEach((j) => { point[j.name] = j.scores[c.key] ?? 5; });
        return point;
      })
    : [];

  const colors = ["#E8B04B", "#4FA89B", "#C97064", "#8A8FD1", "#6FBF73"];
  const ranked = criteria ? [...jobs].sort((a, b) => weightedTotal(b) - weightedTotal(a)) : [];

  if (!loaded) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--cc-bg)", display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: "system-ui, sans-serif", fontSize: 13, color: "var(--cc-dim)",
      }}>
        Loading your scorecard…
      </div>
    );
  }

  if (!criteria || interviewMode) {
    return (
      <ValuesInterview
        existingCriteria={criteria}
        onComplete={completeValuesInterview}
        onCancel={criteria ? () => setInterviewMode(false) : undefined}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--cc-bg)", color: "var(--cc-text)", fontFamily: "'Georgia', serif" }}>
      <div style={{ maxWidth: viewMode === "board" ? 980 : 760, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--cc-accent)", fontFamily: "system-ui, sans-serif", fontWeight: 600 }}>
              Career Compass
            </div>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{ background: "none", border: "none", color: "var(--cc-dim)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
          <h1 style={{ fontSize: 30, margin: "6px 0 4px", fontWeight: 500, lineHeight: 1.15 }}>
            Job offer scorecard
          </h1>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: "var(--cc-muted)", maxWidth: 520, margin: 0 }}>
            Weighted against your core values. Score each offer 0–10 per criterion, adjust weights if your priorities shift.
          </p>
          <button
            onClick={() => setInterviewMode(true)}
            style={{
              marginTop: 8, background: "none", border: "none", color: "var(--cc-dim)", cursor: "pointer",
              fontFamily: "system-ui, sans-serif", fontSize: 12, textDecoration: "underline", padding: 0,
            }}
          >
            Redefine my values
          </button>
          {saveError && (
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "var(--cc-red)", marginTop: 8 }}>
              {saveError}
            </div>
          )}
        </div>

        {/* JD analyzer panel */}
        <div style={{ background: "var(--cc-surface)", borderRadius: 12, padding: "16px 18px", marginBottom: 16, border: "1px solid var(--cc-border)" }}>
          <button
            onClick={() => setShowAnalyze(!showAnalyze)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
              background: "none", border: "none", color: "var(--cc-text)", cursor: "pointer",
              fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 600, padding: 0,
            }}
          >
            <span>Paste a job description to auto-score it</span>
            {showAnalyze ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showAnalyze && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="url"
                  placeholder="Or paste a job posting URL to fetch its text..."
                  value={jdUrl}
                  onChange={(e) => setJdUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchJDFromUrl()}
                  style={{
                    flex: 1, background: "var(--cc-bg)", border: "1px solid var(--cc-border)", borderRadius: 8,
                    color: "var(--cc-text)", fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "10px",
                  }}
                />
                <button
                  onClick={fetchJDFromUrl}
                  disabled={isFetchingUrl || !jdUrl.trim()}
                  style={{
                    padding: "0 14px", borderRadius: 8, border: "1px dashed var(--cc-border-dim)", background: "none",
                    color: isFetchingUrl || !jdUrl.trim() ? "var(--cc-border-dim)" : "var(--cc-muted)",
                    fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 600,
                    cursor: isFetchingUrl || !jdUrl.trim() ? "default" : "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {isFetchingUrl ? "Fetching..." : "Fetch text"}
                </button>
              </div>
              {fetchUrlError && (
                <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "var(--cc-red)" }}>
                  {fetchUrlError}
                </div>
              )}
              <textarea
                placeholder="Paste the full job posting here, or fetch it from a URL above..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                style={{
                  background: "var(--cc-bg)", border: "1px solid var(--cc-border)", borderRadius: 8,
                  color: "var(--cc-text)", fontFamily: "system-ui, sans-serif", fontSize: 13,
                  padding: 10, minHeight: 120, resize: "vertical",
                }}
              />
              <button
                onClick={analyzeJD}
                disabled={isAnalyzing || !jdText.trim()}
                style={{
                  padding: "10px", borderRadius: 8, border: "none",
                  background: isAnalyzing || !jdText.trim() ? "var(--cc-border-dim)" : "var(--cc-accent)",
                  color: isAnalyzing || !jdText.trim() ? "var(--cc-purple)" : "var(--cc-bg)",
                  fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 700,
                  cursor: isAnalyzing || !jdText.trim() ? "default" : "pointer",
                }}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze & add as offer"}
              </button>
              {analyzeError && (
                <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "var(--cc-red)" }}>
                  {analyzeError}
                </div>
              )}
              <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: "var(--cc-dim)" }}>
                Scores from the JD text alone — treat as a first pass, not a verdict. Adjust sliders after reading between the lines yourself.
              </div>
            </div>
          )}
        </div>

        {/* Weights panel */}
        <div style={{ background: "var(--cc-surface)", borderRadius: 12, padding: "16px 18px", marginBottom: 20, border: "1px solid var(--cc-border)" }}>
          <button
            onClick={() => setShowWeights(!showWeights)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
              background: "none", border: "none", color: "var(--cc-text)", cursor: "pointer",
              fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 600, padding: 0,
            }}
          >
            <span>Value weights</span>
            {showWeights ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showWeights && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {criteria.map((c) => (
                <div key={c.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "system-ui, sans-serif", fontSize: 13, marginBottom: 4 }}>
                    <span>{c.label}</span>
                    <span style={{ color: "var(--cc-accent)" }}>{weights[c.key] ?? 3}</span>
                  </div>
                  <input
                    type="range" min="1" max="5"
                    value={weights[c.key] ?? 3}
                    onChange={(e) => setWeights({ ...weights, [c.key]: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "var(--cc-accent)" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
          {["ranking", "board"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "5px 16px", borderRadius: 6, border: "none",
                background: viewMode === mode ? "var(--cc-border)" : "none",
                color: viewMode === mode ? "var(--cc-text)" : "var(--cc-dim)",
                fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 500,
                cursor: "pointer", textTransform: "capitalize",
              }}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Ranking view ── */}
        {viewMode === "ranking" && (
          <>
            {jobs.length > 1 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--cc-muted)", marginBottom: 10 }}>
                  Ranking
                </div>
                {ranked.map((j, i) => (
                  <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--cc-border)" }}>
                    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: "var(--cc-dim)", width: 18 }}>{i + 1}</div>
                    <div style={{ flex: 1, fontFamily: "system-ui, sans-serif", fontSize: 14 }}>{j.name}</div>
                    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: colors[jobs.indexOf(j) % colors.length] }}>
                      {weightedTotal(j)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Radar chart */}
            <div style={{ background: "var(--cc-surface)", borderRadius: 12, padding: "12px 4px 4px", marginBottom: 24, border: "1px solid var(--cc-border)" }}>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData} outerRadius="70%">
                  <PolarGrid stroke="var(--cc-border)" />
                  <PolarAngleAxis dataKey="criterion" tick={{ fill: "var(--cc-muted)", fontSize: 11, fontFamily: "system-ui, sans-serif" }} />
                  <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                  {jobs.map((j, i) => (
                    <Radar
                      key={j.id} name={j.name} dataKey={j.name}
                      stroke={colors[i % colors.length]} fill={colors[i % colors.length]}
                      fillOpacity={0.15} strokeWidth={2}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Job tiles */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {jobs.map((job, idx) => (
                <div key={job.id} style={{ background: "var(--cc-surface)", borderRadius: 12, border: "1px solid var(--cc-border)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[idx % colors.length], flexShrink: 0 }} />
                    <input
                      value={job.name}
                      onChange={(e) => updateJob(job.id, { name: e.target.value })}
                      style={{
                        background: "none", border: "none", color: "var(--cc-text)", fontFamily: "system-ui, sans-serif",
                        fontSize: 15, fontWeight: 600, flex: 1, outline: "none",
                      }}
                    />
                    <div style={{ fontFamily: "system-ui, sans-serif", fontWeight: 700, fontSize: 16, color: colors[idx % colors.length] }}>
                      {weightedTotal(job)}
                    </div>
                    <select
                      value={job.status}
                      onChange={(e) => updateJobStatus(job.id, e.target.value)}
                      style={{
                        background: "var(--cc-bg)", border: "1px solid var(--cc-border)", borderRadius: 6,
                        color: "var(--cc-muted)", fontFamily: "system-ui, sans-serif", fontSize: 11,
                        padding: "2px 5px", cursor: "pointer",
                      }}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: "var(--cc-dim)", display: "flex", padding: 4 }} title="Open listing">
                        <ExternalLink size={15} />
                      </a>
                    )}
                    <button
                      onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                      style={{ background: "none", border: "none", color: "var(--cc-muted)", cursor: "pointer", padding: 4 }}
                    >
                      {expanded === job.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {jobs.length > 1 && (
                      <button
                        onClick={() => removeJob(job.id)}
                        style={{ background: "none", border: "none", color: "var(--cc-dim)", cursor: "pointer", padding: 4 }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {expanded === job.id && (
                    <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
                      {(job.status === "applied" || job.status === "interviewing") && (
                        <input
                          type="text"
                          placeholder="Stage note (e.g. Round 2 · take-home due Friday)..."
                          value={job.statusNote}
                          onChange={(e) => updateJob(job.id, { statusNote: e.target.value.trimStart() })}
                          style={{
                            background: "var(--cc-bg)", border: "1px solid var(--cc-border)", borderRadius: 8,
                            color: "var(--cc-text)", fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "8px 10px",
                          }}
                        />
                      )}
                      {criteria.map((c) => (
                        <div key={c.key}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "system-ui, sans-serif", fontSize: 13, marginBottom: 2 }}>
                            <span>{c.label}</span>
                            <span style={{ color: colors[idx % colors.length] }}>{job.scores[c.key] ?? 5}</span>
                          </div>
                          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: "var(--cc-dim)", marginBottom: 5 }}>
                            {c.hint}
                          </div>
                          <input
                            type="range" min="0" max="10"
                            value={job.scores[c.key] ?? 5}
                            onChange={(e) => updateScore(job.id, c.key, Number(e.target.value))}
                            style={{ width: "100%", accentColor: colors[idx % colors.length] }}
                          />
                        </div>
                      ))}
                      <textarea
                        placeholder="Notes (comp details, red flags, gut feel...)"
                        value={job.notes}
                        onChange={(e) => updateJob(job.id, { notes: e.target.value })}
                        style={{
                          background: "var(--cc-bg)", border: "1px solid var(--cc-border)", borderRadius: 8,
                          color: "var(--cc-text)", fontFamily: "system-ui, sans-serif", fontSize: 13,
                          padding: 10, minHeight: 60, resize: "vertical",
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addJob}
              style={{
                marginTop: 16, width: "100%", padding: "12px", borderRadius: 10,
                border: "1px dashed var(--cc-border-dim)", background: "none", color: "var(--cc-muted)",
                fontFamily: "system-ui, sans-serif", fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
              }}
            >
              <Plus size={14} /> Add offer to compare
            </button>
          </>
        )}

        {/* ── Board view ── */}
        {viewMode === "board" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {BOARD_COLUMNS.map(({ status, label, dot }) => {
                const colJobs = jobs
                  .filter((j) => (j.status ?? "saved") === status)
                  .sort((a, b) => weightedTotal(b) - weightedTotal(a));
                return (
                  <div key={status} style={{ background: "var(--cc-surface)", borderRadius: 12, padding: 14, border: "1px solid var(--cc-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--cc-border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: dot }}>
                          {label}
                        </span>
                      </div>
                      <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 600, color: "var(--cc-dim)", background: "var(--cc-border)", borderRadius: 20, padding: "1px 7px", fontVariantNumeric: "tabular-nums" }}>
                        {colJobs.length}
                      </span>
                    </div>

                    {colJobs.length === 0 && (
                      <div style={{ border: "1.5px dashed var(--cc-border)", borderRadius: 8, padding: "20px 10px", textAlign: "center", color: "var(--cc-border-dim)", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
                        No offers here yet
                      </div>
                    )}

                    {colJobs.map((job) => {
                      const score = weightedTotal(job);
                      const days = daysAgo(job.appliedAt);
                      const title = job.name.length > 52 ? job.name.slice(0, 52) + "…" : job.name;
                      return (
                        <div key={job.id} style={{ background: "var(--cc-bg)", borderRadius: 9, padding: "11px 12px 10px", marginBottom: 8, border: "1px solid var(--cc-border)" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--cc-text)", lineHeight: 1.35, flex: 1 }}>
                              {title}
                            </div>
                            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: scoreColor(score), flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                              {score}
                            </div>
                          </div>
                          {job.statusNote && (
                            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: "var(--cc-dim)", marginBottom: 5, lineHeight: 1.4 }}>
                              {job.statusNote}
                            </div>
                          )}
                          {status === "applied" && days !== null && (
                            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 10, color: "var(--cc-dim)", marginBottom: 6 }}>
                              Applied {days === 0 ? "today" : `${days}d ago`}
                            </div>
                          )}
                          <select
                            value={job.status}
                            onChange={(e) => updateJobStatus(job.id, e.target.value)}
                            style={{
                              width: "100%", background: "var(--cc-surface)", border: "1px solid var(--cc-border)", borderRadius: 5,
                              color: "var(--cc-dim)", fontFamily: "system-ui, sans-serif", fontSize: 10,
                              padding: "3px 5px", cursor: "pointer",
                            }}
                          >
                            {STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div style={{ background: "var(--cc-surface)", borderRadius: 12, padding: "12px 4px 4px", border: "1px solid var(--cc-border)" }}>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData} outerRadius="70%">
                  <PolarGrid stroke="var(--cc-border)" />
                  <PolarAngleAxis dataKey="criterion" tick={{ fill: "var(--cc-muted)", fontSize: 11, fontFamily: "system-ui, sans-serif" }} />
                  <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                  {jobs.map((j, i) => (
                    <Radar
                      key={j.id} name={j.name} dataKey={j.name}
                      stroke={colors[i % colors.length]} fill={colors[i % colors.length]}
                      fillOpacity={0.15} strokeWidth={2}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
