# corpus/

Data for `slop-lint --discover`, which finds **candidate new tells** by frequency:
tokens that are far more common in model output than in a human baseline, and not yet
in the catalogue, are surfaced for review.

```
baseline/   human-written text (the reference distribution)
samples/    recent model output (the thing under suspicion)
```

The files here are tiny illustrative examples so the demo runs out of the box. For real
signal, replace them with larger corpora:

- **baseline/**: a few hundred KB of clearly human prose from before the LLM era, or a
  source you trust to be human (your own old writing, public-domain books).
- **samples/**: raw output from the model family you want to characterize. The more, the
  sharper the ranking. Re-fill this with each new model release and re-run discover.

Run it:

```bash
node slop-lint.mjs --discover --samples corpus/samples --baseline corpus/baseline
```

Bigger and cleaner corpora give better candidates. The output is a ranked list to review,
not an auto-update: real tells get added to `WORD_GROUPS` (with a source) and `CHANGELOG.md`.
