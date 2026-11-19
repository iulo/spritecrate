import sharp from 'sharp';
import { performance } from 'node:perf_hooks';
import { pack as packPixels, exportAtlas, resolveOptions, AtlasError } from '@spritetuck/core';
import type { AtlasOptions, ExportFormat, Exporter, OutputFile, Report } from '@spritetuck/core';
import { loadInputs } from './input.js';
import type { ImageInput } from './input.js';

export interface PackRequest {
  inputs: readonly (string | ImageInput)[];
  cwd?: string;
  atlas?: AtlasOptions;
  format?: ExportFormat | Exporter;
}

export interface PackOutput {
  files: OutputFile[];
  report: Report & { durationMs: number };
  warnings: string[];
}

export async function pack(request: PackRequest): Promise<PackOutput> {
  const start = performance.now();
  const options = resolveOptions(request.atlas);
  if ((request.format === 'phaser4' || request.format === 'phaser3') && options.rotate) {
    throw new AtlasError(
      'INVALID_OPTIONS',
      'Phaser 4.2.1 / 3.90.0 do not render rotated atlas frames correctly; set rotate to false',
    );
  }
  const sprites = await loadInputs(request.inputs, request.cwd ?? process.cwd());
  const result = packPixels({ sprites, options });
  const files: OutputFile[] = [];
  for (const page of result.pages) {
    const data = await sharp(page.pixels, {
      raw: { width: page.width, height: page.height, channels: 4 },
    })
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toBuffer();
    files.push({ name: page.image, data: new Uint8Array(data) });
  }
  const format = request.format ?? 'json-hash';
  files.push(
    ...(typeof format === 'function'
      ? format(result.pages, options.name)
      : exportAtlas(result.pages, format, options.name)),
  );
  if (new Set(files.map((file) => file.name)).size !== files.length)
    throw new AtlasError('INVALID_OPTIONS', 'Exporter produced duplicate output names');
  return {
    files,
    report: { ...result.report, durationMs: performance.now() - start },
    warnings: result.warnings,
  };
}
