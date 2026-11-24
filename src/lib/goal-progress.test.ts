import { describe, expect, it } from "vitest";
import { goalProgress } from "./goal-progress";

describe("goal progress", () => {
  it("calculates checked semesters relative to active semesters", () => {
    expect(goalProgress([true, false, false, false], [true, true, false, false])).toBe(50);
    expect(goalProgress([true, true, false, false], [true, true, false, false])).toBe(100);
    expect(goalProgress([true, false, false, false], [true, true, true, true])).toBe(25);
    expect(goalProgress([true, false, false, false], [true, true, true, false])).toBe(33);
  });
  it("excludes inactive semesters even when marked", () => {
    expect(goalProgress([true, true, false, false], [false, true, true, false])).toBe(50);
  });
  it("returns zero when no semester is active", () => {
    expect(goalProgress([true, true, true, true], [false, false, false, false])).toBe(0);
  });
});