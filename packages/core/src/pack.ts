import { AtlasError, compareIds, MAX_IMAGE_PIXELS, MAX_TOTAL_PIXELS } from './model.js';
import type { AtlasOptions, AtlasPage, PackResult, Sprite } from './model.js';
import { ceilPowerOfTwo, floorPowerOfTwo, resolveOptions } from './options.js';
import { MaxRects, comparePlacement } from './maxrects.js';
import type { Placement } from './maxrects.js';
import { prepare } from './preprocess.js';
import type { Prepared } from './preprocess.js';

interface Placed {
  item: Prepared;
  placement: Placement;
}

export function pack(request: { sprites: readonly Sprite[]; options?: AtlasOptions }): PackResult {
  const options = resolveOptions(request.options);
  const items = prepare(request.sprites, options);
  const remaining = [...items];
  const pages: AtlasPage[] = [];
  let capW = options.maxWidth,
    capH = options.maxHeight;
  if (options.powerOfTwo) {
    capW = floorPowerOfTwo(capW);
    capH = floorPowerOfTwo(capH);
  }
  if (options.square) capW = capH = Math.min(capW, capH);
  const { border, padding, extrude } = options;
  let outputPixels = 0;
  let contentArea = 0;
  while (remaining.length) {
    const bin = new MaxRects(capW - border * 2 + padding, capH - border * 2 + padding);
    const placed: Placed[] = [];
    while (remaining.length) {
      let best: { item: Prepared; placement: Placement; index: number } | undefined;
      for (const [index, item] of remaining.entries()) {
        const placement = bin.score(
          item.width + 2 * extrude + padding,
          item.height + 2 * extrude + padding,
          options.rotate,
        );
        if (placement && (!best || comparePlacement(placement, best.placement) < 0))
          best = { item, placement, index };
      }
      if (!best) break;
      bin.place(best.placement);
      placed.push(best);
      remaining.splice(best.index, 1);
    }
    if (!placed.length) {
      const item = remaining[0]!;
      throw new AtlasError('IMAGE_TOO_LARGE', `Sprite cannot fit atlas: ${item.aliases[0]!.id}`, {
        id: item.aliases[0]!.id,
        width: item.width,
        height: item.height,
        maxWidth: capW,
        maxHeight: capH,
      });
    }
    let width = options.fixedSize
      ? capW
      : Math.max(...placed.map(({ placement: p }) => p.x + p.w - padding)) + border * 2;
    let height = options.fixedSize
      ? capH
      : Math.max(...placed.map(({ placement: p }) => p.y + p.h - padding)) + border * 2;
    if (options.powerOfTwo) {
      width = ceilPowerOfTwo(width);
      height = ceilPowerOfTwo(height);
    }
    if (options.square) width = height = Math.max(width, height);
    outputPixels += width * height;
    if (width * height > MAX_IMAGE_PIXELS || outputPixels > MAX_TOTAL_PIXELS)
      throw new AtlasError('LIMIT_EXCEEDED', 'Output pixel limit exceeded', { width, height });
    const page: AtlasPage = {
      image: '',
      width,
      height,
      pixels: new Uint8Array(width * height * 4),
      frames: [],
    };
    for (const { item, placement: p } of placed) {
      const physicalW = p.rotated ? item.height : item.width;
      const physicalH = p.rotated ? item.width : item.height;
      const x = p.x + border + extrude,
        y = p.y + border + extrude;
      render(page, item, x, y, physicalW, physicalH, p.rotated, extrude);
      for (const alias of item.aliases)
        page.frames.push({
          ...alias,
          rotated: p.rotated,
          frame: { x, y, w: physicalW, h: physicalH },
        });
      contentArea += item.width * item.height;
    }
    page.frames.sort((a, b) => compareIds(a.id, b.id));
    pages.push(page);
  }
  pages.forEach((page, index) => {
    page.image = `${options.name}${pages.length > 1 ? `-${index}` : ''}.png`;
  });
  return {
    pages,
    report: {
      inputCount: request.sprites.length,
      uniqueCount: items.length,
      pageCount: pages.length,
      occupancy: contentArea / outputPixels,
    },
    warnings: [],
  };
}

function render(
  page: AtlasPage,
  item: Prepared,
  x: number,
  y: number,
  w: number,
  h: number,
  rotated: boolean,
  extrude: number,
): void {
  for (let py = -extrude; py < h + extrude; py++) {
    for (let px = -extrude; px < w + extrude; px++) {
      const dx = Math.max(0, Math.min(w - 1, px)),
        dy = Math.max(0, Math.min(h - 1, py));
      const sx = rotated ? dy : dx,
        sy = rotated ? item.height - 1 - dx : dy;
      const source = (sy * item.width + sx) * 4;
      const target = ((y + py) * page.width + x + px) * 4;
      page.pixels.set(item.pixels.subarray(source, source + 4), target);
    }
  }
}
