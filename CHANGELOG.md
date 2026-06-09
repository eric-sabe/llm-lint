# Changelog

Notable changes to the slop-lint tool and its tell catalogue. Format roughly follows
[Keep a Changelog](https://keepachangelog.com/); the package version and the catalogue
version move together.

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
