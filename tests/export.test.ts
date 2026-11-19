import { describe, expect, it } from 'vitest';
import { parse } from 'plist';
import { pack, exportAtlas } from '@spritecrate/core';
import type { AtlasPage, Frame } from '@spritecrate/core';
import { restore, sprite } from './helpers.js';

interface CocosFrame {
  aliases: string[];
  spriteOffset: string;
  spriteSize: string;
  spriteSourceSize: string;
  textureRect: string;
  textureRotated: boolean;
}
interface CocosPlist {
  frames: Record<string, CocosFrame>;
  metadata: { format: number; size: string; textureFileName: string; premultiplyAlpha: boolean };
}
const decode = (data: Uint8Array): string => new TextDecoder().decode(data);
const numbers = (value: string): number[] =>
  [...value.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));

// Reconstruct a frame using the format-3 loader's logical size and center-offset
// conventions, independently of SpriteCrate's metadata representation.
function cocosFrame(id: string, data: CocosFrame): Frame {
  const [x, y, w, h] = numbers(data.textureRect) as [number, number, number, number];
  const [sw, sh] = numbers(data.spriteSourceSize) as [number, number];
  const [cw, ch] = numbers(data.spriteSize) as [number, number];
  const [ox, oy] = numbers(data.spriteOffset) as [number, number];
  expect([w, h]).toEqual([cw, ch]);
  return {
    id,
    frame: { x, y, w: data.textureRotated ? ch : cw, h: data.textureRotated ? cw : ch },
    sourceSize: { w: sw, h: sh },
    spriteSourceSize: { x: ox + (sw - cw) / 2, y: (sh - ch) / 2 - oy, w: cw, h: ch },
    rotated: data.textureRotated,
    trimmed: cw !== sw || ch !== sh,
  };
}

function parsePage(page: AtlasPage): CocosPlist {
  return parse(decode(exportAtlas([page], 'cocos2d')[0]!.data)) as unknown as CocosPlist;
}

describe('Cocos plist format 3', () => {
  it.each([false, true])('restores asymmetric trim, center offsets and rotation=%s', (rotate) => {
    const input = sprite('中文/<hero>&"🦊.png', 9, 8);
    input.pixels.fill(0);
    for (let y = 2; y < 5; y++)
      for (let x = 1; x < 7; x++) {
        input.pixels.set([x * 10, y * 20, 80, 255], (y * 9 + x) * 4);
      }
    const { pages } = pack({
      sprites: [input],
      options: {
        maxWidth: rotate ? 3 : 6,
        maxHeight: rotate ? 6 : 3,
        rotate,
        padding: 0,
        extrude: 0,
      },
    });
    const page = pages[0]!;
    const data = parsePage(page);
    expect(data.metadata).toMatchObject({
      format: 3,
      textureFileName: page.image,
      premultiplyAlpha: false,
    });
    const frame = data.frames[input.id]!;
    expect(frame.textureRotated).toBe(rotate);
    expect(frame.spriteOffset).toBe('{-0.5,0.5}');
    expect(restore(page, cocosFrame(input.id, frame))).toEqual(input.pixels);
  });

  it('preserves deduplicated source geometries and transparent placeholders', () => {
    const a = sprite('small', 1, 1);
    const b = sprite('large', 4, 5);
    b.pixels.fill(0);
    b.pixels.set(a.pixels, (3 * 4 + 1) * 4);
    const empty = sprite('empty', 3, 7);
    empty.pixels.fill(0);
    const { pages, report } = pack({ sprites: [a, b, empty] });
    expect(report.uniqueCount).toBe(2);
    const page = pages[0]!,
      data = parsePage(page);
    for (const input of [a, b, empty]) {
      expect(restore(page, cocosFrame(input.id, data.frames[input.id]!))).toEqual(input.pixels);
    }
  });

  it('emits a matching plist per PNG page', () => {
    const { pages } = pack({
      sprites: [sprite('a', 4, 3), sprite('b', 4, 3, 2)],
      options: { maxWidth: 4, maxHeight: 3, extrude: 0 },
    });
    const files = exportAtlas(pages, 'cocos2d');
    expect(files.map((file) => file.name)).toEqual(['atlas-0.plist', 'atlas-1.plist']);
    files.forEach((file, index) => {
      const data = parse(decode(file.data)) as unknown as CocosPlist;
      expect(data.metadata.textureFileName).toBe(pages[index]!.image);
      expect(data.metadata.size).toBe('{4,3}');
    });
  });

  it('rejects names that cannot be represented in XML 1.0', () => {
    const { pages } = pack({ sprites: [sprite('bad\u0001', 1, 1)] });
    expect(() => exportAtlas(pages, 'cocos2d')).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });
});

describe('PixiJS multipack', () => {
  it('links every other page by relative JSON filename, without self-links', () => {
    const { pages } = pack({
      sprites: [sprite('a', 2, 3), sprite('b', 2, 3, 2), sprite('c', 2, 3, 3)],
      options: { maxWidth: 2, maxHeight: 3, extrude: 0 },
    });
    const files = exportAtlas(pages, 'pixijs');
    expect(files).toHaveLength(3);
    files.forEach((file, index) => {
      const data = JSON.parse(decode(file.data));
      expect(data.meta.image).toBe(pages[index]!.image);
      expect(data.meta.related_multi_packs).toEqual(
        files.filter((other) => other !== file).map((other) => other.name),
      );
      expect(Object.keys(data.frames)).toHaveLength(1);
    });
  });
  it('omits multipack links for a single page', () => {
    const { pages } = pack({ sprites: [sprite('hero.png', 2, 3)] });
    const data = JSON.parse(decode(exportAtlas(pages, 'pixijs')[0]!.data));
    expect(data.meta.related_multi_packs).toBeUndefined();
    expect(data.frames['hero.png'].sourceSize).toEqual({ w: 2, h: 3 });
  });
});
