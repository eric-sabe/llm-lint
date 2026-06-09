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
- **~60 focal and marketing words**: delve, intricate, meticulous, pivotal, tapestry, realm, testament, leverage, synergy, robust, seamless, holistic, empower, harness, unleash, landscape, journey, ecosystem, and friends.
- **~35 phrases and constructions**: "in today's ... world", "plays a crucial role", "it's worth noting that", "let's dive in", "in conclusion", "not just X but Y", "it's not X, it's Y", and more.
- **Double hyphen** used as an em-dash substitute, and **emoji**.

The catalogue draws on corpus studies (the FSU "delve" focal-word analysis, a PubMed 135-term study, Gray's "meticulously commendable") plus published Pangram / Grammarly / practitioner blacklists. Tune `WORDS` and `PHRASES` at the top of `slop-lint.mjs` to taste.

## Contributing

Issues and PRs welcome, especially new tells with a source, and false positives worth pruning. Keep it dependency-free and a single file.

## License

[MIT](LICENSE).
