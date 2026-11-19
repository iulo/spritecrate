import { AtlasError, compareIds, MAX_IMAGE_PIXELS, MAX_TOTAL_PIXELS } from './model.js';
import type { AtlasOptions, AtlasPage, PackResult, Sprite } from './model.js';
import { resolveOptions } from './options.js';
import { planLayout } from './layout.js';
import { prepare } from './preprocess.js';
import type { Prepared } from './preprocess.js';

export function pack(request: { sprites: readonly Sprite[]; options?: AtlasOptions }): PackResult {
  const options = resolveOptions(request.options);
  const items = prepare(request.sprites, options);
  const pages: AtlasPage[] = [];
  const { border, extrude } = options;
  let outputPixels = 0;
  let contentArea = 0;
  for (const { width, height, placed } of planLayout(items, options)) {
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
