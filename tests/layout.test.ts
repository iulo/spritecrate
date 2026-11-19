import { describe, expect, it } from 'vitest';
import { pack, resolveOptions } from '@spritetuck/core';
import type { AtlasOptions, Sprite } from '@spritetuck/core';
import { MaxRects, HEURISTICS } from '../packages/core/src/maxrects.js';
import rectangles from './fixtures/animation-rectangles.json';
import { restore, sprite } from './helpers.js';

const area = (result: ReturnType<typeof pack>): number =>
  result.pages.reduce((sum, page) => sum + page.width * page.height, 0);

function check(sprites: Sprite[], options: AtlasOptions): ReturnType<typeof pack> {
  const result = pack({ sprites, options });
  expect(
    result.pages
      .flatMap((page) => page.frames)
      .map((frame) => frame.id)
      .sort(),
  ).toEqual(sprites.map((input) => input.id).sort());
  for (const page of result.pages) {
    expect(page.width).toBeLessThanOrEqual(options.maxWidth ?? 2048);
    expect(page.height).toBeLessThanOrEqual(options.maxHeight ?? 2048);
    if (options.fixedSize)
      expect([page.width, page.height]).toEqual([options.maxWidth, options.maxHeight]);
    if (options.square) expect(page.width).toBe(page.height);
    if (options.powerOfTwo) {
      expect(page.width & (page.width - 1)).toBe(0);
      expect(page.height & (page.height - 1)).toBe(0);
    }
    for (const [index, frame] of page.frames.entries()) {
      const source = sprites.find((input) => input.id === frame.id)!;
      expect(restore(page, frame)).toEqual(source.pixels);
      const r = frame.frame,
        extrusion = options.extrude ?? 1,
        border = options.border ?? 0;
      expect(r.x - extrusion).toBeGreaterThanOrEqual(border);
      expect(r.y - extrusion).toBeGreaterThanOrEqual(border);
      expect(r.x + r.w + extrusion + border).toBeLessThanOrEqual(page.width);
      expect(r.y + r.h + extrusion + border).toBeLessThanOrEqual(page.height);
      for (const other of page.frames.slice(index + 1)) {
        const b = other.frame,
          gap = 2 * extrusion + (options.padding ?? 2);
        expect(
          r.x + r.w + gap <= b.x ||
            b.x + b.w + gap <= r.x ||
            r.y + r.h + gap <= b.y ||
            b.y + b.h + gap <= r.y,
        ).toBe(true);
      }
    }
  }
  return result;
}

describe('optimized atlas layout', () => {
  it('shrinks representative animation rectangle sets while fast reproduces legacy sizes', () => {
    let previous = 0,
      optimized = 0;
    for (const fixture of rectangles) {
      // Only geometry is retained from real sprites. All test pixels are synthetic.
      const inputs = fixture.rectangles.map(([w, h, group], index) =>
        sprite(String(index).padStart(2, '0'), w!, h!, group! + 1),
      );
      const options = { maxWidth: 1536, maxHeight: 1536, rotate: false, padding: 2, extrude: 1 };
      const fast = pack({ sprites: inputs, options: { ...options, packMode: 'fast' } });
      const best = pack({ sprites: inputs, options });
      expect([fast.pages[0]!.width, fast.pages[0]!.height]).toEqual(fixture.legacySize);
      expect(best.report.pageCount).toBe(1);
      expect(area(best)).toBeLessThanOrEqual(area(fast));
      if (fixture.name === 'animation-3') expect(area(best)).toBeLessThan(area(fast) * 0.82);
      previous += area(fast);
      optimized += area(best);
    }
    expect(optimized).toBeLessThan(previous * 0.9);
  });

  it.each([
    { maxWidth: 32, maxHeight: 40, rotate: true },
    { maxWidth: 32, maxHeight: 32, rotate: true, fixedSize: true },
    { maxWidth: 63, maxHeight: 47, powerOfTwo: true, rotate: true },
    { maxWidth: 40, maxHeight: 48, square: true },
    { maxWidth: 48, maxHeight: 48, powerOfTwo: true, square: true, rotate: true },
  ] satisfies AtlasOptions[])('keeps geometry and pixels valid with constraints %j', (options) => {
    const inputs = Array.from({ length: 24 }, (_, i) =>
      sprite('frame-' + i, 3 + ((i * 7) % 13), 2 + ((i * 11) % 17), i + 1),
    );
    const common = { ...options, border: 1, extrude: 1, padding: 2 };
    const fast = check(inputs, { ...common, packMode: 'fast' });
    const best = check(inputs, common);
    expect(best.pages.length).toBeLessThanOrEqual(fast.pages.length);
    expect(area(best)).toBeLessThanOrEqual(area(fast));
    expect(pack({ sprites: [...inputs].reverse(), options: common })).toEqual(best);
  });

  it('keeps fixed-size multi-page output exact even with enormous padding', () => {
    const inputs = [sprite('a', 4, 5), sprite('b', 4, 5, 2)];
    const result = check(inputs, {
      maxWidth: 4,
      maxHeight: 5,
      fixedSize: true,
      padding: 50,
      extrude: 0,
    });
    expect(result.pages).toHaveLength(2);
  });

  it('finds a valid layout before rejecting an oversized greedy canvas', () => {
    const inputs = [sprite('a', 5000, 2), sprite('b', 2, 5000, 2)];
    const options = { maxWidth: 8192, maxHeight: 8192, rotate: true, padding: 0, extrude: 0 };
    expect(() => pack({ sprites: inputs, options: { ...options, packMode: 'fast' } })).toThrowError(
      expect.objectContaining({ code: 'LIMIT_EXCEEDED' }),
    );
    const result = pack({ sprites: inputs, options });
    expect(area(result)).toBe(20000);
    for (const page of result.pages)
      for (const frame of page.frames) {
        expect(restore(page, frame)).toEqual(inputs.find((input) => input.id === frame.id)!.pixels);
      }
  });

  it.each(['invalid', '', 1, null])('rejects invalid packMode %j', (packMode) => {
    expect(() => resolveOptions({ packMode } as AtlasOptions)).toThrowError(
      expect.objectContaining({ code: 'INVALID_OPTIONS' }),
    );
  });
});

describe('MaxRects strategies', () => {
  it.each(HEURISTICS)('%s preserves rectangles, rotation and separation', (heuristic) => {
    const bin = new MaxRects(31, 29, heuristic);
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const [w, h] of [
      [8, 13],
      [7, 11],
      [14, 5],
      [10, 6],
      [6, 7],
      [5, 5],
    ] as const) {
      const rect = bin.score(w, h, true);
      expect(rect).toBeDefined();
      if (!rect) continue;
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(31);
      expect(rect.y + rect.h).toBeLessThanOrEqual(29);
      expect([rect.w, rect.h]).toEqual(rect.rotated ? [h, w] : [w, h]);
      for (const other of placed)
        expect(
          rect.x + rect.w <= other.x ||
            other.x + other.w <= rect.x ||
            rect.y + rect.h <= other.y ||
            other.y + other.h <= rect.y,
        ).toBe(true);
      bin.place(rect);
      placed.push(rect);
    }
  });

  it('stops an optimization attempt when its deterministic scoring budget is exhausted', () => {
    const bin = new MaxRects(10, 10, 'contact-point');
    const budget = { remaining: 0 };
    expect(bin.score(1, 1, false, budget)).toBeUndefined();
    expect(bin.score(1, 1, false)).toBeDefined();
  });
});
