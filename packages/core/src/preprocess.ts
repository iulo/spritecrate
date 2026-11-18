import {
  AtlasError,
  compareIds,
  MAX_IMAGE_PIXELS,
  MAX_TOTAL_PIXELS,
  MAX_SPRITES,
} from './model.js';
import type { Frame, ResolvedOptions, Sprite } from './model.js';

export interface Prepared {
  width: number;
  height: number;
  pixels: Uint8Array;
  aliases: Omit<Frame, 'frame' | 'rotated'>[];
}

export function prepare(sprites: readonly Sprite[], options: ResolvedOptions): Prepared[] {
  if (!Array.isArray(sprites) || sprites.length === 0)
    throw new AtlasError('NO_INPUT', 'No sprites supplied');
  if (sprites.length > MAX_SPRITES)
    throw new AtlasError('LIMIT_EXCEEDED', 'Sprite count limit exceeded');
  const ids = new Set<string>();
  let total = 0;
  for (const sprite of sprites) {
    if (
      !sprite ||
      typeof sprite.id !== 'string' ||
      !sprite.id ||
      sprite.id.includes('\\') ||
      sprite.id.startsWith('/') ||
      sprite.id.includes('\0') ||
      /^[a-z]:/i.test(sprite.id) ||
      sprite.id.split('/').some((part: string) => part === '..' || part === '.' || !part)
    ) {
      throw new AtlasError('INVALID_INPUT', 'Sprite id must be a nonempty relative slash path');
    }
    if (ids.has(sprite.id))
      throw new AtlasError('DUPLICATE_ID', `Duplicate sprite id: ${sprite.id}`, { id: sprite.id });
    ids.add(sprite.id);
    if (
      !Number.isSafeInteger(sprite.width) ||
      !Number.isSafeInteger(sprite.height) ||
      sprite.width < 1 ||
      sprite.height < 1 ||
      sprite.width * sprite.height > MAX_IMAGE_PIXELS
    ) {
      throw new AtlasError('LIMIT_EXCEEDED', `Invalid or excessive dimensions: ${sprite.id}`, {
        id: sprite.id,
        width: sprite.width,
        height: sprite.height,
      });
    }
    if (
      !(sprite.pixels instanceof Uint8Array) ||
      sprite.pixels.length !== sprite.width * sprite.height * 4
    ) {
      throw new AtlasError(
        'INVALID_INPUT',
        `Expected width × height × 4 RGBA bytes: ${sprite.id}`,
        { id: sprite.id },
      );
    }
    total += sprite.width * sprite.height;
    if (total > MAX_TOTAL_PIXELS)
      throw new AtlasError('LIMIT_EXCEEDED', 'Total input pixel limit exceeded');
  }
  const unique: Prepared[] = [];
  const buckets = new Map<number, Prepared[]>();
  for (const sprite of [...sprites].sort((a, b) => compareIds(a.id, b.id))) {
    const item = crop(sprite, options);
    const hash = hashPixels(item);
    const bucket = buckets.get(hash) ?? [];
    const same = options.deduplicate ? bucket.find((other) => equalPixels(other, item)) : undefined;
    if (same) same.aliases.push(...item.aliases);
    else {
      unique.push(item);
      bucket.push(item);
      buckets.set(hash, bucket);
    }
  }
  return unique;
}

function crop(sprite: Sprite, options: ResolvedOptions): Prepared {
  let left = sprite.width,
    top = sprite.height,
    right = -1,
    bottom = -1;
  if (options.trim) {
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        if (sprite.pixels[(y * sprite.width + x) * 4 + 3]! > options.alphaThreshold) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }
  } else {
    left = 0;
    top = 0;
    right = sprite.width - 1;
    bottom = sprite.height - 1;
  }
  const empty = right < left;
  if (empty) {
    left = 0;
    top = 0;
    right = 0;
    bottom = 0;
  }
  const width = right - left + 1,
    height = bottom - top + 1;
  const pixels = new Uint8Array(width * height * 4);
  if (!empty) {
    for (let y = 0; y < height; y++) {
      const start = ((top + y) * sprite.width + left) * 4;
      pixels.set(sprite.pixels.subarray(start, start + width * 4), y * width * 4);
    }
  }
  return {
    width,
    height,
    pixels,
    aliases: [
      {
        id: sprite.id,
        trimmed: left !== 0 || top !== 0 || width !== sprite.width || height !== sprite.height,
        sourceSize: { w: sprite.width, h: sprite.height },
        spriteSourceSize: { x: left, y: top, w: width, h: height },
      },
    ],
  };
}

function hashPixels(item: Prepared): number {
  let hash = Math.imul(item.width ^ 2166136261, 16777619) ^ item.height;
  for (const byte of item.pixels) hash = Math.imul(hash ^ byte, 16777619);
  return hash >>> 0;
}

function equalPixels(a: Prepared, b: Prepared): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.pixels.every((value, i) => value === b.pixels[i])
  );
}
