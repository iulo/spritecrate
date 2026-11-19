import { describe, expect, it } from 'vitest';
import { pack, exportAtlas, resolveOptions } from '@spritecrate/core';
import type { AtlasOptions, Sprite } from '@spritecrate/core';
import { restore, sprite } from './helpers.js';

describe('pixel pipeline', () => {
  it('crops transparent borders and restores original coordinates', () => {
    const input = sprite('hero', 7, 6);
    input.pixels.fill(0);
    for (let y = 2; y < 4; y++)
      for (let x = 1; x < 5; x++) input.pixels.set([x, y, 20, 128], (y * 7 + x) * 4);
    const result = pack({ sprites: [input] });
    expect(result.pages[0]!.frames[0]!.spriteSourceSize).toEqual({ x: 1, y: 2, w: 4, h: 2 });
    expect(restore(result.pages[0]!, result.pages[0]!.frames[0]!)).toEqual(input.pixels);
  });

  it('rotates clockwise when this is the only fit', () => {
    const input = sprite('wide', 6, 3);
    const result = pack({
      sprites: [input],
      options: { maxWidth: 3, maxHeight: 6, rotate: true, extrude: 0, padding: 0 },
    });
    const page = result.pages[0]!,
      frame = page.frames[0]!;
    expect(frame.rotated).toBe(true);
    expect(frame.frame).toEqual({ x: 0, y: 0, w: 3, h: 6 });
    expect([...page.pixels.subarray(0, 4)]).toEqual([1, 0, 2, 255]);
    expect(restore(page, frame)).toEqual(input.pixels);
  });

  it('extrudes edge and corner pixels without inflating frame metadata', () => {
    const input = sprite('tiny', 2, 2);
    const page = pack({ sprites: [input], options: { extrude: 2, border: 1 } }).pages[0]!;
    const frame = page.frames[0]!;
    expect(frame.frame).toEqual({ x: 3, y: 3, w: 2, h: 2 });
    expect(page.width).toBe(8);
    expect([...page.pixels.subarray((1 * 8 + 1) * 4, (1 * 8 + 1) * 4 + 4)]).toEqual([1, 0, 0, 255]);
    expect([...page.pixels.subarray((6 * 8 + 6) * 4, (6 * 8 + 6) * 4 + 4)]).toEqual([1, 1, 1, 255]);
    expect(page.pixels.subarray(0, 8 * 4).every((byte) => byte === 0)).toBe(true);
  });

  it('deduplicates cropped pixels while preserving each source geometry', () => {
    const large = sprite('large', 4, 4);
    large.pixels.fill(0);
    large.pixels.set([7, 0, 0, 255], 20);
    const small = sprite('small', 1, 1, 7);
    const result = pack({ sprites: [large, small] });
    expect(result.report.uniqueCount).toBe(1);
    const page = result.pages[0]!;
    expect(page.frames[0]!.frame).toEqual(page.frames[1]!.frame);
    expect(page.frames.map((frame) => restore(page, frame))).toEqual([large.pixels, small.pixels]);
  });

  it('supports disabling deduplication', () => {
    expect(
      pack({ sprites: [sprite('a', 1, 1), sprite('b', 1, 1)], options: { deduplicate: false } })
        .report.uniqueCount,
    ).toBe(2);
  });

  it('retains a transparent placeholder and original dimensions', () => {
    const input = sprite('empty', 4, 5);
    input.pixels.fill(0);
    const page = pack({ sprites: [input] }).pages[0]!;
    expect(page.frames[0]!.spriteSourceSize).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(restore(page, page.frames[0]!)).toEqual(input.pixels);
  });

  it('compares alpha strictly greater than threshold', () => {
    const input = sprite('alpha', 2, 1);
    input.pixels[3] = 10;
    input.pixels[7] = 11;
    const frame = pack({ sprites: [input], options: { alphaThreshold: 10 } }).pages[0]!.frames[0]!;
    expect(frame.spriteSourceSize).toEqual({ x: 1, y: 0, w: 1, h: 1 });
    expect(pack({ sprites: [input], options: { trim: false } }).pages[0]!.frames[0]!.trimmed).toBe(
      false,
    );
  });
});

