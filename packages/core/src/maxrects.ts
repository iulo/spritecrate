/**
 * Adapted from free-tex-packer-core/packers/MaxRectsBin.js
 * f918f61569e669df61825ec1040540f1d8470acb
 * Copyright (c) 2018 Alexander Norinchak. MIT, see ../LICENSES.
 * Stable scoring, explicit physical dimensions and five placement heuristics.
 */
import type { Rect } from './model.js';

export const HEURISTICS = [
  'short-side-fit',
  'long-side-fit',
  'area-fit',
  'bottom-left',
  'contact-point',
] as const;
export type Heuristic = (typeof HEURISTICS)[number];
export interface SearchBudget {
  remaining: number;
}
export interface Placement extends Rect {
  rotated: boolean;
  primary: number;
  secondary: number;
}

export class MaxRects {
  private free: Rect[];
  private used: Rect[] = [];

  constructor(
    private width: number,
    private height: number,
    private heuristic: Heuristic = 'short-side-fit',
  ) {
    this.free = [{ x: 0, y: 0, w: width, h: height }];
  }

  score(w: number, h: number, rotate: boolean, budget?: SearchBudget): Placement | undefined {
    if (budget) {
      const cost =
        this.free.length *
        (rotate && w !== h ? 2 : 1) *
        (this.heuristic === 'contact-point' ? this.used.length + 1 : 1);
      if (cost > budget.remaining) {
        budget.remaining = 0;
        return undefined;
      }
      budget.remaining -= cost;
    }
    let best: Placement | undefined;
    for (const rect of this.free) {
      for (const rotated of rotate && w !== h ? [false, true] : [false]) {
        const width = rotated ? h : w,
          height = rotated ? w : h;
        if (width > rect.w || height > rect.h) continue;
        const short = Math.min(rect.w - width, rect.h - height);
        const long = Math.max(rect.w - width, rect.h - height);
        let primary = short,
          secondary = long;
        switch (this.heuristic) {
          case 'long-side-fit':
            primary = long;
            secondary = short;
            break;
          case 'area-fit':
            primary = rect.w * rect.h - width * height;
            secondary = short;
            break;
          case 'bottom-left':
            primary = rect.y + height;
            secondary = rect.x;
            break;
          case 'contact-point':
            primary = -this.contact(rect.x, rect.y, width, height);
            secondary = 0;
            break;
        }
        const candidate = {
          x: rect.x,
          y: rect.y,
          w: width,
          h: height,
          rotated,
          primary,
          secondary,
        };
        if (!best || comparePlacement(candidate, best) < 0) best = candidate;
      }
    }
    return best;
  }

  private contact(x: number, y: number, w: number, h: number): number {
    let score =
      (x === 0 || x + w === this.width ? h : 0) + (y === 0 || y + h === this.height ? w : 0);
    for (const used of this.used) {
      if (used.x + used.w === x || x + w === used.x)
        score += Math.max(0, Math.min(y + h, used.y + used.h) - Math.max(y, used.y));
      if (used.y + used.h === y || y + h === used.y)
        score += Math.max(0, Math.min(x + w, used.x + used.w) - Math.max(x, used.x));
    }
    return score;
  }

  place(used: Rect): void {
    if (this.heuristic === 'contact-point') this.used.push(used);
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
    a.primary - b.primary ||
    a.secondary - b.secondary ||
    a.y - b.y ||
    a.x - b.x ||
    Number(a.rotated) - Number(b.rotated)
  );
}
