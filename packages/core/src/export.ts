import { exportCocos } from './export-cocos.js';
import { AtlasError, EXPORT_FORMATS } from './model.js';
import { VERSION } from './version.js';
import type { AtlasPage, ExportFormat, Frame, OutputFile } from './model.js';

function frameData(frame: Frame): Omit<Frame, 'id'> {
  const { id: _id, ...data } = frame;
  // TexturePacker/Phaser describe logical, unrotated dimensions, even though
  // the physical atlas rectangle has swapped dimensions when rotated.
  return {
    ...data,
    frame: { ...frame.frame, w: frame.spriteSourceSize.w, h: frame.spriteSourceSize.h },
  };
}

function jsonFile(name: string, value: unknown): OutputFile {
  // All generated JSON contains Unicode as escapes so core needs no DOM TextEncoder.
  const json = `${JSON.stringify(value, null, 2)}\n`.replace(
    /[\u007f-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  return { name, data: Uint8Array.from(json, (char) => char.charCodeAt(0)) };
}

export function exportAtlas(
  pages: readonly AtlasPage[],
  format: ExportFormat,
  name = 'atlas',
): OutputFile[] {
  if (!EXPORT_FORMATS.includes(format))
    throw new AtlasError('INVALID_OPTIONS', `Unknown format: ${format}`);
  if (format === 'cocos2d') return exportCocos(pages);
  if (format === 'phaser4' || format === 'phaser3') {
    if (pages.some((page) => page.frames.some((frame) => frame.rotated))) {
      throw new AtlasError('INVALID_OPTIONS', 'Phaser export requires unrotated frames');
    }
    return [
      jsonFile(`${name}.json`, {
        textures: pages.map((page) => ({
          image: page.image,
          format: 'RGBA8888',
          size: { w: page.width, h: page.height },
          scale: 1,
          frames: page.frames.map((frame) => ({ filename: frame.id, ...frameData(frame) })),
        })),
        meta: { app: 'SpriteTuck', version: VERSION },
      }),
    ];
  }
  return pages.map((page) =>
    jsonFile(page.image.replace(/\.png$/, '.json'), {
      frames:
        format === 'json-hash' || format === 'pixijs'
          ? Object.fromEntries(page.frames.map((frame) => [frame.id, frameData(frame)]))
          : page.frames.map((frame) => ({ filename: frame.id, ...frameData(frame) })),
      meta: {
        app: 'SpriteTuck',
        version: VERSION,
        image: page.image,
        format: 'RGBA8888',
        size: { w: page.width, h: page.height },
        scale: 1,
        ...(format === 'pixijs' && pages.length > 1
          ? {
              related_multi_packs: pages
                .filter((other) => other !== page)
                .map((other) => other.image.replace(/\.png$/, '.json')),
            }
          : {}),
      },
    }),
  );
}
