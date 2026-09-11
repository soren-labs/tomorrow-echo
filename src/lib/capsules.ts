import type { Capsule, CapsuleState } from "../contracts";
import type { CapsuleRow } from "../db/schema";

/**
 * Brier-style score: round(100 * (1 - (p - y)^2)) with p = probability/100
 * and y = 1 when the prediction happened, 0 when it did not. `false` is a
 * real outcome — a resolved capsule with outcome=false still scores.
 */
export function computeScore(probability: number, outcome: boolean): number {
  const p = probability / 100;
  const y = outcome ? 1 : 0;
  return Math.round(100 * (1 - (p - y) * (p - y)));
}

export function capsuleState(
  capsule: Pick<CapsuleRow, "resolvedAt" | "unlockAt">,
  serverNow: Date,
): CapsuleState {
  if (capsule.resolvedAt !== null) return "resolved";
  return serverNow.getTime() >= capsule.unlockAt.getTime() ? "ready" : "sealed";
}

export function toCapsuleDto(row: CapsuleRow, serverNow: Date): Capsule {
  const resolved = row.resolvedAt !== null;
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    probability: row.probability,
    createdAt: row.createdAt.toISOString(),
    unlockAt: row.unlockAt.toISOString(),
    state: capsuleState(row, serverNow),
    outcome: row.outcome,
    reflection: row.reflection,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    score: resolved && row.outcome !== null ? computeScore(row.probability, row.outcome) : null,
  };
}
