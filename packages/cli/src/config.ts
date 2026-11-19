import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';
import { AtlasError } from '@spritecrate/node';
import type { AtlasOptions, ExportFormat } from '@spritecrate/node';

export interface Config {
  inputs: string[];
  outDir: string;
  atlas?: AtlasOptions;
  format?: ExportFormat;
}

export async function loadConfig(file?: string): Promise<{ config: Partial<Config>; cwd: string }> {
  if (!file) return { config: {}, cwd: process.cwd() };
  const absolute = path.resolve(file);
  try {
    const config: unknown = JSON.parse(await readFile(absolute, 'utf8'));
    const schema = JSON.parse(
      await readFile(fileURLToPath(new URL('../config.schema.json', import.meta.url)), 'utf8'),
    );
    const validate = new Ajv({ allErrors: true }).compile(schema);
    if (!validate(config))
      throw new AtlasError('INVALID_OPTIONS', 'Invalid configuration', { errors: validate.errors });
    return { config: config as Config, cwd: path.dirname(absolute) };
  } catch (error) {
    if (error instanceof AtlasError) throw error;
    throw new AtlasError('INVALID_OPTIONS', `Cannot read JSON config: ${file}`);
  }
}