describe('packing invariants', () => {
  it('preserves all pixels, padding and limits for seeded rectangle sets', () => {
    let seed = 123;
    const random = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let trial = 0; trial < 20; trial++) {
      const sprites: Sprite[] = Array.from({ length: 30 }, (_, i) =>
        sprite(`sprite-${i}`, 1 + (random() % 13), 1 + (random() % 11), i + 1),
      );
      const result = pack({
        sprites,
        options: { maxWidth: 32, maxHeight: 32, rotate: true, padding: 2, extrude: 1, border: 1 },
      });
      expect(result.pages.flatMap((page) => page.frames).length).toBe(sprites.length);
      for (const page of result.pages) {
        expect(page.width).toBeLessThanOrEqual(32);
        expect(page.height).toBeLessThanOrEqual(32);
        for (const [i, frame] of page.frames.entries()) {
          const rect = frame.frame;
          expect(rect.x - 1).toBeGreaterThanOrEqual(1);
          expect(rect.y - 1).toBeGreaterThanOrEqual(1);
          expect(rect.x + rect.w + 2).toBeLessThanOrEqual(page.width);
          expect(rect.y + rect.h + 2).toBeLessThanOrEqual(page.height);
          expect(restore(page, frame)).toEqual(
            sprites.find((input) => input.id === frame.id)!.pixels,
          );
          for (const other of page.frames.slice(i + 1)) {
            const b = other.frame;
            expect(
              rect.x + rect.w + 4 <= b.x ||
                b.x + b.w + 4 <= rect.x ||
                rect.y + rect.h + 4 <= b.y ||
                b.y + b.h + 4 <= rect.y,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('produces identical output regardless of input ordering', () => {
    const inputs = [sprite('z', 2, 5), sprite('a', 5, 2), sprite('中', 3, 3)];
    expect(pack({ sprites: inputs })).toEqual(pack({ sprites: [...inputs].reverse() }));
  });

  it('paginates with stable names and respects POT and square constraints', () => {
    const result = pack({
      sprites: [sprite('a', 7, 6), sprite('b', 7, 6, 2)],
      options: {
        name: 'test',
        maxWidth: 15,
        maxHeight: 15,
        extrude: 0,
        padding: 0,
        powerOfTwo: true,
        square: true,
      },
    });
    expect(result.pages.map((page) => [page.image, page.width, page.height])).toEqual([
      ['test-0.png', 8, 8],
      ['test-1.png', 8, 8],
    ]);
  });

  it('uses exact fixed dimensions and no trailing padding', () => {
    const sprites = [sprite('exact', 4, 5)];
    const page = pack({
      sprites,
      options: { maxWidth: 4, maxHeight: 5, fixedSize: true, padding: 50, extrude: 0 },
    }).pages[0]!;
    expect([page.width, page.height]).toEqual([4, 5]);
  });

  it('rejects a sprite that cannot fit instead of silently dropping it', () => {
    expect(() =>
      pack({ sprites: [sprite('large', 6, 2)], options: { maxWidth: 3, maxHeight: 3 } }),
    ).toThrowError(expect.objectContaining({ code: 'IMAGE_TOO_LARGE' }));
  });
});

describe('validation and export', () => {
  it('exports rotated logical dimensions for generic JSON and refuses Phaser rotation', () => {
    const { pages } = pack({
      sprites: [sprite('wide', 6, 3)],
      options: { maxWidth: 3, maxHeight: 6, rotate: true, extrude: 0, padding: 0 },
    });
    const json = JSON.parse(new TextDecoder().decode(exportAtlas(pages, 'json-hash')[0]!.data));
    expect(json.frames.wide.frame).toEqual({ x: 0, y: 0, w: 6, h: 3 });
    for (const format of ['phaser4', 'phaser3'] as const) {
      expect(() => exportAtlas(pages, format)).toThrowError(
        expect.objectContaining({ code: 'INVALID_OPTIONS' }),
      );
    }
  });
  it.each([
    { maxWidth: 0 },
    { maxHeight: 1.5 },
    { padding: -1 },
    { extrude: Number.NaN },
    { alphaThreshold: 256 },
    { name: '../escape' },
    { rotate: 'yes' },
    { fixedSize: true, square: true, maxWidth: 3, maxHeight: 4 },
    { fixedSize: true, powerOfTwo: true, maxWidth: 3 },
    { unknown: true },
  ])('rejects invalid options %j', (options) => {
    expect(() => resolveOptions(options as AtlasOptions)).toThrowError(
      expect.objectContaining({ code: 'INVALID_OPTIONS' }),
    );
  });

  it.each(['', '/root', '../escape', 'a/../b', 'a\\b', 'C:/foo', 'a//b'])(
    'rejects invalid id %s',
    (id) => {
      expect(() => pack({ sprites: [sprite(id, 1, 1)] })).toThrowError(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    },
  );

  it('rejects empty, duplicate and corrupt inputs', () => {
    expect(() => pack({ sprites: [] })).toThrowError(expect.objectContaining({ code: 'NO_INPUT' }));
    expect(() => pack({ sprites: [sprite('a', 1, 1), sprite('a', 1, 1)] })).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_ID' }),
    );
    expect(() =>
      pack({ sprites: [{ ...sprite('bad', 1, 1), pixels: new Uint8Array(3) }] }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it.each(['json-hash', 'json-array', 'phaser4', 'phaser3'] as const)(
    'exports valid %s JSON with Unicode and special ids',
    (format) => {
      const pages = pack({
        sprites: [sprite('中文/"name', 2, 2), sprite('__proto__', 3, 1)],
      }).pages;
      const files = exportAtlas(pages, format);
      expect(files).toHaveLength(1);
      const text = new TextDecoder().decode(files[0]!.data);
      const data = JSON.parse(text);
      expect(text).toContain('SpriteCrate');
      expect(
        format.startsWith('phaser')
          ? data.textures[0].frames.length
          : Object.keys(data.frames).length,
      ).toBe(2);
      if (format === 'json-hash') expect(Object.hasOwn(data.frames, '__proto__')).toBe(true);
    },
  );
});
