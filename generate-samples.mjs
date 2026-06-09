#!/usr/bin/env node
/**
 * generate-samples - build the model-output corpus that `slop-lint --discover` mines.
 *
 * Sends the fixed prompts.json to each model in models.json and writes the answers to
 * corpus/samples/<id>/<NN>-<prompt-id>.md. Because every model answers the SAME prompts,
 * topic is held constant: differences between models are style, not subject.
 *
 * Keys AND model versions come from env vars (per model's `key` and `modelEnv` fields),
 * so you bump model versions in .env without editing tracked config. A model whose key is
 * unset is skipped, so you only generate for the providers you have keys for. This is a
 * LOCAL maintainer task - keys never go near CI. Commit the generated corpus; the monthly
 * refresh then runs discover on it with no keys.
 *
 *   node --env-file-if-exists=.env generate-samples.mjs            # all configured models
 *   node --env-file-if-exists=.env generate-samples.mjs --only grok,gpt
 *   node generate-samples.mjs --dry-run        # show what would run; no API calls
 *   node generate-samples.mjs --max 3          # only the first 3 prompts (a cheap test)
 *
 * Then analyze (see README "Keeping the catalogue current"):
 *   node slop-lint.mjs --discover --samples corpus/samples/grok --baseline corpus/baseline
 *   node slop-lint.mjs --discover --samples corpus/samples/grok \
 *     --baseline corpus/samples/gpt,corpus/samples/gemini,corpus/samples/claude-opus
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const dryRun = has("--dry-run");
const only = (val("--only") || "").split(",").map((s) => s.trim()).filter(Boolean);
const maxPrompts = Number(val("--max")) || Infinity;

const prompts = JSON.parse(readFileSync("prompts.json", "utf8"));
const config = JSON.parse(readFileSync("models.json", "utf8"));
const maxTokens = config.maxTokens ?? 1200;
const lengthInstruction = prompts.lengthInstruction || "Write roughly 700 words.";
const promptList = prompts.prompts.slice(0, maxPrompts);

// The model VERSION comes from each model's `modelEnv` env var (set in .env), so versions
// are bumped there without editing tracked config; `model` in models.json is the fallback.
const resolveModel = (m) => (m.modelEnv && process.env[m.modelEnv]) || m.model;

// ── Provider adapters (raw fetch; zero dependencies) ──────────────────────────
const PROVIDERS = {
  anthropic: {
    url: () => "https://api.anthropic.com/v1/messages",
    headers: (key) => ({ "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }),
    body: (text, model) => ({ model, max_tokens: maxTokens, messages: [{ role: "user", content: text }] }),
    extract: (j) => (j.content || []).map((b) => b.text || "").join(""),
  },
  openai: {
    // newer OpenAI models (gpt-5.x) require max_completion_tokens, not max_tokens; the
    // budget also covers reasoning tokens, so keep it generous.
    url: () => "https://api.openai.com/v1/chat/completions",
    headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
    body: (text, model) => ({ model, max_completion_tokens: maxTokens, messages: [{ role: "user", content: text }] }),
    extract: (j) => j.choices?.[0]?.message?.content ?? "",
  },
  xai: {
    url: () => "https://api.x.ai/v1/chat/completions",
    headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
    body: (text, model) => ({ model, max_tokens: maxTokens, messages: [{ role: "user", content: text }] }),
    extract: (j) => j.choices?.[0]?.message?.content ?? "",
  },
  google: {
    url: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    headers: (key) => ({ "content-type": "application/json", "x-goog-api-key": key }),
    body: (text) => ({ contents: [{ parts: [{ text }] }], generationConfig: { maxOutputTokens: maxTokens } }),
    extract: (j) => (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""),
  },
};

async function callModel(m, modelId, text) {
  const a = PROVIDERS[m.provider];
  if (!a) throw new Error(`unknown provider "${m.provider}"`);
  const key = process.env[m.key];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(a.url(modelId), { method: "POST", headers: a.headers(key), body: JSON.stringify(a.body(text, modelId)) });
    if (res.ok) return a.extract(await res.json());
    if (attempt === 1 && (res.status === 429 || res.status >= 500)) { await new Promise((r) => setTimeout(r, 2500)); continue; }
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

// ── Run ────────────────────────────────────────────────────────────────────────
let models = config.models;
if (only.length) models = models.filter((m) => only.includes(m.id));

const ready = [], skipped = [];
for (const m of models) (process.env[m.key] ? ready : skipped).push(m);

console.log(`Prompt set v${prompts.version} (${promptList.length} prompts). maxTokens=${maxTokens}.`);
for (const m of skipped) console.log(`  skip ${m.id} (${m.provider}): ${m.key} not set`);
if (dryRun) {
  const desc = ready.map((m) => `${m.id} -> ${resolveModel(m)}${process.env[m.modelEnv] ? "" : " (default)"}`).join(", ");
  console.log(`\n[dry-run] would generate for: ${desc || "(none - no keys set)"}`);
  console.log(`[dry-run] -> ${ready.length * promptList.length} API calls, writing corpus/samples/<id>/*.md`);
  process.exit(0);
}
if (!ready.length) { console.error("No models have their key env var set. Set keys (or use --dry-run)."); process.exit(1); }

let ok = 0, fail = 0;
for (const m of ready) {
  const modelId = resolveModel(m);
  const dir = join("corpus", "samples", m.id);
  mkdirSync(dir, { recursive: true });
  console.log(`\n${m.id} (${m.provider}/${modelId})`);
  for (const [i, p] of promptList.entries()) {
    const text = `${p.prompt}\n\n${lengthInstruction}`;
    process.stdout.write(`  ${String(i + 1).padStart(2, "0")} ${p.id} … `);
    try {
      const answer = (await callModel(m, modelId, text)).trim();
      if (!answer) throw new Error("empty response");
      writeFileSync(join(dir, `${String(i + 1).padStart(2, "0")}-${p.id}.md`),
        `---\nmodel: ${modelId}\nprompt_id: ${p.id}\ngenre: ${p.genre}\nprompt_set: ${prompts.version}\n---\n\n${answer}\n`);
      console.log(`${answer.split(/\s+/).length} words`); ok++;
    } catch (e) { console.log(`FAIL ${e.message}`); fail++; }
  }
}
console.log(`\nDone: ${ok} written, ${fail} failed across ${ready.length} model(s). Commit corpus/samples/, then run --discover.`);
