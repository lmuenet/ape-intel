import { describe, expect, it } from "vitest";
import { sparklinePoints } from "./sparkline";

describe("sparklinePoints", () => {
  it("maps a rising series across the full width and inverted height", () => {
    // min=1 → y=height(10); max=3 → y=0; mid=2 → y=5. width=100, 3 points.
    expect(sparklinePoints([1, 2, 3], 100, 10)).toBe("0.0,10.0 50.0,5.0 100.0,0.0");
  });
  it("draws a flat series on the mid-line", () => {
    expect(sparklinePoints([5, 5], 100, 10)).toBe("0.0,5.0 100.0,5.0");
  });
  it("places a single value at x=0 on the mid-line", () => {
    expect(sparklinePoints([7], 100, 10)).toBe("0.0,5.0");
  });
  it("returns an empty string for no values", () => {
    expect(sparklinePoints([], 100, 10)).toBe("");
  });
});
