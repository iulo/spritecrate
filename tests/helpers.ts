import sharp from 'sharp';
import type { Sprite, AtlasPage, Frame } from '@spritetuck/core';

export function sprite(id: string, width: number, height: number, color = 1): Sprite {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) pixels.set([color, x % 256, y % 256, 255], (y * width + x) * 4);
  }
  return { id, width, height, pixels };
}

export function restore(page: AtlasPage, frame: Frame): Uint8Array {
  const { sourceSize, spriteSourceSize: crop, frame: rect } = frame;
  const restored = new Uint8Array(sourceSize.w * sourceSize.h * 4);
  for (let y = 0; y < crop.h; y++) {
    for (let x = 0; x < crop.w; x++) {
      const px = rect.x + (frame.rotated ? crop.h - 1 - y : x);
      const py = rect.y + (frame.rotated ? x : y);
      const source = (py * page.width + px) * 4;
      restored.set(
        page.pixels.subarray(source, source + 4),
        ((y + crop.y) * sourceSize.w + x + crop.x) * 4,
      );
    }
  }
  return restored;
}

export async function png(item: Sprite): Promise<Uint8Array> {
  return sharp(item.pixels, { raw: { width: item.width, height: item.height, channels: 4 } })
    .png()
    .toBuffer();
}
