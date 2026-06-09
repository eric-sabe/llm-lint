# corpus/

Data for `slop-lint --discover`, which finds **candidate new tells** by frequency:
tokens that are far more common in model output than in a reference set, and not yet in
the catalogue, are surfaced for review.

```
baseline/         human-written reference text
samples/<model>/  one folder per model, holding that model's answers to the prompt set
```

Per-model folders are the point: because every model answers the **same** fixed prompts
(`../prompts.json`), topic is held constant, so two comparisons become possible.

- **vs human** (general LLM tells): `--samples corpus/samples/<model> --baseline corpus/baseline`
- **vs the other models** (that model's signature, topic controlled):
  `--samples corpus/samples/<model> --baseline corpus/samples/<other1>,corpus/samples/<other2>`

`--samples` and `--baseline` both accept a comma-separated list of folders.

## Generating samples

Filling `samples/<model>/` is a local maintainer task (it needs API keys, which never go
near CI). Set the provider keys, then:

```bash
node generate-samples.mjs --dry-run     # see what would run, no API calls
node --env-file-if-exists=.env generate-samples.mjs   # generate for every model whose key is set
```

Re-run when a model ships a new version (bump the `*_MODEL` ids in `.env` first; see
`../.env.example`), commit the refreshed `samples/`, and the monthly refresh will mine it
with no keys needed.

## The example folder

`samples/example-llm/` and `baseline/human-sample.md` are tiny illustrative files so the
demo runs out of the box. They are **not** real model output, and the baseline does not
match the prompts' genres, so the demo will over-rank topic words (`organizations`,
`insights`). For real signal, generate proper samples and use a genre-matched human
baseline; a human reviewer then keeps the style tells and drops the topic words.
