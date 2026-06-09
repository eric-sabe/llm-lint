# slop-lint

A tiny, zero-dependency linter that flags **AI slop** in prose: the **LLM writing tells** that make text read like a language model wrote it. It **fails on the em-dash** (the one near-decisive AI typographic tell) and **warns** on the words, cliches, and constructions that give it away.

One file. No dependencies. No config. Node 18+.

```
$ npx github:eric-sabe/slop-lint posts/
posts/launch.md
  3: ✗ em-dash ×1  We built a tool, and honestly, it changed everything
  7: ⚠ word "leverage"
  7: ⚠ "in today's ... world" intro
  9: ⚠ "it's not X, it's Y" negated contrast

1 em-dash failure(s), 3 warning(s) across 1 file(s).
FAIL on em-dash; warnings are prompts to review, not bans.
```

## Why

LLM prose has tells. Some are decisive (the em-dash, used where a human would type a comma or a period), most are soft (focal words like "delve" and "tapestry", marketing verbs like "leverage" and "empower", scene-setting intros, hedge-and-pivot constructions). `slop-lint` separates the two:

- **The em-dash is a hard failure** (exit code 1). It is the single most reliable signal and rarely typed by hand.
- **Everything else is a warning.** These words appear in good human writing too, so the tool flags them for a look and never edits anything. A low false-negative rate matters more than zero false positives.

It is deliberately conservative. The goal is a fast review prompt plus a CI gate on the one tell worth gating on, not an automated style police.

## Usage

No install (run straight from GitHub):

```bash
npx github:eric-sabe/slop-lint .
```

Or copy the single file into your project and run it with Node:

```bash
curl -O https://raw.githubusercontent.com/eric-sabe/slop-lint/main/slop-lint.mjs
node slop-lint.mjs .
```

Or install it as a dev dependency:

```bash
npm i -D github:eric-sabe/slop-lint
npx slop-lint .
```

### Examples

```bash
node slop-lint.mjs                      # scan the current directory (recursive)
node slop-lint.mjs README.md docs/      # specific files and/or directories
node slop-lint.mjs --ext .md,.mdx src   # restrict which extensions to walk
node slop-lint.mjs --ignore drafts .    # skip paths containing a substring (repeatable)
node slop-lint.mjs --fail-on-warn .     # strict mode: exit 1 on warnings too
node slop-lint.mjs --quiet .            # only print files that have hits
git ls-files '*.md' | xargs node slop-lint.mjs   # only tracked markdown
```

### Options

| Flag | Effect |
|---|---|
| `--ext .a,.b` | Extensions to walk in directories (default `.md .markdown .mdx .txt`). |
| `--ignore <substr>` | Skip any path containing this substring. Repeatable. |
| `--fail-on-warn` | Exit 1 on warnings as well as em-dashes. |
| `--quiet` | Only print files that have hits. |
| `--list` | Print the catalogue grouped by source. |
| `--version` | Print the catalogue version. |
| `--help` | Usage. |

Directories are walked with the extension filter and skip `node_modules .git dist build .next out vendor coverage`. **Files you name explicitly are always linted, regardless of extension.**

### Exit codes

- `0` clean (or warnings only, without `--fail-on-warn`).
- `1` at least one em-dash (or any warning under `--fail-on-warn`).

## In CI (GitHub Actions)

```yaml
name: prose
on: [push, pull_request]
jobs:
  slop-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npx github:eric-sabe/slop-lint .
```

## Programmatic use

The file exports its internals, so you can build on it:

```js
import { lintText, WORDS, PHRASES } from "slop-lint";

const { em, hits } = lintText("In today's fast-paced world we leverage synergy.");
// em   -> number of em-dashes (the failure)
// hits -> array of formatted report lines (warnings and failures)
```

## What it flags

- **Em-dash** (U+2014): failure.
- **~100 focal and marketing words**: delve, intricate, meticulous, pivotal, tapestry, realm, testament, leverage, synergy, robust, seamless, holistic, empower, harness, unleash, landscape, journey, ecosystem, bolster, groundbreaking, renowned, innovative, streamline, actionable, and friends.
- **~45 phrases and constructions**: "in today's ... world", "plays a crucial role", "it's worth noting that", "let's dive in", "in conclusion", "as an AI language model", "rich cultural heritage", "a diverse array of", "not just X but Y", "it's not X, it's Y", and more.
- **Double hyphen** used as an em-dash substitute, **smart/curly quotes** (a generator/word-processor tell), and **emoji**.

