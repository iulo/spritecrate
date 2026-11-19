import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import sharp from 'sharp';
import { AtlasError, MAX_IMAGE_PIXELS, MAX_TOTAL_PIXELS } from '@spritecrate/core';
import type { Sprite } from '@spritecrate/core';

export interface ImageInput {
  id: string;
  data: Uint8Array;
}

export async function loadInputs(
  inputs: readonly (string | ImageInput)[],
  cwd: string,
): Promise<Sprite[]> {
  if (!Array.isArray(inputs) || inputs.length === 0)
    throw new AtlasError('NO_INPUT', 'No inputs supplied');
  const sources: ImageInput[] = [];
  const matched = new Set<string>();
  for (const input of inputs) {
    if (typeof input !== 'string') {
      if (!input || typeof input.id !== 'string' || !(input.data instanceof Uint8Array))
        throw new AtlasError('INVALID_INPUT', 'Expected glob string or { id, data: Uint8Array }');
      sources.push(input);
      continue;
    }
    let matches: string[];
    try {
      matches = await fg(input.replaceAll('\\', '/'), {
        cwd,
        onlyFiles: true,
        unique: true,
        followSymbolicLinks: false,
        dot: false,
      });
    } catch {
      throw new AtlasError('INPUT_IO', `Cannot resolve input: ${input}`);
    }
    if (matches.length === 0) throw new AtlasError('NO_INPUT', `No files match: ${input}`);
    for (const file of matches) {
      const absolute = path.resolve(cwd, file);
      if (matched.has(absolute)) continue;
      matched.add(absolute);
      const id = path.relative(cwd, absolute).split(path.sep).join('/');
      if (id.startsWith('../') || path.isAbsolute(id))
        throw new AtlasError('INVALID_INPUT', 'Inputs must be inside cwd', { id });
      try {
        sources.push({ id, data: await readFile(absolute) });
      } catch {
        throw new AtlasError('INPUT_IO', `Cannot read input: ${id}`, { id });
      }
    }
  }
  const sprites: Sprite[] = [];
  let totalPixels = 0;
  for (const source of sources) {
    try {
      const image = sharp(source.data, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' });
      const metadata = await image.metadata();
      if (metadata.format !== 'png' || (metadata.pages ?? 1) !== 1)
        throw new AtlasError(
          'INVALID_INPUT',
          `Only static PNG inputs are supported: ${source.id}`,
          { id: source.id },
        );
      totalPixels += (metadata.width ?? 0) * (metadata.height ?? 0);
      if (totalPixels > MAX_TOTAL_PIXELS)
        throw new AtlasError('LIMIT_EXCEEDED', 'Total input pixel limit exceeded');
      const { data, info } = await image
        .toColourspace('srgb')
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      sprites.push({
        id: source.id,
        width: info.width,
        height: info.height,
        pixels: new Uint8Array(data),
      });
    } catch (error) {
      if (error instanceof AtlasError) throw error;
      throw new AtlasError('DECODE_FAILED', `Cannot decode PNG: ${source.id}`, { id: source.id });
    }
  }
  return sprites;
}
