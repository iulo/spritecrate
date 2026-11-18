#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { pack, writeOutput, AtlasError, VERSION, EXPORT_FORMATS } from '@spritetunk/node';
import type { ExportFormat } from '@spritetunk/node';
import { loadConfig } from './config.js';

const help = `SpriteTunk ${VERSION} — texture atlas packer

Usage: spritetunk pack [glob ...] [options]

  --config <file>   JSON configuration (paths relative to this file)
  --out-dir <dir>   Output directory (default: dist/atlas)
  --name <name>     Atlas basename (default: atlas)
  --format <name>   ${EXPORT_FORMATS.join(' | ')}
  --dry-run        Validate and pack without writing files
  --json           Emit one JSON result to stdout
  --help           Show help
  --version        Show version
`;

async function main(): Promise<void> {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        config: { type: 'string' },
        'out-dir': { type: 'string' },
        name: { type: 'string' },
        format: { type: 'string' },
        'dry-run': { type: 'boolean' },
        json: { type: 'boolean' },
        help: { type: 'boolean' },
        version: { type: 'boolean' },
      },
    });
  } catch (error) {
    throw new AtlasError(
      'INVALID_OPTIONS',
      error instanceof Error ? error.message : 'Invalid arguments',
    );
  }
  const { values, positionals } = args;
  if (values.help || process.argv.length === 2) {
    process.stdout.write(help);
    return;
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (positionals[0] !== 'pack') throw new AtlasError('INVALID_OPTIONS', 'Expected command: pack');
  const { config, cwd } = await loadConfig(values.config as string | undefined);
  const cliInputs = positionals.slice(1);
  const inputs = cliInputs.length ? cliInputs : (config.inputs ?? []);
  const format = values.format ?? config.format ?? 'json-hash';
  if (!EXPORT_FORMATS.includes(format as ExportFormat))
    throw new AtlasError('INVALID_OPTIONS', `Unknown format: ${String(format)}`);
  const atlas = {
    ...config.atlas,
    ...(values.name !== undefined ? { name: values.name as string } : {}),
  };
  const result = await pack({
    inputs,
    cwd: cliInputs.length ? process.cwd() : cwd,
    atlas,
    format: format as ExportFormat,
  });
  const directory =
    values['out-dir'] !== undefined
      ? path.resolve(values['out-dir'] as string)
      : path.resolve(cwd, config.outDir ?? 'dist/atlas');
  if (!values['dry-run']) await writeOutput(result.files, { directory });
  if (values.json)
    process.stdout.write(
      `${JSON.stringify({ ok: true, dryRun: Boolean(values['dry-run']), files: result.files.map((file) => ({ name: file.name, bytes: file.data.length })), report: result.report, warnings: result.warnings })}\n`,
    );
  else {
    process.stdout.write(
      `${values['dry-run'] ? 'Preview' : 'Packed'}: ${result.report.inputCount} sprites → ${result.report.pageCount} pages (${(result.report.occupancy * 100).toFixed(1)}% content occupancy)\n`,
    );
    for (const warning of result.warnings) process.stderr.write(`${warning}\n`);
  }
}

try {
  await main();
} catch (error) {
  const code = error instanceof AtlasError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof Error ? error.message : String(error);
  const details = error instanceof AtlasError ? error.details : {};
  if (process.argv.includes('--json'))
    process.stdout.write(`${JSON.stringify({ ok: false, error: { code, message, details } })}\n`);
  process.stderr.write(`${code}: ${message}\n`);
  process.exitCode =
    code === 'INVALID_OPTIONS'
      ? 2
      : [
            'NO_INPUT',
            'INVALID_INPUT',
            'DUPLICATE_ID',
            'DECODE_FAILED',
            'IMAGE_TOO_LARGE',
            'LIMIT_EXCEEDED',
            'INPUT_IO',
          ].includes(code)
        ? 3
        : 1;
}
