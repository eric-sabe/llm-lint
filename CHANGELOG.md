# Changelog

Notable changes to the slop-lint tool and its tell catalogue. Format roughly follows
[Keep a Changelog](https://keepachangelog.com/); the package version and the catalogue
version move together.

## [0.8.0]

### Changed

- **Baseline is now three modern registers**, not just oratory (Perplexity-scouted, then
  endpoint-verified). `build-baseline.mjs` pulls: US presidential addresses (public domain,
  oratory), **NIH MedlinePlus** health summaries (public domain, plain-language explainer),
  and **Wikinews** (CC BY, journalism). All keyless and modern (~60k words).
- The plain explainer + journalism registers lowered the baseline's curly-quote rate to
  ~1.9 per 1k words, so GPT/Grok (~9) stand out ~4.7x - the smart-quote tell is now robustly
  validated. Claude/Grok also em-dash above this human baseline (7.x vs 4.2).

### Notes

- Sources evaluated and rejected: Federal Register (keyless, but jargon-dense regulatory
  boilerplate full of model numbers - bad prose); Voice of America (public domain, but no
  clean keyless API); SCOTUS (full text unreliable via free APIs). The honest constraint
  stands: genuinely casual modern prose is almost all copyrighted, so the best baseline you
  can add is your own contemporary writing.
- Even against the broader baseline, the vs-human word pass surfaced no new tells (only
  common words like "modern"/"rather"), so no catalogue change. The linter is unchanged.

## [0.7.0]

### Changed

- **Baseline is now modern public-domain US-government prose.** `build-baseline.mjs` pulls
  presidential State of the Union and Inaugural addresses (Ford..Biden, ~70k words) from
  Wikisource - public domain and contemporary, replacing the dated literary / CC-BY mix.
  This fixes the dated-vocabulary problem: the vs-human word comparison no longer throws up
  artifacts (e.g. "create" at 206x), and it sharpened the smart-quote signal - against the
  modern baseline (3.4 curly quotes per 1k words) GPT and Grok clearly stand out at ~9.

### Notes

- Supreme Court opinions were attempted (the request included them) but dropped: full text
  is unreliable via the free APIs (CourtListener lacks ingested text for many opinions;
  Wikisource transcludes opinions into subpages the extract API misses), and legalese is
  citation-noisy for a prose baseline. Speeches give a cleaner modern reference.
- Even with the modern baseline, the vs-human word pass surfaced no strong uncatalogued
  tells (only low-ratio common words like "often"/"modern"), confirming the catalogue
  already covers the obvious word tells. The em-dash stays ~5/1k even in oratory, so it
  remains a tell of plain typed text. Cross-model remains the most reliable signal.

## [0.6.0]

### Added

- **Smart/curly-quote warning.** Curly quotes and apostrophes (`“” ‘’`) are flagged as a
  generator/word-processor tell. Found empirically: three of four frontier models emit them
  in markdown output (GPT and Grok ~9 per 1k words) while one uses straight quotes.
- **`build-baseline.mjs`** (`npm run baseline`): assembles a human reference corpus for
  `--discover` from permissive sources - English Wikinews (CC BY 2.5) and public-domain
  Project Gutenberg books - with a `corpus/baseline/SOURCES.md` attribution file. Replaces
  the toy placeholder baseline (~43k words across 19 files).
- **`corpus-stats.mjs`** (`npm run stats`): punctuation/structure rates per corpus folder
  (em-dash, smart quotes, semicolons, ellipses, bold), surfacing typographic tells that
  the word-based `--discover` cannot see (e.g. GPT and Grok emit ~9 curly quotes per 1k
  words; Claude emits none).

### Notes

- Measuring punctuation against the baseline corrected an assumption: literary/typeset
  human prose (our Gutenberg baseline) uses the em-dash, curly quotes, and semicolons
  *heavily* too (~7, ~33, ~4 per 1k). So the em-dash is a tell of **plain modern typed
  text** (posts, email, markdown) - slop-lint's target - not of prose in general. The
  hard-fail stands for that target; the corpus does not "prove" it against literary prose.
- With a real (but partly dated, partly literary) baseline, the vs-human word comparison
  improved yet remains register-dominated (older prose under-uses modern words like
  "create"), so the reliable signal is still cross-model. A larger contemporary,
  plain-prose, genre-matched baseline would sharpen vs-human further.

## [0.5.0]

### Added

- **`incredibly`** to the catalogue, the first add sourced from this repo's own corpus
  discovery: one frontier model over-used it (in 7 of 24 answers) vs its peers on identical
  prompts. Source tagged `empirical: cross-model corpus discovery`.
- A real generated corpus under `corpus/samples/<model>/` (four current frontier models,
  24 prompts each) replaces the toy sample as the discovery input.

### Changed

- `--discover` is hardened against two artifacts the first real run exposed:
  - **Frontmatter is stripped** before tokenizing, so YAML keys (`model`, `prompt_id`)
    no longer rank as tells.
  - **Document-frequency floor** (`--min-docs`, default 3): a token must appear across
    multiple sample documents, which drops one-off artifacts (e.g. an invented product
    name repeated within a single answer) and keeps recurring style tells. The candidate
    report now shows a `docs` column.

### Notes

- Cross-model comparison (each model vs the pool of the others on the same prompts) is the
  reliable signal today, because topic is held constant. The vs-human comparison needs a
  larger, genre-matched human baseline to be trustworthy; the committed `corpus/baseline`
  is still a small placeholder.

## [0.4.1]

### Changed

- Model versions are now read from env vars (`ANTHROPIC_MODEL`, `OPENAI_MODEL`,
  `GEMINI_MODEL`, `XAI_MODEL`), so you bump a model version in `.env` without editing
  `models.json` or any code. `models.json` keeps the env-var name (`modelEnv`) and a
  fallback default. Added `.env.example` with the key and model vars.
- OpenAI adapter uses `max_completion_tokens` (required by gpt-5.x), and the default token
  budget is raised to 4000 so reasoning models leave room for a full-length answer.

## [0.4.0]

### Added

- **Sample generation harness.** `generate-samples.mjs` sends a fixed, genre-varied prompt
  set (`prompts.json`) to each model in `models.json` (Anthropic, OpenAI, Google, xAI; raw
  `fetch`, zero-dependency) and writes `corpus/samples/<model>/`. Key-gated and local-only
  (a model whose key env var is unset is skipped), so API keys never touch CI. Supports
  `--dry-run`, `--only`, and `--max`.
- **Per-model corpus + model-vs-pool comparison.** Samples live under
  `corpus/samples/<model>/`, and `--discover` now accepts a comma-separated list of folders
  for `--samples` / `--baseline`. Since every model answers the same prompts, a model can be
  compared against the pool of other models with topic held constant (its style signature),
  in addition to the model-vs-human comparison.

### Notes

- The committed `corpus/samples/example-llm` and `corpus/baseline` are illustrative only;
  generate real samples (and use a genre-matched human baseline) for real signal.

## [0.3.0]

### Added

- First reviewed pass from the catalogue-refresh sweep (sources: the Wikipedia "Signs of
  AI writing" essay plus practitioner blacklists). New words: bolster(s/ed/ing),
  groundbreaking, renowned, exemplifies, encompassing, enhance(s/d/ing), innovative,
  streamline(s/d) / streamlining, actionable, nestled. New phrases: "as an AI/large
  language model" and "I hope this helps" (assistant leakage), "in the heart of",
  "a diverse array of", "valuable insights", "stands/serves as a testament", "setting
  the stage for", "indelible mark", "deeply rooted in", "rich cultural heritage/tapestry".

### Changed

- `refresh.mjs` coverage check now also considers existing phrase rules, so candidates
  already covered by a `PHRASES` pattern (e.g. "in conclusion") are no longer reported.

### Rejected (kept out to avoid false positives)

- Words too common in ordinary writing to gate on: crucial, such as, overall, rich,
  featuring, align with, commitment to, ensuring, refers to.

## [0.2.0]

### Added

- **Sourced catalogue.** Words are grouped in `WORD_GROUPS`, each carrying a `since`
  version and a `source`, so entries can be pruned with confidence as tells fade.
  `slop-lint --list` prints the catalogue with its sources.
- **`--discover` mode.** Frequency analysis (words and bigrams) of model-output samples
  against a human baseline corpus; ranks over-represented, not-yet-catalogued tokens as
  candidate new tells. This is how the original "delve" tell was found, and it re-runs
  against each new model's output. Example corpus under `corpus/`.
- **`--version` flag** and an exported `VERSION` constant.
- **Self-contained monthly catalogue refresh.** `refresh.mjs` assembles candidates from
  corpus discovery plus the public Wikipedia "Signs of AI writing" essay (coverage diff),
  and `.github/workflows/catalogue-refresh.yml` files the report as a GitHub issue for
  human review. No secrets or external services.

### Notes

- Catalogue content is unchanged from 0.1.0; this release adds provenance and the tooling
  to keep the list current as models evolve.

## [0.1.0]

### Added

- Initial release. Em-dash hard-fail (exit 1) plus warnings on ~60 focal/marketing words,
  ~35 cliche phrases and constructions, double-hyphen em-dash substitutes, and emoji.
  Single-file zero-dependency CLI, importable exports (`lintText`, `walkFiles`, `WORDS`,
  `PHRASES`), tests, and CI.