The catalogue draws on corpus studies (the FSU "delve" focal-word analysis, a PubMed 135-term study, Gray's "meticulously commendable") plus published Pangram / Grammarly / practitioner blacklists. Tune `WORDS` and `PHRASES` at the top of `slop-lint.mjs` to taste.

## Keeping the catalogue current

Tells are a moving target: each model family brings new ones, and old ones fade as models are trained against them. So the catalogue is **sourced and versioned**, and there are tools to keep it honest.

- **Sourced + versioned.** Words live in `WORD_GROUPS`, each carrying a `since` version and a `source`. `slop-lint --list` prints the catalogue with its provenance; `slop-lint --version` prints the catalogue version; [`CHANGELOG.md`](CHANGELOG.md) records what changed and when. To retire a faded tell, delete it and note it in the changelog.
- **Find new tells by measuring, not guessing.** `--discover` compares word and bigram frequency in model output against a human baseline and ranks the over-represented, not-yet-catalogued tokens. This is how "delve" was found; re-run it against each new model's output.

  ```bash
  slop-lint --discover --samples corpus/samples --baseline corpus/baseline
  ```

  Both `--samples` and `--baseline` take a comma-separated list of folders, so a model can be compared against a human baseline (general LLM tells) or against the **pool of other models** on the same prompts (that model's signature, with topic held constant). The model-vs-pool comparison is the more reliable one, because identical prompts hold topic constant; vs-human only works with a large, genre-matched human baseline. A `--min-docs` floor (default 3) requires a candidate to recur across multiple answers, so one-off artifacts are dropped; frontmatter is ignored.
- **Generate the samples instead of pasting them.** `generate-samples.mjs` sends a fixed, genre-varied prompt set ([`prompts.json`](prompts.json)) to each model in [`models.json`](models.json) and writes `corpus/samples/<model>/`. Every model answers the same prompts, so differences are style, not subject. This is a local task (it needs API keys, which never touch CI); commit the result and the sweep mines it keyless.

  ```bash
  node generate-samples.mjs --dry-run    # what would run, no API calls
  node --env-file-if-exists=.env generate-samples.mjs   # generate for every model whose key is set
  ```

  Set the model versions in `.env` (`XAI_MODEL`, `ANTHROPIC_MODEL`, etc.; copy `.env.example`) and just bump them there when a new model ships - no code or tracked-config edits. See [`corpus/README.md`](corpus/README.md).
- **Build the human baseline** with `npm run baseline` (`build-baseline.mjs`): pulls **public-domain US presidential speeches** (State of the Union + Inaugural addresses, Ford..Biden) from Wikisource into `corpus/baseline/` - modern vocabulary, no licensing encumbrance. The strongest baseline is a large body of your own trusted contemporary prose; this is a reproducible starter. (Note: vs-human is only as good as the baseline, and even modern oratory uses the em-dash heavily, so cross-model stays the more reliable read.)
- **Measure typography** with `npm run stats` (`corpus-stats.mjs`): em-dash, smart-quote, semicolon, ellipsis, and bold rates per model - the typographic tells the word-based `--discover` can't see (GPT/Grok emit ~9 curly quotes per 1k words; Claude none). One caveat it surfaced: literary/typeset human prose also em-dashes heavily, so the em-dash is a tell of *plain modern typed text* (posts, email, markdown), which is what slop-lint targets - not of prose in general.
- **A monthly sweep does this for you.** `.github/workflows/catalogue-refresh.yml` runs `refresh.mjs` on a schedule, with no secrets: it combines corpus discovery with a coverage diff against the public Wikipedia "Signs of AI writing" essay, and files the candidates as a GitHub issue to review.

Accepting a candidate means adding it to `WORD_GROUPS` (or `PHRASES`) with a source, noting it in `CHANGELOG.md`, and bumping the version. Keep the conservative bias: a tell earns its place with a source, and fading tells get pruned.

## Contributing

Issues and PRs welcome, especially new tells with a source, and false positives worth pruning. Keep it dependency-free and a single file.

## License

[MIT](LICENSE).
