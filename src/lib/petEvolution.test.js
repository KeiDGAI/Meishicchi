import test from "node:test";
import assert from "node:assert/strict";
import {
  computeStageFromCardCount,
  nextEvolutionAt,
  pickWeightedRandom,
  randomLineage,
} from "./petEvolution.js";

test("computeStageFromCardCount only evolves on new-card thresholds", () => {
  assert.equal(computeStageFromCardCount(0), 0);
  assert.equal(computeStageFromCardCount(2), 0);
  assert.equal(computeStageFromCardCount(3), 1);
  assert.equal(computeStageFromCardCount(10), 2);
  assert.equal(computeStageFromCardCount(25), 3);
});

test("nextEvolutionAt returns null on max stage", () => {
  assert.equal(nextEvolutionAt(0), 3);
  assert.equal(nextEvolutionAt(1), 10);
  assert.equal(nextEvolutionAt(2), 25);
  assert.equal(nextEvolutionAt(3), null);
});

test("randomLineage picks a lineage within defined list", () => {
  const lineage = randomLineage(() => 0.99, ["ANIMAL", "DATA"]);
  assert.equal(lineage, "DATA");
});

test("pickWeightedRandom always returns candidate from allowed set", () => {
  const result = pickWeightedRandom(
    [
      { key: "a", weight: 1 },
      { key: "b", weight: 3 },
    ],
    () => 0.7
  );

  assert.ok(result);
  assert.ok(["a", "b"].includes(result.key));
});

test("pickWeightedRandom returns null for empty candidate list", () => {
  assert.equal(pickWeightedRandom([], () => 0.5), null);
});
