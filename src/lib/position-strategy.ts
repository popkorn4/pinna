import { POSITION_STEP } from "@/lib/position";

// почему 0.001: при midpoint-вставках разница между соседями делится пополам
// — после ~10 вставок подряд между одной парой получается ~10⁻³. Это нижний
// порог точности, дальше нужно перенумеровать колонку (rebalance).
export const MIN_GAP = 0.001;

/**
 * Возвращает новую позицию между before и after.
 * Если before/after не заданы — позиционирует относительно края (start/end).
 */
export function midpoint(
  before?: number | null,
  after?: number | null,
): number {
  if (before == null && after == null) return POSITION_STEP;
  if (before == null && after != null) return after / 2;
  if (before != null && after == null) return before + POSITION_STEP;
  // оба заданы
  return ((before as number) + (after as number)) / 2;
}

/**
 * true — если соседние позиции "слиплись" и нужен ребаланс колонки.
 */
export function needsRebalance(prev: number, next: number): boolean {
  return Math.abs(next - prev) < MIN_GAP;
}

/**
 * Перераспределение позиций в колонке с шагом POSITION_STEP.
 */
export function rebalancedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}
