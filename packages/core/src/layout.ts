import { AtlasError, MAX_IMAGE_PIXELS, MAX_TOTAL_PIXELS } from './model.js';
import type { ResolvedOptions } from './model.js';
import { ceilPowerOfTwo, floorPowerOfTwo } from './options.js';
import { MaxRects, HEURISTICS, comparePlacement } from './maxrects.js';
import type { Heuristic, Placement, SearchBudget } from './maxrects.js';
import type { Prepared } from './preprocess.js';

export interface Placed {
  item: Prepared;
  placement: Placement;
}
export interface LayoutPage {
  width: number;
  height: number;
  placed: Placed[];
}
interface Plan {
  pages: LayoutPage[];
  area: number;
  valid: boolean;
  capW: number;
  capH: number;
}
const GRID_STEPS = 48;
// Deterministic scoring-work limits, not wall-clock deadlines. Baseline is never interrupted.
const STRATEGY_WORK = [8_000_000, 2_000_000, 2_000_000, 2_000_000, 2_000_000] as const;

function fits(item: Prepared, w: number, h: number, options: ResolvedOptions): boolean {
  const iw = item.width + 2 * options.extrude,
    ih = item.height + 2 * options.extrude;
  w -= 2 * options.border;
  h -= 2 * options.border;
  return (iw <= w && ih <= h) || (options.rotate && ih <= w && iw <= h);
}

function dimensions(
  placed: readonly Placed[],
  capW: number,
  capH: number,
  options: ResolvedOptions,
): [number, number] {
  let width = options.fixedSize
    ? capW
    : Math.max(...placed.map(({ placement: p }) => p.x + p.w - options.padding)) +
      2 * options.border;
  let height = options.fixedSize
    ? capH
    : Math.max(...placed.map(({ placement: p }) => p.y + p.h - options.padding)) +
      2 * options.border;
  if (options.powerOfTwo) {
    width = ceilPowerOfTwo(width);
    height = ceilPowerOfTwo(height);
  }
  if (options.square) width = height = Math.max(width, height);
  return [width, height];
}

function attempt(
  items: readonly Prepared[],
  options: ResolvedOptions,
  capW: number,
  capH: number,
  heuristic: Heuristic,
  maxPages = Infinity,
  budget?: SearchBudget,
): Plan | undefined {
  if (items.some((item) => !fits(item, capW, capH, options))) return undefined;
  const remaining = [...items],
    pages: LayoutPage[] = [];
  let area = 0;
  while (remaining.length) {
    if (pages.length === maxPages || budget?.remaining === 0) return undefined;
    const bin = new MaxRects(
      capW - 2 * options.border + options.padding,
      capH - 2 * options.border + options.padding,
      heuristic,
    );
    const placed: Placed[] = [];
    while (remaining.length) {
      let best: { item: Prepared; placement: Placement; index: number } | undefined;
      for (const [index, item] of remaining.entries()) {
        const placement = bin.score(
          item.width + 2 * options.extrude + options.padding,
          item.height + 2 * options.extrude + options.padding,
          options.rotate,
          budget,
        );
        if (!placement && budget?.remaining === 0) return undefined;
        if (placement && (!best || comparePlacement(placement, best.placement) < 0))
          best = { item, placement, index };
      }
      if (!best) break;
      bin.place(best.placement);
      placed.push(best);
      remaining.splice(best.index, 1);
    }
    if (!placed.length) return undefined;
    const [width, height] = dimensions(placed, capW, capH, options);
    pages.push({ width, height, placed });
    area += width * height;
  }
  return {
    pages,
    area,
    capW,
    capH,
    valid:
      area <= MAX_TOTAL_PIXELS &&
      pages.every((page) => page.width * page.height <= MAX_IMAGE_PIXELS),
  };
}

function axis(min: number, max: number, powerOfTwo: boolean): number[] {
  if (powerOfTwo) {
    const sizes: number[] = [];
    for (let value = ceilPowerOfTwo(min); value <= max; value *= 2) sizes.push(value);
    return sizes;
  }
  const values = new Set([min, max]);
  const step = Math.max(1, Math.ceil(max / GRID_STEPS));
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) values.add(value);
  return [...values].sort((a, b) => a - b);
}

