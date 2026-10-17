import { describe, it, expect, vi } from "vitest";
import { drawCornerWarp } from "./corner-warp";

function context() {
  return { drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), clip: vi.fn(), transform: vi.fn() };
}
describe("four corner rendering", () => {
  it("keeps the normal draw path when no corner adjustment is present", () => {
    const ctx = context();
    const source = {} as CanvasImageSource;
    drawCornerWarp(ctx as unknown as CanvasRenderingContext2D, source, undefined, 10, 20, 100, 80, -50, -40, 100, 80);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(source, 10, 20, 100, 80, -50, -40, 100, 80);
    expect(ctx.transform).not.toHaveBeenCalled();
  });
  it("moves all corners without changing texture scale", () => {
    const ctx = context();
    const offset = { x: 0.25, y: 0.1 };
    drawCornerWarp(ctx as unknown as CanvasRenderingContext2D, {} as CanvasImageSource,
      { topLeft: offset, topRight: offset, bottomLeft: offset, bottomRight: offset },
      0, 0, 100, 100, 0, 0, 100, 100);
    const matrix = ctx.transform.mock.calls[0];
    [1,0,0,1,25,10].forEach((value, index) => expect(matrix[index]).toBeCloseTo(value));
    expect(ctx.save.mock.calls.length).toBe(ctx.restore.mock.calls.length);
  });
  it("moves only the selected corner", () => {
    const ctx = context();
    drawCornerWarp(ctx as unknown as CanvasRenderingContext2D, {} as CanvasImageSource,
      { topLeft: {x:0.2,y:0.1}, topRight:{x:0,y:0}, bottomLeft:{x:0,y:0}, bottomRight:{x:0,y:0} },
      0,0,100,100,0,0,100,100);
    expect(ctx.moveTo).toHaveBeenCalledWith(20,10);
    expect(ctx.lineTo).toHaveBeenCalledWith(100,100);
  });
});
