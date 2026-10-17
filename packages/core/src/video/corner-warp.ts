import type { Transform } from "../types/timeline";

/** Draw a cropped source into an independently adjustable four-corner mesh. */
export function drawCornerWarp(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  corners: Transform["corners"],
  sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
): void {
  if (!corners || Object.values(corners).every(p => p.x === 0 && p.y === 0)) {
    ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  const point = (u: number, v: number) => {
    const { topLeft: a, topRight: b, bottomLeft: c, bottomRight: d } = corners;
    return {
      x: dx + dw * (u + ((1-u)*(1-v)*a.x + u*(1-v)*b.x + (1-u)*v*c.x + u*v*d.x)),
      y: dy + dh * (v + ((1-u)*(1-v)*a.y + u*(1-v)*b.y + (1-u)*v*c.y + u*v*d.y)),
    };
  };
  const triangle = (uv: number[][]) => {
    const p = uv.map(([u,v]) => point(u,v));
    const s = uv.map(([u,v]) => ({ x: sx + u*sw, y: sy + v*sh }));
    const det = (s[1].x-s[0].x)*(s[2].y-s[0].y)-(s[2].x-s[0].x)*(s[1].y-s[0].y);
    if (Math.abs(det) < 1e-8) return;
    const a = ((p[1].x-p[0].x)*(s[2].y-s[0].y)-(p[2].x-p[0].x)*(s[1].y-s[0].y))/det;
    const c = ((s[1].x-s[0].x)*(p[2].x-p[0].x)-(s[2].x-s[0].x)*(p[1].x-p[0].x))/det;
    const b = ((p[1].y-p[0].y)*(s[2].y-s[0].y)-(p[2].y-p[0].y)*(s[1].y-s[0].y))/det;
    const d = ((s[1].x-s[0].x)*(p[2].y-p[0].y)-(s[2].x-s[0].x)*(p[1].y-p[0].y))/det;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[1].x, p[1].y);
    ctx.lineTo(p[2].x, p[2].y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a,b,c,d,p[0].x-a*s[0].x-c*s[0].y,p[0].y-b*s[0].x-d*s[0].y);
    ctx.drawImage(source, sx, sy, sw, sh, sx, sy, sw, sh);
    ctx.restore();
  };
  const steps = 12;
  for (let y=0; y<steps; y++) for (let x=0; x<steps; x++) {
    const u=x/steps, v=y/steps, r=(x+1)/steps, b=(y+1)/steps;
    triangle([[u,v],[r,v],[r,b]]);
    triangle([[u,v],[r,b],[u,b]]);
  }
}
