import { useState, useEffect, useRef } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import ValuesInterview from "./ValuesInterview.jsx";

const emptyJobFor = (criteriaList, n) => ({
  id: Date.now() + Math.random(),
  name: `Offer ${n}`,
  scores: Object.fromEntries(criteriaList.map((c) => [c.key, 5])),
  notes: "",
});

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
  const saveTimeout = useRef(null);

  // Load saved criteria/offers/weights from the backend once on mount. A
  // file missing `criteria` (never onboarded, or the pre-values-interview
  // schema) leaves criteria null, which routes to the values interview.
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/offers");
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.criteria) && data.criteria.length > 0) setCriteria(data.criteria);
          if (data.weights) setWeights(data.weights);
          if (Array.isArray(data.jobs) && data.jobs.length > 0) {
            setJobs(data.jobs);
            setExpanded(data.jobs[0].id);
          }
        }
        // 404 means nothing saved yet — keep the local defaults.
      } catch {
        // API server unreachable — keep local defaults; saves will surface the same issue.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Debounced autosave whenever criteria/offers/weights change, after the
  // initial load. Nothing is written while criteria is null (still
  // onboarding) or mid-redefine-before-confirm, so a redefinition in
  // progress can never clobber the last good save.
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
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }
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

      if (!response.ok) {
        throw new Error(parsed?.error || `Request failed (${response.status})`);
      }
      if (!parsed.scores) {
        throw new Error("Response was missing a scores object");
      }

      const name =
        [parsed.role_title, parsed.company].filter(Boolean).join(" — ") ||
        `Offer ${jobs.length + 1}`;

      const newJob = {
        id: Date.now() + Math.random(),
        name,
        url: jdUrl.trim() || undefined,
        scores: {
          ...Object.fromEntries(criteria.map((c) => [c.key, 5])),
          ...parsed.scores,
        },
        notes: parsed.rationale || "",
      };

      setJobs([...jobs, newJob]);
      setExpanded(newJob.id);
      setJdText("");
      setShowAnalyze(false);
    } catch (err) {
      setAnalyzeError(
        (err && err.message) ||
          "Couldn't parse that job description. Try again, or add manually below."
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
    setJobs(
      jobs.map((j) =>
        j.id === id ? { ...j, scores: { ...j.scores, [key]: value } } : j
      )
    );

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
      <div
        style={{
          minHeight: "100vh", background: "#161B27", display: "flex", alignItems: "center",
          justifyContent: "center", fontFamily: "system-ui, sans-serif", fontSize: 13, color: "#5A6178",
        }}
      >
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
    <div style={{ minHeight: "100vh", background: "#161B27", color: "#EAE6DC", fontFamily: "'Georgia', serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#E8B04B", fontFamily: "system-ui, sans-serif", fontWeight: 600 }}>
            Career Compass
          </div>
          <h1 style={{ fontSize: 30, margin: "6px 0 4px", fontWeight: 500, lineHeight: 1.15 }}>
            Job offer scorecard
          </h1>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#A6A18F", maxWidth: 520, margin: 0 }}>
            Weighted against your core values. Score each offer 0–10 per criterion, adjust weights if your priorities shift.
          </p>
          <button
            onClick={() => setInterviewMode(true)}
            style={{
              marginTop: 8, background: "none", border: "none", color: "#5A6178", cursor: "pointer",
              fontFamily: "system-ui, sans-serif", fontSize: 12, textDecoration: "underline", padding: 0,
            }}
          >
            Redefine my values
          </button>
          {saveError && (
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#C97064", marginTop: 8 }}>
              {saveError}
            </div>
          )}
        </div>

        {/* JD analyzer panel */}
        <div style={{ background: "#1E2433", borderRadius: 12, padding: "16px 18px", marginBottom: 16, border: "1px solid #2C3348" }}>
          <button
            onClick={() => setShowAnalyze(!showAnalyze)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
              background: "none", border: "none", color: "#EAE6DC", cursor: "pointer",
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
                    flex: 1, background: "#161B27", border: "1px solid #2C3348", borderRadius: 8, color: "#EAE6DC",
                    fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "10px",
                  }}
                />
                <button
                  onClick={fetchJDFromUrl}
                  disabled={isFetchingUrl || !jdUrl.trim()}
                  style={{
                    padding: "0 14px", borderRadius: 8, border: "1px dashed #3A4258", background: "none",
                    color: isFetchingUrl || !jdUrl.trim() ? "#3A4258" : "#A6A18F",
                    fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 600,
                    cursor: isFetchingUrl || !jdUrl.trim() ? "default" : "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {isFetchingUrl ? "Fetching..." : "Fetch text"}
                </button>
              </div>
              {fetchUrlError && (
                <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#C97064" }}>
                  {fetchUrlError}
                </div>
              )}
              <textarea
                placeholder="Paste the full job posting here, or fetch it from a URL above..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                style={{
                  background: "#161B27", border: "1px solid #2C3348", borderRadius: 8, color: "#EAE6DC",
                  fontFamily: "system-ui, sans-serif", fontSize: 13, padding: 10, minHeight: 120, resize: "vertical",
                }}
              />
              <button
                onClick={analyzeJD}
                disabled={isAnalyzing || !jdText.trim()}
                style={{
                  padding: "10px", borderRadius: 8, border: "none",
                  background: isAnalyzing || !jdText.trim() ? "#3A4258" : "#E8B04B",
                  color: isAnalyzing || !jdText.trim() ? "#8A8FD1" : "#161B27",
                  fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 700,
                  cursor: isAnalyzing || !jdText.trim() ? "default" : "pointer",
                }}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze & add as offer"}
              </button>
              {analyzeError && (
                <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#C97064" }}>
                  {analyzeError}
                </div>
              )}
              <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: "#5A6178" }}>
                Scores from the JD text alone — treat as a first pass, not a verdict. Adjust sliders after reading between the lines yourself.
              </div>
            </div>
          )}
        </div>

        {/* Weights panel */}
        <div style={{ background: "#1E2433", borderRadius: 12, padding: "16px 18px", marginBottom: 24, border: "1px solid #2C3348" }}>
          <button
            onClick={() => setShowWeights(!showWeights)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
              background: "none", border: "none", color: "#EAE6DC", cursor: "pointer",
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
                    <span style={{ color: "#E8B04B" }}>{weights[c.key] ?? 3}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={weights[c.key] ?? 3}
                    onChange={(e) => setWeights({ ...weights, [c.key]: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "#E8B04B" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ranking */}
        {jobs.length > 1 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A6A18F", marginBottom: 10 }}>
              Ranking
            </div>
            {ranked.map((j, i) => (
              <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #2C3348" }}>
                <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: "#5A6178", width: 18 }}>{i + 1}</div>
                <div style={{ flex: 1, fontFamily: "system-ui, sans-serif", fontSize: 14 }}>{j.name}</div>
                <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: colors[jobs.indexOf(j) % colors.length] }}>
                  {weightedTotal(j)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Radar chart */}
        <div style={{ background: "#1E2433", borderRadius: 12, padding: "12px 4px 4px", marginBottom: 24, border: "1px solid #2C3348" }}>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="#2C3348" />
              <PolarAngleAxis dataKey="criterion" tick={{ fill: "#A6A18F", fontSize: 11, fontFamily: "system-ui, sans-serif" }} />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              {jobs.map((j, i) => (
                <Radar
                  key={j.id}
                  name={j.name}
                  dataKey={j.name}
                  stroke={colors[i % colors.length]}
                  fill={colors[i % colors.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Job cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {jobs.map((job, idx) => (
            <div key={job.id} style={{ background: "#1E2433", borderRadius: 12, border: "1px solid #2C3348", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[idx % colors.length], flexShrink: 0 }} />
                <input
                  value={job.name}
                  onChange={(e) => updateJob(job.id, { name: e.target.value })}
                  style={{
                    background: "none", border: "none", color: "#EAE6DC", fontFamily: "system-ui, sans-serif",
                    fontSize: 15, fontWeight: 600, flex: 1, outline: "none",
                  }}
                />
                <div style={{ fontFamily: "system-ui, sans-serif", fontWeight: 700, fontSize: 16, color: colors[idx % colors.length] }}>
                  {weightedTotal(job)}
                </div>
                {job.url && (
                  <a href={job.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: "#5A6178", display: "flex", padding: 4 }}
                    title="Open listing"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
                <button
                  onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                  style={{ background: "none", border: "none", color: "#A6A18F", cursor: "pointer", padding: 4 }}
                >
                  {expanded === job.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {jobs.length > 1 && (
                  <button
                    onClick={() => removeJob(job.id)}
                    style={{ background: "none", border: "none", color: "#5A6178", cursor: "pointer", padding: 4 }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              {expanded === job.id && (
                <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {criteria.map((c) => (
                    <div key={c.key}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "system-ui, sans-serif", fontSize: 13, marginBottom: 2 }}>
                        <span>{c.label}</span>
                        <span style={{ color: colors[idx % colors.length] }}>{job.scores[c.key] ?? 5}</span>
                      </div>
                      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: "#5A6178", marginBottom: 5 }}>
                        {c.hint}
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
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
                      background: "#161B27", border: "1px solid #2C3348", borderRadius: 8, color: "#EAE6DC",
                      fontFamily: "system-ui, sans-serif", fontSize: 13, padding: 10, minHeight: 60, resize: "vertical",
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
            marginTop: 16, width: "100%", padding: "12px", borderRadius: 10, border: "1px dashed #3A4258",
            background: "none", color: "#A6A18F", fontFamily: "system-ui, sans-serif", fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
          }}
        >
          <Plus size={14} /> Add offer to compare
        </button>
      </div>
    </div>
  );
}
