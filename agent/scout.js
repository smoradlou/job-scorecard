import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../server/data/offers.json");
const SEEN_FILE = path.resolve(__dirname, "seen.json");
const CV_FILE = path.resolve(__dirname, "cv.md");

const THRESHOLD = Number(process.env.SCOUT_THRESHOLD ?? 70);
const API_KEY = process.env.ANTHROPIC_API_KEY;
// Used for the inner score_jd call — sonnet is fast and cheap for JSON extraction
const SCORING_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// ─── Helpers (duplicated from server/index.js to keep scout standalone) ───────

function normalizeText(text) {
  return text
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n")
    .trim();
}

function findJobPosting(document) {
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  for (const script of scripts) {
    let data;
    try { data = JSON.parse(script.textContent); } catch { continue; }
    const candidates = [];
    const collect = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(collect);
      if (node["@graph"]) collect(node["@graph"]);
      candidates.push(node);
    };
    collect(data);
    const jobPosting = candidates.find((node) => {
      const type = node["@type"];
      return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
    });
    if (jobPosting?.description) return jobPosting;
  }
  return null;
}

function htmlFragmentToText(html, document) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  wrapper.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  wrapper.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, div, tr").forEach((el) => el.append("\n"));
  return wrapper.textContent || "";
}

function extractJson(text) {
  if (!text.trim()) return { error: "Empty response" };
  const match = text.match(/\{[\s\S]*\}/);
  const cleaned = (match ? match[0] : text).replace(/```json|```/g, "").trim();
  try { return { parsed: JSON.parse(cleaned) }; }
  catch { return { error: "Not valid JSON: " + cleaned.slice(0, 120) }; }
}

// ─── Data I/O ─────────────────────────────────────────────────────────────────

async function readData() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, "utf-8")); }
  catch (e) { if (e.code === "ENOENT") return null; throw e; }
}

async function writeData(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, DATA_FILE);
}

async function readSeen() {
  try { return JSON.parse(await fs.readFile(SEEN_FILE, "utf-8")); }
  catch (e) { if (e.code === "ENOENT") return []; throw e; }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function buildScoringPrompt(jdText, criteria) {
  const criteriaList = criteria.map((c) => `- ${c.key} ("${c.label}"): ${c.hint}`).join("\n");
  return `You are scoring a job description against a candidate's personal criteria. Read the job description below and score it 0-10 on EACH of these criteria, based only on evidence in the text (use 5 as a neutral default if the JD gives no signal for a criterion):

${criteriaList}

Also extract a short role title and company name if present, and write a 2-3 sentence rationale covering the strongest and weakest scoring criteria.

Respond with ONLY a raw JSON object, no markdown fences, no preamble, in exactly this shape:
{"role_title":"...", "company":"...", "scores":{${criteria.map((c) => `"${c.key}":0`).join(",")}}, "rationale":"..."}

Job description:
"""
${jdText}
"""`;
}

function computeWeightedTotal(scores, criteria, weights) {
  const maxPossible = criteria.reduce((s, c) => s + (weights[c.key] ?? c.weight ?? 3) * 10, 0);
  const raw = criteria.reduce((s, c) => s + (weights[c.key] ?? c.weight ?? 3) * (scores[c.key] ?? 5), 0);
  return Math.round((raw / maxPossible) * 100);
}

// ─── Tools ────────────────────────────────────────────────────────────────────

const fetchAndScoreJdTool = betaTool({
  name: "fetch_and_score_jd",
  description: "Fetch a job listing and score it against the candidate's criteria in one step. Returns role_title, company, scores, rationale, and total_score (0-100), or { error } if the page can't be fetched.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL of the job listing page" },
    },
    required: ["url"],
  },
  run: async ({ url }) => {
    // --- Fetch phase ---
    let jdText;
    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return JSON.stringify({ error: "Only http/https URLs supported." });
      }
      const response = await fetch(parsedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return JSON.stringify({ error: `Page returned ${response.status} ${response.statusText}` });

      const html = await response.text();
      const dom = new JSDOM(html, { url: parsedUrl.href });
      const document = dom.window.document;

      let title = "", text = "";
      const jobPosting = findJobPosting(document);
      if (jobPosting) {
        title = jobPosting.title || "";
        const company = jobPosting.hiringOrganization?.name || "";
        const body = normalizeText(htmlFragmentToText(jobPosting.description, document));
        text = [title, company].filter(Boolean).join(" — ") + (body ? `\n\n${body}` : "");
      }
      if (text.length < 200) {
        const article = new Readability(document).parse();
        if (article?.textContent) {
          title = article.title || title;
          text = normalizeText(article.textContent);
        }
      }
      if (text.length < 200) {
        return JSON.stringify({ error: "Couldn't extract enough text — page may be JS-rendered. Skip this one." });
      }
      jdText = text.slice(0, 8000);
    } catch (e) {
      return JSON.stringify({ error: e?.name === "TimeoutError" ? "Timed out." : (e?.message || "Fetch failed.") });
    }

    // --- Score phase (jdText stays local; never returned to the model) ---
    const data = await readData();
    if (!data?.criteria) {
      return JSON.stringify({ error: "No criteria found. Complete the values interview in the app first." });
    }
    const { criteria, weights = {} } = data;
    const prompt = buildScoringPrompt(jdText, criteria);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: SCORING_MODEL,
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        return JSON.stringify({ error: result?.error?.message || `API error ${response.status}` });
      }
      const text = (result.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const { parsed, error } = extractJson(text);
      if (error) return JSON.stringify({ error });

      const total = computeWeightedTotal(parsed.scores || {}, criteria, weights);
      return JSON.stringify({ ...parsed, total_score: total });
    } catch (e) {
      return JSON.stringify({ error: e?.message || "Scoring failed." });
    }
  },
});

