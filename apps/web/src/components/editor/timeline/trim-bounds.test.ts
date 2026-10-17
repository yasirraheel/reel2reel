import { describe, it, expect } from "vitest";
import type { Clip } from "@openreel/core";
import { trimBounds } from "./trim-bounds";

const clip = { startTime: 0, duration: 5, inPoint: 0, outPoint: 5 } as Clip;
describe("source and timeline trim bounds", () => {
  it("extends the source out point beyond the old five-second boundary", () => {
    expect(trimBounds(clip, "right", 12, 20)).toEqual({ startTime: 0, duration: 12, inPoint: 0, outPoint: 12 });
  });
  it("cannot extend video past the source end", () => {
    expect(trimBounds(clip, "right", 30, 20).outPoint).toBe(20);
  });
  it("keeps the source end when moving the in point", () => {
    expect(trimBounds(clip, "left", 2, 20)).toEqual({ startTime: 2, duration: 3, inPoint: 2, outPoint: 5 });
  });
  it("converts timeline seconds to source seconds for speed changes", () => {
    expect(trimBounds({ ...clip, speed: 2 }, "right", 8, 20).outPoint).toBe(16);
  });
});