export function planLayout(items: readonly Prepared[], options: ResolvedOptions): LayoutPage[] {
  let capW = options.powerOfTwo ? floorPowerOfTwo(options.maxWidth) : options.maxWidth;
  let capH = options.powerOfTwo ? floorPowerOfTwo(options.maxHeight) : options.maxHeight;
  if (options.square) capW = capH = Math.min(capW, capH);
  const oversized = items.find((item) => !fits(item, capW, capH, options));
  if (oversized)
    throw new AtlasError(
      'IMAGE_TOO_LARGE',
      `Sprite cannot fit atlas: ${oversized.aliases[0]!.id}`,
      {
        id: oversized.aliases[0]!.id,
        width: oversized.width,
        height: oversized.height,
        maxWidth: capW,
        maxHeight: capH,
      },
    );
  const baseline = attempt(items, options, capW, capH, 'short-side-fit')!;
  if (options.packMode === 'fast' || items.length === 1) return baseline.pages;
  let best = baseline;
  const improve = (candidate: Plan | undefined): void => {
    if (!candidate || !candidate.valid) return;
    // Never regress page count or total area against the valid fast baseline.
    if (
      baseline.valid &&
      (candidate.pages.length > baseline.pages.length || candidate.area > baseline.area)
    )
      return;
    if (
      !best.valid ||
      candidate.pages.length < best.pages.length ||
      (candidate.pages.length === best.pages.length && candidate.area < best.area)
    )
      best = candidate;
  };
  const budgets = STRATEGY_WORK.map((remaining) => ({ remaining }));
  for (const [index, heuristic] of HEURISTICS.entries()) {
    if (index)
      improve(attempt(items, options, capW, capH, heuristic, best.pages.length, budgets[index]));
  }
  if (options.fixedSize) return best.pages;
  const minW =
    Math.max(
      ...items.map(
        (item) =>
          (options.rotate ? Math.min(item.width, item.height) : item.width) + 2 * options.extrude,
      ),
    ) +
    2 * options.border;
  const minH =
    Math.max(
      ...items.map(
        (item) =>
          (options.rotate ? Math.min(item.width, item.height) : item.height) + 2 * options.extrude,
      ),
    ) +
    2 * options.border;
  const requiredArea = items.reduce(
    (sum, item) => sum + (item.width + 2 * options.extrude) * (item.height + 2 * options.extrude),
    0,
  );
  const viable = (w: number, h: number): boolean =>
    (w - 2 * options.border) * (h - 2 * options.border) * best.pages.length >= requiredArea &&
    (best.pages.length > 1 || w * h <= best.area * 1.2);
  const widths = axis(options.square ? Math.max(minW, minH) : minW, capW, options.powerOfTwo);
  const heights = axis(minH, capH, options.powerOfTwo);
  const candidates = widths.flatMap((w) =>
    (options.square ? [w] : heights).filter((h) => viable(w, h)).map((h) => [w, h] as const),
  );
  candidates.sort((a, b) => a[0] * a[1] - b[0] * b[1] || b[0] - a[0]);
  for (const [index, heuristic] of HEURISTICS.entries()) {
    const budget = budgets[index]!;
    const visited = new Set<string>([`${capW},${capH}`]);
    const consider = (w: number, h: number): void => {
      const key = `${w},${h}`;
      if (visited.has(key) || !viable(w, h)) return;
      visited.add(key);
      improve(attempt(items, options, w, h, heuristic, best.pages.length, budget));
    };
    const reserve = budget.remaining / 4;
    for (const [w, h] of candidates) {
      if (budget.remaining <= reserve) break;
      consider(w, h);
    }
    if (options.powerOfTwo) continue;
    // Refine around the best cap with successively smaller deterministic steps.
    let radiusW = Math.max(1, Math.ceil(capW / GRID_STEPS)),
      radiusH = Math.max(1, Math.ceil(capH / GRID_STEPS));
    for (let pass = 0; pass < 3 && budget.remaining > 0; pass++) {
      const centerW = best.capW,
        centerH = best.capH;
      const stepW = Math.max(1, Math.ceil(radiusW / 4)),
        stepH = Math.max(1, Math.ceil(radiusH / 4));
      for (
        let w = Math.max(minW, centerW - radiusW);
        w <= Math.min(capW, centerW + radiusW) && budget.remaining > 0;
        w += stepW
      ) {
        if (options.square) consider(w, w);
        else
          for (
            let h = Math.max(minH, centerH - radiusH);
            h <= Math.min(capH, centerH + radiusH) && budget.remaining > 0;
            h += stepH
          )
            consider(w, h);
      }
      radiusW = stepW;
      radiusH = stepH;
    }
  }
  return best.pages;
}
