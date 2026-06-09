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
 *   git ls-files '*.md' | xargs node slop-lint.mjs     # lint tracked markdown
 *
 * Severity, deliberately conservative (these words also appear in good human
 * writing, so false positives are the main risk and almost everything is a warning):
 *   FAIL (exit 1): the em-dash character (U+2014). The one near-decisive typographic tell.
 *   WARN:          everything else, flagged for a human look, never auto-removed.
 *
 * Catalogue from corpus studies (FSU "delve" focal-word paper; PubMed 135-term
 * analysis; Gray "meticulously commendable") plus Pangram / Grammarly / practitioner
 * blacklists. Also exported (WORDS, PHRASES, lintText, walkFiles) for reuse.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";

// Corpus-validated focal words + marketing buzzwords + vague metaphors/verbs.
export const WORDS = [
  // FSU/PubMed focal words
  "delve", "delves", "delving", "intricate", "intricately", "commendable",
  "meticulous", "meticulously", "underscore", "underscores", "underscoring",
  "pivotal", "paramount", "unwavering", "surpass", "surpasses", "showcase",
  "showcases", "showcasing", "boast", "boasts", "tapestry", "realm", "resonate",
  "resonates", "testament", "profound", "noteworthy", "notable", "versatile",
  "invaluable", "elevate", "foster", "garner",
  // marketing buzzwords
  "leverage", "leveraging", "synergy", "robust", "seamless", "seamlessly",
  "transformative", "scalable", "cutting-edge", "game-changer", "game changer",
  "paradigm", "holistic", "empower", "harness", "unleash", "unlock", "utilize",
  "utilise", "supercharge", "state-of-the-art", "best-in-class", "vibrant",
  "multifaceted", "revolutionize", "ever-evolving", "fast-paced", "comprehensive",
  // vague metaphors / meta-discourse nouns
  "landscape", "journey", "roadmap", "ecosystem", "beacon", "symphony", "myriad",
  "plethora", "facet", "illuminate", "navigate", "navigating",
  // booster adverbs / filler transitions
  "furthermore", "moreover", "additionally", "nonetheless", "nevertheless",
  "undoubtedly", "notably", "strategically",
];

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

function main(argv) {
  const paths = [];
  let exts = DEFAULT_EXTS, ignore = [], failOnWarn = false, quiet = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log("slop-lint - flag LLM tells in prose. FAIL on em-dash, WARN on the rest.\n" +
        "  node slop-lint.mjs [paths...] [--ext .md,.txt] [--ignore <substr>]... [--fail-on-warn] [--quiet]\n" +
        "  no paths: scans the current directory recursively.");
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