const isSeenTool = betaTool({
  name: "is_seen",
  description: "Check if a job URL has already been evaluated in a previous scout run. Returns { seen: boolean }.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The job listing URL to check" },
    },
    required: ["url"],
  },
  run: async ({ url }) => {
    const seen = await readSeen();
    return JSON.stringify({ seen: seen.includes(url) });
  },
});

const saveOfferTool = betaTool({
  name: "save_offer",
  description: "Save a high-scoring job offer to the scorecard and mark its URL as seen so it won't be re-evaluated.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" },
      role_title: { type: "string" },
      company: { type: "string" },
      scores: {
        type: "object",
        description: "Object mapping criterion keys to numeric scores (0-10 each)",
      },
      rationale: { type: "string" },
      total_score: { type: "number", description: "Weighted total score 0-100" },
    },
    required: ["url", "role_title", "company", "scores", "total_score"],
  },
  run: async ({ url, role_title, company, scores, rationale, total_score }) => {
    const data = await readData();
    if (!data) return JSON.stringify({ error: "No scorecard data found. Complete the values interview first." });

    const name = `${role_title} @ ${company}`;
    data.jobs = [...(data.jobs || []), {
      id: Date.now(),
      name,
      url,
      scores,
      rationale: rationale || "",
    }];
    await writeData(data);

    const seen = await readSeen();
    if (!seen.includes(url)) seen.push(url);
    await fs.writeFile(SEEN_FILE, JSON.stringify(seen, null, 2), "utf-8");

    console.log(`  ✓ Saved: ${name} (score: ${total_score})`);
    return JSON.stringify({ ok: true, name });
  },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is not set. Add it to .env or set it in your environment.");
    process.exit(1);
  }

  const data = await readData();
  if (!data?.criteria) {
    console.error("Error: No criteria in server/data/offers.json. Complete the values interview in the app first.");
    process.exit(1);
  }

  const { criteria, weights = {} } = data;
  const cv = await fs.readFile(CV_FILE, "utf-8").catch(
    () => "(No cv.md found — fill in agent/cv.md with your profile for better search targeting.)"
  );

  const criteriaDesc = criteria
    .map((c) => `  - ${c.label} [weight: ${weights[c.key] ?? c.weight ?? 3}]: ${c.hint}`)
    .join("\n");

  console.log(`\nJob Scout — threshold: ${THRESHOLD}/100`);
  console.log(`Scoring against:\n${criteriaDesc}\n`);

  const client = new Anthropic({ apiKey: API_KEY });

  const systemPrompt = `You are a job scout agent. Your task: find job listings that match the candidate's profile, score them, and save any that clear the quality bar.

## Candidate profile

${cv}

## Scoring criteria
${criteriaDesc}

Save threshold: ${THRESHOLD}/100

## Workflow for each listing
1. Call is_seen(url) — skip if already seen, move on.
2. Call fetch_and_score_jd(url) — fetches and scores in one step. If it returns { error }, skip and try the next listing.
3. If total_score >= ${THRESHOLD}: call save_offer with all details.
4. Log what you found: company, role, score, and your decision.

## Search strategy
Use web_search to find relevant listings. Be specific about role type, seniority, domain, and location/remote preference from the profile. Evaluate at least 5 new listings per run. Prefer pages with the full JD text (direct employer careers pages or full-detail job boards). Don't waste fetches on aggregator pages that just list titles.`;

  const userMessage = `Search for job listings that match my profile. Evaluate at least 5 new listings. For each: check if seen, fetch it, score it, and save if the score is ${THRESHOLD} or above. Then give me a brief summary of what you found.`;

  const params = {
    model: "claude-opus-5",
    max_tokens: 16000,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral", ttl: "1h" } }],
    messages: [{ role: "user", content: userMessage }],
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: 20 },
      fetchAndScoreJdTool,
      isSeenTool,
      saveOfferTool,
    ],
  };

  const runner = client.beta.messages.toolRunner(params);

  let lastUsage = null;

  // Iterate turn by turn; resume on pause_turn (can occur with server-side tools)
  for await (const message of runner) {
    const text = (message.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (text) console.log("\n" + text);

    if (message.usage) lastUsage = message.usage;

    if (message.stop_reason === "pause_turn") {
      runner.pushMessages({ role: "assistant", content: message.content });
    }
  }

  console.log("\nScout run complete.");
  if (lastUsage) {
    console.log(
      `Tokens — input: ${lastUsage.input_tokens ?? 0}  cache_write: ${lastUsage.cache_creation_input_tokens ?? 0}  cache_read: ${lastUsage.cache_read_input_tokens ?? 0}  output: ${lastUsage.output_tokens ?? 0}`
    );
  }
}

main().catch((err) => {
  console.error("\nScout failed:", err?.message || err);
  process.exit(1);
});
