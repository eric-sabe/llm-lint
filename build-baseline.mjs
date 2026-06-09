#!/usr/bin/env node
/**
 * build-baseline - assemble a human reference corpus for `--discover` from US federal
 * government works, which are **public domain** and **modern** (past ~50 years). No keys.
 * Writes corpus/baseline/ and a SOURCES.md.
 *
 *   node build-baseline.mjs
 *
 * Source: presidential State of the Union + Inaugural addresses (Ford..Biden). The speech
 * text is a US-government work (public domain), retrieved from English Wikisource.
 *
 * Why: contemporary vocabulary (unlike public-domain literature) with no licensing
 * encumbrance. Caveat: the register is FORMAL oratory, not casual - genuinely casual
 * modern prose is almost always copyrighted. The strongest baseline you can supply is your
 * own trusted contemporary writing in the prompt genres; drop it in and re-run.
 *
 * (Supreme Court opinions were considered but dropped: full text is unreliable via the
 * free APIs - CourtListener lacks ingested text for many opinions, and Wikisource splits
 * opinions into transcluded subpages the extract API misses - and legalese is citation-
 * noisy for a prose baseline. Speeches give a cleaner modern reference.)
 */

import { writeFileSync, mkdirSync, rmSync } from "node:fs";

const UA = "slop-lint-baseline-builder/2.1 (https://github.com/eric-sabe/slop-lint)";
const wc = (t) => (t.match(/\S+/g) || []).length;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
const cap = (t, n) => t.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MODERN = /\b(Ford|Carter|Reagan|Bush|Clinton|Obama|Trump|Biden)\b/; // past ~50 years

async function wikisourceTitles(query, kind) {
  const u = `https://en.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=50&format=json&formatversion=2`;
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  return ((await r.json()).query?.search?.map((s) => s.title) || [])
    .filter((t) => MODERN.test(t) && new RegExp(`${kind} Address`, "i").test(t));
}
async function extract(title) {
  const u = `https://en.wikisource.org/w/api.php?action=query&prop=extracts&explaintext=1&exlimit=max&titles=${encodeURIComponent(title)}&format=json&formatversion=2`;
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  return ((await r.json()).query?.pages?.[0]?.extract || "").trim();
}

async function speeches(maxWords = 2800) {
  const dir = "corpus/baseline/gov-speeches";
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  // separate quotas so inaugurals get represented alongside the more numerous SOTUs
  const sotu = (await wikisourceTitles("State of the Union Address", "State of the Union")).slice(0, 18);
  const inaug = (await wikisourceTitles("Inaugural Address", "Inaugural")).slice(0, 10);
  const titles = [...new Set([...sotu, ...inaug])];
  let n = 0;
  for (const t of titles) {
    try {
      const text = await extract(t);
      if (wc(text) < 400) continue;
      writeFileSync(`${dir}/${slug(t)}.txt`, cap(text, maxWords) + "\n"); n++;
    } catch (e) { console.log(`speech "${t}": ${e.message}`); }
    await sleep(150);
  }
  console.log(`gov-speeches: ${n} addresses (${sotu.length} SOTU + ${inaug.length} inaugural sought)`);
  return n;
}

// Replace any prior baseline layout.
for (const d of ["wikinews", "gutenberg", "scotus"]) rmSync(`corpus/baseline/${d}`, { recursive: true, force: true });
const n = await speeches();

writeFileSync("corpus/baseline/SOURCES.md", `# Baseline sources

Human reference corpus for \`slop-lint --discover\`, built by \`build-baseline.mjs\`
(\`npm run baseline\`). **US federal government works** - **public domain** and **modern**
(past ~50 years). Re-run to refresh.

Register caveat: these are FORMAL political oratory, not casual prose. They give modern
vocabulary without copyright encumbrance; the strongest baseline is your own trusted
contemporary writing in the prompt genres.

## Presidential speeches (${n} files, \`gov-speeches/\`)

State of the Union and Inaugural addresses, Ford through Biden. The speech text is a US
government work and therefore public domain. Retrieved from English Wikisource
(https://en.wikisource.org/); see filenames for titles.
`);
console.log(`Wrote SOURCES.md (${n} files)`);
