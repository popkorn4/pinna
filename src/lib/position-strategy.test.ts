import { describe, it, expect } from "vitest";

import { POSITION_STEP } from "@/lib/position";
import {
  MIN_GAP,
  midpoint,
  needsRebalance,
  rebalancedPositions,
} from "./position-strategy";

describe("midpoint", () => {
  it("возвращает шаг по умолчанию для пустой колонки", () => {
    expect(midpoint()).toBe(POSITION_STEP);
  });

  it("вставляет в начало (before=null)", () => {
    expect(midpoint(null, 100)).toBe(50);
  });

  it("вставляет в конец (after=null)", () => {
    expect(midpoint(100, null)).toBe(100 + POSITION_STEP);
  });

  it("вставляет между двумя соседями", () => {
    expect(midpoint(100, 200)).toBe(150);
    expect(midpoint(1024, 2048)).toBe(1536);
  });

  it("вставка между близкими соседями даёт схлопывание", () => {
    const a = 1.0;
    const b = 1.0 + MIN_GAP / 2;
    const m = midpoint(a, b);
    expect(needsRebalance(a, m)).toBe(true);
  });
});

describe("needsRebalance", () => {
  it("false при нормальном зазоре", () => {
    expect(needsRebalance(1024, 2048)).toBe(false);
    expect(needsRebalance(0, 1)).toBe(false);
  });

  it("true когда позиции слиплись", () => {
    expect(needsRebalance(1.0, 1.0 + MIN_GAP / 10)).toBe(true);
    expect(needsRebalance(0.5, 0.5)).toBe(true);
  });
});

describe("rebalancedPositions", () => {
  it("возвращает массив с шагом POSITION_STEP", () => {
    expect(rebalancedPositions(3)).toEqual([
      POSITION_STEP,
      POSITION_STEP * 2,
      POSITION_STEP * 3,
    ]);
    expect(rebalancedPositions(0)).toEqual([]);
  });
});
