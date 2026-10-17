import type { Clip } from "@openreel/core";

export function trimBounds(clip: Clip, edge: "left" | "right", time: number, sourceDuration = Infinity) {
  const speed = clip.speed || 1;
  const startTime = edge === "left"
    ? Math.max(0, clip.startTime - clip.inPoint / speed, Math.min(time, clip.startTime + clip.duration - 0.1))
    : clip.startTime;
  const endTime = edge === "right"
    ? Math.max(startTime + 0.1, Math.min(time, startTime + (sourceDuration - clip.inPoint) / speed))
    : clip.startTime + clip.duration;
  const inPoint = clip.inPoint + (startTime - clip.startTime) * speed;
  return { startTime, duration: endTime - startTime, inPoint, outPoint: inPoint + (endTime - startTime) * speed };
}
