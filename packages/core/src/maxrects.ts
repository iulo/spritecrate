/**
 * Adapted from free-tex-packer-core/packers/MaxRectsBin.js
 * f918f61569e669df61825ec1040540f1d8470acb
 * Copyright (c) 2018 Alexander Norinchak. MIT, see ../LICENSES.
 * Best-short-side-fit only; stable scoring and explicit physical dimensions.
 */
import type { Rect } from './model.js';

export interface Placement extends Rect {
  rotated: boolean;
  short: number;
  long: number;
}

export class MaxRects {
  private free: Rect[];

  constructor(width: number, height: number) {
    this.free = [{ x: 0, y: 0, w: width, h: height }];
  }

  score(w: number, h: number, rotate: boolean): Placement | undefined {
    let best: Placement | undefined;
    for (const rect of this.free) {
      for (const rotated of rotate && w !== h ? [false, true] : [false]) {
        const width = rotated ? h : w;
        const height = rotated ? w : h;
        if (width > rect.w || height > rect.h) continue;
        const candidate = {
          x: rect.x,
          y: rect.y,
          w: width,
          h: height,
          rotated,
          short: Math.min(rect.w - width, rect.h - height),
          long: Math.max(rect.w - width, rect.h - height),
        };
        if (!best || comparePlacement(candidate, best) < 0) best = candidate;
      }
    }
    return best;
  }

  place(used: Rect): void {
    const next: Rect[] = [];
    for (const free of this.free) {
      if (
        used.x >= free.x + free.w ||
        used.x + used.w <= free.x ||
        used.y >= free.y + free.h ||
        used.y + used.h <= free.y
      ) {
        next.push(free);
        continue;
      }
      if (used.x > free.x) next.push({ ...free, w: used.x - free.x });
      if (used.x + used.w < free.x + free.w)
        next.push({ ...free, x: used.x + used.w, w: free.x + free.w - used.x - used.w });
      if (used.y > free.y) next.push({ ...free, h: used.y - free.y });
      if (used.y + used.h < free.y + free.h)
        next.push({ ...free, y: used.y + used.h, h: free.y + free.h - used.y - used.h });
    }
    this.free = next.filter(
      (a, i) =>
        !next.some(
          (b, j) =>
            i !== j &&
            a.x >= b.x &&
            a.y >= b.y &&
            a.x + a.w <= b.x + b.w &&
            a.y + a.h <= b.y + b.h &&
            (a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h || j < i),
        ),
    );
  }
}

export function comparePlacement(a: Placement, b: Placement): number {
  return (
    a.short - b.short ||
    a.long - b.long ||
    a.y - b.y ||
    a.x - b.x ||
    Number(a.rotated) - Number(b.rotated)
  );
}
