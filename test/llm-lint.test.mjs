import { test } from "node:test";
import assert from "node:assert/strict";
import { lintText, walkFiles, WORDS, PHRASES } from "../llm-lint.mjs";

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
