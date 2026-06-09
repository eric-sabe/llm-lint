# corpus/

Data for `slop-lint --discover`, which finds **candidate new tells** by frequency:
tokens that are far more common in model output than in a reference set, and not yet in
the catalogue, are surfaced for review.

```
baseline/         modern human reference prose (built by ../build-baseline.mjs; see SOURCES.md)
  gov-speeches/     US presidential SOTU + inaugural addresses (public domain) - oratory
  medlineplus/      NIH MedlinePlus health summaries (public domain) - plain explainer
  wikinews/         English Wikinews articles (CC BY) - journalism
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

## The baseline

`baseline/` is built by `../build-baseline.mjs` (`npm run baseline`) from **modern,
permissively-licensed** sources across three registers - presidential addresses (public
domain oratory), NIH MedlinePlus health summaries (public-domain plain explainer), and
Wikinews (CC BY journalism); see `baseline/SOURCES.md`. This fixes the dated-vocabulary
problem a literary baseline has and broadens register. Caveat: it is still edited/formal,
not casual chat, so it uses the em-dash more than plain typed text would; the **vs-pool**
comparison (a model against the other models on identical prompts) holds register and topic
constant and stays the more reliable read. The strongest baseline you can supply is a large
body of your own trusted contemporary prose - drop it in and re-run.

`samples/example-llm/` is a tiny illustrative folder (not real model output) so the demo
runs before you generate anything.
