export const EVOLUTION_THRESHOLDS = Object.freeze({
  1: 3,
  2: 10,
  3: 25,
});

export const DEFAULT_LINEAGES = Object.freeze([
  "ANIMAL",
  "ANCIENT",
  "SPIRIT",
  "ARCHETYPE",
  "DATA",
]);

export function computeStageFromCardCount(cardCount) {
  if (cardCount >= EVOLUTION_THRESHOLDS[3]) return 3;
  if (cardCount >= EVOLUTION_THRESHOLDS[2]) return 2;
  if (cardCount >= EVOLUTION_THRESHOLDS[1]) return 1;
  return 0;
}

export function nextEvolutionAt(stage) {
  if (stage <= 0) return EVOLUTION_THRESHOLDS[1];
  if (stage === 1) return EVOLUTION_THRESHOLDS[2];
  if (stage === 2) return EVOLUTION_THRESHOLDS[3];
  return null;
}

export function randomLineage(rng = Math.random, lineages = DEFAULT_LINEAGES) {
  const index = Math.floor(rng() * lineages.length);
  return lineages[Math.min(index, lineages.length - 1)];
}

export function pickWeightedRandom(
  candidates,
  rng = Math.random
) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce(
    (sum, candidate) => sum + Math.max(candidate.weight ?? 1, 1),
    0
  );
  let cursor = rng() * totalWeight;

  for (const candidate of candidates) {
    cursor -= Math.max(candidate.weight ?? 1, 1);
    if (cursor <= 0) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}
