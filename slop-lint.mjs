#!/usr/bin/env node
/**
 * slop-lint - guard prose against LLM tells ("AI slop"). Portable, zero-dependency,
 * single file.
 *
 * Drop this into any project (copy it to scripts/ or tools/) and run it on your
 * text. No install, no config required - only Node 18+.
 *
 *   node slop-lint.mjs                      # scan the current directory (recursive)
 *   node slop-lint.mjs README.md docs/      # lint specific files / directories
 *   node slop-lint.mjs --ext .md,.mdx src   # restrict which extensions to walk
 *   node slop-lint.mjs --ignore drafts      # skip paths containing a substring (repeatable)
 *   node slop-lint.mjs --fail-on-warn .     # exit 1 on warnings too (strict CI mode)
 *   node slop-lint.mjs --quiet .            # only print files that have hits
 *   node slop-lint.mjs --version            # print the catalogue version
 *   node slop-lint.mjs --list               # print the catalogue with its sources
 *   git ls-files '*.md' | xargs node slop-lint.mjs     # lint tracked markdown
 *
 * Tells fade as models train against them and new ones appear with each release, so
 * the catalogue is sourced and versioned (see CHANGELOG.md). Find candidate new tells
 * empirically with --discover (see below).
 *
 * Severity, deliberately conservative (these words also appear in good human
 * writing, so false positives are the main risk and almost everything is a warning):
 *   FAIL (exit 1): the em-dash character (U+2014). The one near-decisive typographic tell.
 *   WARN:          everything else, flagged for a human look, never auto-removed.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";

export const VERSION = "0.2.0";

// Catalogue, grouped by provenance. Each group carries the version it was added in
// and its source, so the list can be pruned with confidence as tells fade. Edit a
// group's `words`, record the change in CHANGELOG.md, and bump the version.
export const WORD_GROUPS = [
  {
    since: "0.1.0",
    source: "FSU 'delve' focal-word study; PubMed 135-term analysis",
    words: [
      "delve", "delves", "delving", "intricate", "intricately", "commendable",
      "meticulous", "meticulously", "underscore", "underscores", "underscoring",
      "pivotal", "paramount", "unwavering", "surpass", "surpasses", "showcase",
      "showcases", "showcasing", "boast", "boasts", "tapestry", "realm", "resonate",
      "resonates", "testament", "profound", "noteworthy", "notable", "versatile",
      "invaluable", "elevate", "foster", "garner",
    ],
  },
  {
    since: "0.1.0",
    source: "Pangram / Grammarly / practitioner marketing-buzzword blacklists",
    words: [
      "leverage", "leveraging", "synergy", "robust", "seamless", "seamlessly",
      "transformative", "scalable", "cutting-edge", "game-changer", "game changer",
      "paradigm", "holistic", "empower", "harness", "unleash", "unlock", "utilize",
      "utilise", "supercharge", "state-of-the-art", "best-in-class", "vibrant",
      "multifaceted", "revolutionize", "ever-evolving", "fast-paced", "comprehensive",
    ],
  },
  {
    since: "0.1.0",
    source: "practitioner blacklists (vague metaphors / meta-discourse nouns)",
    words: [
      "landscape", "journey", "roadmap", "ecosystem", "beacon", "symphony", "myriad",
      "plethora", "facet", "illuminate", "navigate", "navigating",
    ],
  },
  {
    since: "0.1.0",
    source: "practitioner blacklists (booster adverbs / filler transitions)",
    words: [
      "furthermore", "moreover", "additionally", "nonetheless", "nevertheless",
      "undoubtedly", "notably", "strategically",
    ],
  },
];

// Flat list for matching (derived from the sourced groups above).
export const WORDS = WORD_GROUPS.flatMap((g) => g.words);

// Phrases / constructions. Sources: corpus studies above plus the Wikipedia
// "Signs of AI writing" essay and practitioner blacklists. Added in 0.1.0 unless noted.
export const PHRASES = [
  // intro / scene-setting cliches
  { re: /\bin today'?s (fast[- ]paced )?(world|digital age|digital landscape)\b/i, msg: '"in today\'s ... world" intro' },
  { re: /\bin the (ever[- ]evolving|dynamic) (landscape|world) of\b/i, msg: '"ever-evolving landscape" intro' },
  { re: /\bas the world continues to evolve\b/i, msg: '"as the world continues to evolve"' },
  { re: /\bimagine a world where\b/i, msg: '"imagine a world where"' },
  { re: /\bat its core\b/i, msg: '"at its core"' },
  // expository cliches
  { re: /\bplays? an? (crucial|important|key|vital|pivotal|significant) role\b/i, msg: '"plays a crucial role"' },
  { re: /\bis a testament to\b/i, msg: '"is a testament to"' },
  { re: /\bserves? as a (powerful|valuable|vital) tool\b/i, msg: '"serves as a powerful tool"' },
  { re: /\bcannot be overstated\b/i, msg: '"cannot be overstated"' },
  { re: /\bhas become increasingly (important|popular|common)\b/i, msg: '"has become increasingly ..."' },
  // reader framing
  { re: /\bwhen it comes to\b/i, msg: '"when it comes to"' },
  { re: /\bwhether you'?re (a |an )?.+ or (a |an )?.+/i, msg: '"whether you\'re X or Y" framing' },
  { re: /\bno matter where you are (on|in) your journey\b/i, msg: '"no matter where you are on your journey"' },
  { re: /\bif you'?re looking to\b/i, msg: '"if you\'re looking to"' },
  // vague filler
  { re: /\bat the end of the day\b/i, msg: '"at the end of the day"' },
  { re: /\bfor all intents and purposes\b/i, msg: '"for all intents and purposes"' },
  { re: /\bwith that in mind\b/i, msg: '"with that in mind"' },
  { re: /\bthe fact of the matter is\b/i, msg: '"the fact of the matter is"' },
  { re: /\bin a nutshell\b/i, msg: '"in a nutshell"' },
  { re: /\bneedless to say\b/i, msg: '"needless to say"' },
  { re: /\bthat being said\b/i, msg: '"that being said"' },
  { re: /\bdeep dive\b/i, msg: '"deep dive"' },
  // hedging / throat-clearing
  { re: /\bit'?s (important|worth|essential) (to note|noting|to consider|considering|to recognize) that\b/i, msg: "hedge: \"it's worth noting that ...\"" },
  { re: /\bwhile it is true that\b/i, msg: '"while it is true that"' },
  { re: /\bit could be argued that\b/i, msg: '"it could be argued that"' },
  { re: /\bgenerally speaking\b/i, msg: '"generally speaking"' },
  // meta-structure
  { re: /\bthis (article|post|paper|piece) will (explore|examine|cover|delve into|look at)\b/i, msg: '"this article will explore"' },
  { re: /\blet'?s (take a closer look|dive in|explore|unpack)\b/i, msg: '"let\'s dive in / take a closer look"' },
  { re: /\bhere'?s (the thing|why)\b/i, msg: '"here\'s the thing/why"' },
  // closing tics
  { re: /\b(in conclusion|in summary|to sum up|to wrap up|to conclude)\b/i, msg: "conclusion ritual" },
  { re: /\bthe possibilities are endless\b/i, msg: '"the possibilities are endless"' },
  { re: /\bthe future (is|looks) (bright|promising)\b/i, msg: '"the future is bright"' },
  { re: /\bonly time will tell\b/i, msg: '"only time will tell"' },
  { re: /\bthe journey (is just beginning|doesn'?t end here)\b/i, msg: '"the journey is just beginning"' },
  // syntactic constructions
  { re: /\bnot (just|only)\b[^.?!]{0,60}\b(but|it'?s|they'?re|its)\b/i, msg: '"not just X, but Y"' },
  { re: /\b(it'?s|we'?re|they'?re)\s+(not|never)(\s+just)?\b[^.?!]{1,80}?\b(it'?s|we'?re|they'?re)\b/i, msg: '"it\'s not X, it\'s Y" negated contrast' },
];

export const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;
const DOUBLEDASH = /(^|\s)--(\s|$)|\w--\w/; // em-dash approximation
const reWord = (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

const DEFAULT_EXTS = [".md", ".markdown", ".mdx", ".txt"];
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "out", "vendor", "coverage"]);

// Lint one document. Returns { em, hits } where em is the em-dash count (the only
// failure) and hits are preformatted "  <line>: <symbol> ..." report lines.
export function lintText(text) {
  let em = 0;
  const hits = [];
  text.split("\n").forEach((line, i) => {
    const n = i + 1;
    const dash = (line.match(/—/g) || []).length;
    if (dash) { em += dash; hits.push(`  ${n}: ✗ em-dash ×${dash}  ${line.trim().slice(0, 64)}`); }
    if (DOUBLEDASH.test(line)) hits.push(`  ${n}: ⚠ "--" (em-dash approximation)`);
    for (const w of WORDS) if (reWord(w).test(line)) hits.push(`  ${n}: ⚠ word "${w}"`);
    for (const p of PHRASES) if (p.re.test(line)) hits.push(`  ${n}: ⚠ ${p.msg}`);
    if (EMOJI.test(line)) hits.push(`  ${n}: ⚠ emoji`);
  });
  return { em, hits };
}

// Expand paths to a file list. Explicit files are always included; directories are
// walked with the extension filter, skipping IGNORE_DIRS + any `ignore` substring.
export function walkFiles(paths, { exts = DEFAULT_EXTS, ignore = [] } = {}) {
  const skip = (p) => p.split(sep).some((s) => IGNORE_DIRS.has(s)) || ignore.some((s) => p.includes(s));
  const out = [];
  const walk = (d) => {
    let entries; try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      const p = join(d, e);
      if (skip(p)) continue;
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p);
      else if (exts.includes(extname(p).toLowerCase())) out.push(p);
    }
  };
  for (const p of paths) {
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p);
    else out.push(p); // explicit file -> lint regardless of extension
  }
  return [...new Set(out)];
}

// ── Discover: find candidate NEW tells empirically ────────────────────────────
// Compare word/bigram frequency in model-output samples against a human baseline.
// Tokens that are massively over-represented in the samples, and not already in the
// catalogue, are ranked as candidates for human review. This is how the original
// "delve" tell was found, and it re-runs against each new model's output.
const STOP = new Set((
  "the a an and or but of to in on at for with as is are was were be been being by " +
  "this that these those it its it's i you he she we they them his her their our your " +
  "not no nor so if then than too very can will just also from into over under about " +
  "out up down off here there what which who whom when where why how all any both each " +
  "more most other some such only own same has have had do does did"
).split(" "));

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z][a-z'’-]{2,}/g) || []).filter((w) => !STOP.has(w));
}
function freqMap(texts, { bigrams = true } = {}) {
  const counts = new Map(); let total = 0;
  for (const t of texts) {
    const toks = tokenize(t);
    for (let i = 0; i < toks.length; i++) {
      counts.set(toks[i], (counts.get(toks[i]) || 0) + 1); total++;
      if (bigrams && i + 1 < toks.length) {
        const bg = `${toks[i]} ${toks[i + 1]}`;
        counts.set(bg, (counts.get(bg) || 0) + 1);
      }
    }
  }
  return { counts, total: total || 1 };
}
export function discover(sampleTexts, baselineTexts, { top = 30, minCount = 3 } = {}) {
  const S = freqMap(sampleTexts), B = freqMap(baselineTexts);
  const known = new Set(WORDS.map((w) => w.toLowerCase()));
  const smoothing = 1 / (B.total * 10);
  const out = [];
  for (const [tok, c] of S.counts) {
    if (c < minCount || known.has(tok)) continue;
    const sf = c / S.total;
    const bf = (B.counts.get(tok) || 0) / B.total;
    out.push({ token: tok, count: c, sampleFreq: sf, baselineFreq: bf, ratio: sf / (bf + smoothing) });
  }
  out.sort((a, b) => b.ratio - a.ratio || b.count - a.count);
  return out.slice(0, top);
}

function readAll(paths) {
  return walkFiles(paths, { exts: [".md", ".markdown", ".mdx", ".txt"] })
    .map((f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } });
}

function runDiscover(argv) {
  const get = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
  const samples = get("--samples"), baseline = get("--baseline");
  const json = argv.includes("--json");
  const top = Number(get("--top")) || 30;
  if (!samples || !baseline) {
    console.error("discover: need --samples <dir> and --baseline <dir>.\n" +
      "  node slop-lint.mjs --discover --samples corpus/samples --baseline corpus/baseline");
    return 2;
  }
  const sTexts = readAll([samples]), bTexts = readAll([baseline]);
  if (!sTexts.length || !bTexts.length) { console.error("discover: empty samples or baseline corpus."); return 2; }
  const cands = discover(sTexts, bTexts, { top });
  if (json) { console.log(JSON.stringify({ version: VERSION, candidates: cands }, null, 2)); return 0; }
  console.log("Candidate tells (over-represented in samples vs baseline, not yet in the catalogue):\n");
  console.log("  ratio   count  token");
  for (const c of cands) console.log(`  ${c.ratio.toFixed(1).padStart(6)}  ${String(c.count).padStart(5)}  ${c.token}`);
  console.log(`\n${cands.length} candidate(s). Review, then add the real tells to WORD_GROUPS (with a source) and CHANGELOG.md.`);
  return 0;
}

function main(argv) {
  if (argv.includes("--version") || argv.includes("-v")) { console.log(VERSION); return 0; }
  if (argv.includes("--discover")) return runDiscover(argv);
  if (argv.includes("--list")) {
    for (const g of WORD_GROUPS) console.log(`\n# ${g.source} (since ${g.since})\n${g.words.join(", ")}`);
    console.log(`\n# phrases: ${PHRASES.length} patterns. Catalogue version ${VERSION}.`);
    return 0;
  }
  const paths = [];
  let exts = DEFAULT_EXTS, ignore = [], failOnWarn = false, quiet = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log("slop-lint - flag LLM tells in prose. FAIL on em-dash, WARN on the rest.\n" +
        "  node slop-lint.mjs [paths...] [--ext .md,.txt] [--ignore <substr>]... [--fail-on-warn] [--quiet]\n" +
        "  node slop-lint.mjs --discover --samples <dir> --baseline <dir> [--top N] [--json]\n" +
        "  --version  --list   (no paths: scans the current directory recursively)");
      return 0;
    }
    if (a === "--ext") { exts = argv[++i].split(",").map((e) => (e.startsWith(".") ? e : `.${e}`).toLowerCase()); continue; }
    if (a === "--ignore") { ignore.push(argv[++i]); continue; }
    if (a === "--fail-on-warn") { failOnWarn = true; continue; }
    if (a === "--quiet") { quiet = true; continue; }
    paths.push(a);
  }
  const files = walkFiles(paths.length ? paths : ["."], { exts, ignore });
  if (!files.length) { console.log("slop-lint: no files found."); return 0; }

  let emTotal = 0, warnTotal = 0;
  for (const file of files) {
    let text; try { text = readFileSync(file, "utf8"); } catch (e) { console.log(`skip ${file}: ${e.message}`); continue; }
    const { em, hits } = lintText(text);
    emTotal += em; warnTotal += hits.filter((h) => h.includes("⚠")).length;
    if (hits.length || !quiet) console.log(`\n${file}\n${hits.length ? hits.join("\n") : "  clean ✓"}`);
  }
  console.log(`\n${emTotal} em-dash failure(s), ${warnTotal} warning(s) across ${files.length} file(s).`);
  console.log("FAIL on em-dash; warnings are prompts to review, not bans.");
  return emTotal || (failOnWarn && warnTotal) ? 1 : 0;
}

// Run as a CLI when invoked directly; stay importable when required elsewhere.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
