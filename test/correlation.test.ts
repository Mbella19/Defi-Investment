import { describe, expect, it } from "vitest";
import { correlationMatrix } from "@/lib/tools/correlation";

describe("APY-change correlation", () => {
  it("detects perfect positive and negative co-movement in changes", () => {
    const matrix = correlationMatrix([
      [1, 10, 5],
      [2, 12, 4],
      [4, 16, 2],
      [7, 22, -1],
    ]);
    expect(matrix[0][1]).toBeCloseTo(1, 10);
    expect(matrix[0][2]).toBeCloseTo(-1, 10);
    expect(matrix[1][2]).toBeCloseTo(-1, 10);
  });

  it("returns an undefined off-diagonal value for a flat series", () => {
    const matrix = correlationMatrix([
      [5, 1],
      [5, 2],
      [5, 4],
    ]);
    expect(Number.isNaN(matrix[0][1])).toBe(true);
    expect(matrix[0][0]).toBe(1);
  });

  it("normalizes changes by elapsed days when history has gaps", () => {
    const matrix = correlationMatrix(
      [
        [0, 0],
        [1, 3],
        [5, 5],
        [8, 7],
      ],
      ["2026-01-01", "2026-01-02", "2026-01-04", "2026-01-05"],
    );
    expect(matrix[0][1]).toBeCloseTo(-0.5, 10);
  });
});
