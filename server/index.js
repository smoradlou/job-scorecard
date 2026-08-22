import "dotenv/config";
import express from "express";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 8787;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "offers.json");

const app = express();
app.use(express.json({ limit: "1mb" }));

async function readOffers() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function writeOffers(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpFile, DATA_FILE);
}

app.get("/api/offers", async (req, res) => {
  try {
    const data = await readOffers();
    if (!data) return res.status(404).json({ error: "No saved offers yet" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to read saved offers" });
  }
});

app.put("/api/offers", async (req, res) => {
  const { weights, jobs } = req.body || {};
  if (!weights || typeof weights !== "object") {
    return res.status(400).json({ error: "weights is required" });
  }
  if (!Array.isArray(jobs)) {
    return res.status(400).json({ error: "jobs must be an array" });
  }
  try {
    await writeOffers({ weights, jobs });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to save offers" });
  }
});

function buildPrompt(jdText, criteria) {
  const criteriaList = criteria
    .map((c) => `- ${c.key} ("${c.label}"): ${c.hint}`)
    .join("\n");

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

async function callAnthropic(prompt) {
  const maxAttempts = 4;
  let lastErr = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      if (response.ok) return data;

      lastErr = new Error(data?.error?.message || `Request failed (${response.status})`);
      if (response.status < 500) throw lastErr;
    } catch (e) {
      lastErr = e;
    }
    if (attempt < maxAttempts - 1) {
      const delay = 800 * Math.pow(2, attempt);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr;
}

function normalizeText(text) {
  return text
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n")
    .trim();
}

// Job boards commonly embed schema.org JobPosting data for Google Jobs
// indexing — it's the full JD as clean HTML, and far more reliable than
// Readability's main-content heuristic, which often loses to footer/cookie
// boilerplate on JS-heavy listing pages.
function findJobPosting(document) {
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  for (const script of scripts) {
    let data;
    try {
      data = JSON.parse(script.textContent);
    } catch {
      continue;
    }

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

app.post("/api/fetch-jd", async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "That doesn't look like a valid URL." });
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: "Only http/https URLs are supported." });
  }

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `The page returned ${response.status} ${response.statusText}. Some job boards block automated fetches — try pasting the text instead.`,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      return res.status(422).json({ error: `Expected an HTML page, got "${contentType}".` });
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: parsedUrl.href });
    const document = dom.window.document;

    let title = "";
    let text = "";

    const jobPosting = findJobPosting(document);
    if (jobPosting) {
      title = jobPosting.title || "";
      const company = jobPosting.hiringOrganization?.name || "";
      const body = normalizeText(htmlFragmentToText(jobPosting.description, document));
      text = [title, company].filter(Boolean).join(" — ") + (body ? `\n\n${body}` : "");
    }

    // Fall back to Readability's main-content heuristic if there was no
    // JobPosting schema, or its description was suspiciously short.
    if (text.length < 200) {
      const article = new Readability(document).parse();
      if (article?.textContent) {
        title = article.title || title;
        text = normalizeText(article.textContent);
      }
    }

    if (text.length < 200) {
      return res.status(422).json({
        error:
          "Couldn't extract enough readable text from that page — it may render its content with JavaScript or block automated fetches. Try pasting the job description instead.",
      });
    }

    res.json({ title, text });
  } catch (err) {
    const message =
      err?.name === "TimeoutError" ? "Timed out fetching that URL." : err?.message || "Failed to fetch that URL.";
    res.status(502).json({ error: message });
  }
});

app.post("/api/analyze", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      error: "Server is missing ANTHROPIC_API_KEY. Add it to server/.env (see .env.example).",
    });
  }

  const { jdText, criteria } = req.body || {};
  if (!jdText || typeof jdText !== "string" || !jdText.trim()) {
    return res.status(400).json({ error: "jdText is required" });
  }
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return res.status(400).json({ error: "criteria is required" });
  }

  try {
    const prompt = buildPrompt(jdText, criteria);
    const data = await callAnthropic(prompt);

    const textBlocks = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (!textBlocks.trim()) {
      return res.status(502).json({ error: "Empty response from model" });
    }

    const match = textBlocks.match(/\{[\s\S]*\}/);
    const cleaned = (match ? match[0] : textBlocks).replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({
        error: "Model response wasn't valid JSON: " + cleaned.slice(0, 120),
      });
    }

    if (!parsed.scores) {
      return res.status(502).json({ error: "Response was missing a scores object" });
    }

    res.json(parsed);
  } catch (err) {
    res.status(502).json({ error: err?.message || "Failed to analyze job description" });
  }
});

app.listen(PORT, () => {
  console.log(`Career Compass API proxy listening on http://localhost:${PORT}`);
  if (!API_KEY) {
    console.warn("Warning: ANTHROPIC_API_KEY is not set — /api/analyze will return 500 until it is.");
  }
});
