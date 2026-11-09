/**
 * CyberFeed AI Analyst — Cloudflare Worker routing skeleton (Phase 4 SCAFFOLD ONLY).
 *
 * This file is NOT deployed and nothing in index.html/app.js calls it yet. It exists
 * so the request/response contract for each AI feature is nailed down ahead of
 * deployment, without shipping dead "Ask AI" buttons in the live app. See
 * worker/README.md for how to actually stand this up when an Anthropic API key is
 * available.
 *
 * Routes (all POST, all JSON in/out):
 *   /explain          {title, summary, link, source, depth}
 *                      -> {whyItMatters, keyTakeaways[], watchFor[]}
 *   /ask               {title, summary, link, question, history?}
 *                      -> {answer}
 *   /study-card        {title, summary, tags, cves}
 *                      -> {concept, whyItMatters, attackPath[], keyTerms[], quiz[{q,a}]}
 *   /investigate       {title, summary, link, cves, tags}
 *                      -> {overview, iocs[], techniques[], openQuestions[]}
 *   /compare-sources   {articles: [{title, summary, link, source}]}
 *                      -> {agreements[], vendorAdds{}, cisaEmphasizes[], missingInfo[]}
 *   /daily-brief       {items: [...]}
 *                      -> {summary, highlights[]}
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Pin to a model at least a couple weeks old by the time this is actually deployed;
// bump as needed. Not calling the API live in this scaffold either way.
const MODEL = "claude-sonnet-4-5";

const ROUTES = {
  "/explain": handleExplain,
  "/ask": handleAsk,
  "/study-card": handleStudyCard,
  "/investigate": handleInvestigate,
  "/compare-sources": handleCompareSources,
  "/daily-brief": handleDailyBrief,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const handler = ROUTES[url.pathname];
    if (!handler) {
      return jsonResponse({ error: "Not found" }, 404, corsHeaders);
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed, use POST" }, 405, corsHeaders);
    }
    if (!env.ANTHROPIC_API_KEY) {
      // This is the expected state until `wrangler secret put ANTHROPIC_API_KEY` is
      // run — see worker/README.md. Fail loudly and cheaply rather than attempting
      // the call and leaking a confusing upstream auth error.
      return jsonResponse({ error: "ANTHROPIC_API_KEY is not configured on this Worker" }, 500, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
    }

    try {
      const result = await handler(body, env);
      return jsonResponse(result, 200, corsHeaders);
    } catch (e) {
      return jsonResponse({ error: `Upstream error: ${e.message || e}` }, 502, corsHeaders);
    }
  },
};

function buildCorsHeaders(request, env) {
  // Set ALLOWED_ORIGIN in wrangler.toml [vars] (or as a secret, if you'd rather not
  // commit it) to your GitHub Pages origin, e.g. "https://yourname.github.io".
  // Falls back to no CORS header (same-origin only) if unset, rather than "*".
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (allowed && origin === allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
  }
  return headers;
}

function jsonResponse(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

/** Placeholder call to the Anthropic Messages API. Real prompts/parsing TBD per
 * route when this is actually built out — this just proves the plumbing. */
async function callAnthropic(env, systemPrompt, userPrompt, maxTokens = 1024) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API returned ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

/** Each handler below validates its input shape and returns the documented
 * contract. The actual LLM call + response parsing is left as a placeholder
 * (TODO) since this Worker is never deployed in this pass. */

async function handleExplain(body, env) {
  const { title, summary, link, source, depth } = body;
  if (!title) throw new Error("title is required");
  // TODO: craft a prompt from {title, summary, link, source, depth} and parse the
  // model's response into this shape.
  await callAnthropic(env, "You are a cybersecurity analyst explaining a news item.", JSON.stringify({ title, summary, link, source, depth }));
  return { whyItMatters: "", keyTakeaways: [], watchFor: [] };
}

async function handleAsk(body, env) {
  const { title, summary, link, question, history } = body;
  if (!question) throw new Error("question is required");
  await callAnthropic(env, "You are a cybersecurity analyst answering a follow-up question about a news item.", JSON.stringify({ title, summary, link, question, history }));
  return { answer: "" };
}

async function handleStudyCard(body, env) {
  const { title, summary, tags, cves } = body;
  if (!title) throw new Error("title is required");
  await callAnthropic(env, "You generate a study card teaching the core concept behind a security news item.", JSON.stringify({ title, summary, tags, cves }));
  return { concept: "", whyItMatters: "", attackPath: [], keyTerms: [], quiz: [] };
}

async function handleInvestigate(body, env) {
  const { title, summary, link, cves, tags } = body;
  if (!title) throw new Error("title is required");
  await callAnthropic(env, "You extract a structured investigation starter (overview, IOCs, techniques, open questions) from a security news item.", JSON.stringify({ title, summary, link, cves, tags }));
  return { overview: "", iocs: [], techniques: [], openQuestions: [] };
}

async function handleCompareSources(body, env) {
  const { articles } = body;
  if (!Array.isArray(articles) || !articles.length) throw new Error("articles[] is required");
  await callAnthropic(env, "You compare how multiple sources cover the same security story.", JSON.stringify({ articles }));
  return { agreements: [], vendorAdds: {}, cisaEmphasizes: [], missingInfo: [] };
}

async function handleDailyBrief(body, env) {
  const { items } = body;
  if (!Array.isArray(items)) throw new Error("items[] is required");
  await callAnthropic(env, "You write a short daily cybersecurity briefing from a list of news items.", JSON.stringify({ items }));
  return { summary: "", highlights: [] };
}
