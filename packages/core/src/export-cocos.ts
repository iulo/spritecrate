import { AtlasError } from './model.js';
import type { AtlasPage, OutputFile } from './model.js';

type PlistValue = string | number | boolean | PlistValue[] | { [key: string]: PlistValue };

function xmlText(value: string): string {
  return Array.from(value, (char) => {
    const code = char.codePointAt(0)!;
    if (
      (code < 32 && code !== 9 && code !== 10 && code !== 13) ||
      (code >= 0xd800 && code <= 0xdfff) ||
      code === 0xfffe ||
      code === 0xffff
    )
      throw new AtlasError('INVALID_INPUT', 'Cocos plist contains a name unsupported by XML 1.0');
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    // ASCII output keeps core independent of TextEncoder and preserves CR in XML.
    return code >= 127 || code === 9 || code === 10 || code === 13 ? `&#${code};` : char;
  }).join('');
}

function plist(value: PlistValue): string {
  if (typeof value === 'string') return `<string>${xmlText(value)}</string>`;
  if (typeof value === 'number') return `<integer>${value}</integer>`;
  if (typeof value === 'boolean') return value ? '<true/>' : '<false/>';
  if (Array.isArray(value)) return `<array>${value.map(plist).join('')}</array>`;
  return `<dict>${Object.entries(value)
    .map(([key, item]) => `<key>${xmlText(key)}</key>${plist(item)}`)
    .join('')}</dict>`;
}

export function exportCocos(pages: readonly AtlasPage[]): OutputFile[] {
  return pages.map((page) => {
    const frames = Object.fromEntries(
      page.frames.map((frame) => {
        const crop = frame.spriteSourceSize;
        const source = frame.sourceSize;
        // Cocos offsets are measured from the source center, with positive Y up.
        const offsetX = crop.x + crop.w / 2 - source.w / 2;
        const offsetY = source.h / 2 - crop.y - crop.h / 2;
        return [
          frame.id,
          {
            aliases: [],
            spriteOffset: `{${offsetX},${offsetY}}`,
            spriteSize: `{${crop.w},${crop.h}}`,
            spriteSourceSize: `{${source.w},${source.h}}`,
            // Match TexturePacker: rectangle dimensions stay logical when rotated.
            textureRect: `{{${frame.frame.x},${frame.frame.y}},{${crop.w},${crop.h}}}`,
            textureRotated: frame.rotated,
          },
        ];
      }),
    );
    const document = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">${plist({
      frames,
      metadata: {
        format: 3,
        pixelFormat: 'RGBA8888',
        premultiplyAlpha: false,
        realTextureFileName: page.image,
        textureFileName: page.image,
        size: `{${page.width},${page.height}}`,
      },
    })}</plist>
`;
    return {
      name: page.image.replace(/\.png$/, '.plist'),
      data: Uint8Array.from(document, (char) => char.charCodeAt(0)),
    };
  });
}
