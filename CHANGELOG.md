# Changelog

Notable changes to the slop-lint tool and its tell catalogue. Format roughly follows
[Keep a Changelog](https://keepachangelog.com/); the package version and the catalogue
version move together.

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
