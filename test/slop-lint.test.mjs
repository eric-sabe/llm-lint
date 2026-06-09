import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lintText, walkFiles, discover, WORDS, WORD_GROUPS, PHRASES, VERSION } from "../slop-lint.mjs";

test("em-dash is the one hard failure", () => {
  const { em, hits } = lintText("We shipped it — and it worked.");
  assert.equal(em, 1);
  assert.ok(hits.some((h) => h.includes("em-dash")));
});

test("counts multiple em-dashes on a line", () => {
  assert.equal(lintText("a — b — c").em, 2);
});

test("clean prose has no failures and no warnings", () => {
  const { em, hits } = lintText("The build finished in 3 seconds. Tests pass.");
  assert.equal(em, 0);
  assert.equal(hits.length, 0);
});

test("flags focal and marketing words (warnings, not failures)", () => {
  const { em, hits } = lintText("We leverage synergy to delve into robust solutions.");
  assert.equal(em, 0);
  for (const w of ["leverage", "synergy", "delve", "robust"]) {
    assert.ok(hits.some((h) => h.includes(`word "${w}"`)), `expected to flag ${w}`);
  }
});

test("flags cliche intros and constructions", () => {
  assert.ok(lintText("In today's fast-paced world, things change.").hits.some((h) => h.includes("intro")));
  assert.ok(lintText("It's not about speed, it's about trust.").hits.some((h) => h.includes("negated contrast")));
});

test("flags double-hyphen em-dash substitute and emoji", () => {
  assert.ok(lintText("yes -- really").hits.some((h) => h.includes("--")));
  assert.ok(lintText("ship it 🚀").hits.some((h) => h.includes("emoji")));
});

test("word matching is case-insensitive and whole-word", () => {
  assert.ok(lintText("LEVERAGE this").hits.some((h) => h.includes('word "leverage"')));
  assert.equal(lintText("the leveraged buyout").hits.filter((h) => h.includes('word "leverage"')).length, 0);
});

test("catalogue is non-trivial", () => {
  assert.ok(WORDS.length > 50);
  assert.ok(PHRASES.length > 25);
});

test("walkFiles recurses dirs, filters extensions, includes explicit files as-is", () => {
  const md = walkFiles(["."]);
  assert.ok(md.includes("README.md"));
  assert.ok(!md.some((p) => p.endsWith(".json")), "should not pick up .json by default");
  assert.deepEqual(walkFiles(["package.json"]), ["package.json"]); // explicit file, any extension
});

test("walkFiles --ignore substring is honored", () => {
  assert.ok(!walkFiles(["."], { ignore: ["README"] }).includes("README.md"));
});

test("catalogue is sourced: every group has since + source, and WORDS derives from them", () => {
  for (const g of WORD_GROUPS) {
    assert.ok(g.since && g.source && Array.isArray(g.words) && g.words.length);
  }
  const flat = WORD_GROUPS.flatMap((g) => g.words);
  assert.deepEqual(WORDS, flat);
  assert.equal(new Set(WORDS).size, WORDS.length, "no duplicate words across groups");
});

test("VERSION is a semver-ish string", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test("discover surfaces over-represented tokens and bigrams, excluding catalogue words", () => {
  const samples = ["widgets widgets widgets shiny widgets shiny widgets shiny"];
  const baseline = ["a quiet ordinary afternoon by the river with friends and bread"];
  const cands = discover(samples, baseline, { top: 10, minCount: 2 });
  const tokens = cands.map((c) => c.token);
  assert.ok(tokens.includes("widgets"), "should surface the over-represented unigram");
  assert.ok(tokens.includes("shiny widgets"), "should surface the over-represented bigram");
});

test("discover never re-proposes a word already in the catalogue", () => {
  const cands = discover(["delve delve delve delve"], ["river river"], { minCount: 1 });
  assert.ok(!cands.some((c) => c.token === "delve"));
});

test("prompts.json and models.json are valid and consistent", () => {
  const p = JSON.parse(readFileSync("prompts.json", "utf8"));
  const m = JSON.parse(readFileSync("models.json", "utf8"));
  assert.ok(p.version && p.prompts.length >= 10, "a versioned, non-trivial prompt set");
  const ids = p.prompts.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "prompt ids are unique");
  assert.ok(p.prompts.every((x) => x.id && x.genre && x.prompt), "each prompt has id/genre/prompt");
  assert.ok(m.models.length && m.models.every((x) => x.id && x.provider && x.model && x.key), "each model has id/provider/model/key");
});
