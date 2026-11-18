import { AtlasError } from './model.js';
import type { AtlasOptions, ResolvedOptions } from './model.js';

const defaults: ResolvedOptions = {
  name: 'atlas',
  maxWidth: 2048,
  maxHeight: 2048,
  fixedSize: false,
  powerOfTwo: false,
  square: false,
  trim: true,
  alphaThreshold: 0,
  deduplicate: true,
  rotate: false,
  padding: 2,
  border: 0,
  extrude: 1,
};

export function resolveOptions(options: AtlasOptions = {}): ResolvedOptions {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new AtlasError('INVALID_OPTIONS', 'atlas must be an object');
  }
  for (const key of Object.keys(options)) {
    if (!Object.hasOwn(defaults, key))
      throw new AtlasError('INVALID_OPTIONS', `Unknown atlas option: ${key}`);
  }
  const resolved = { ...defaults, ...options };
  for (const key of [
    'maxWidth',
    'maxHeight',
    'padding',
    'border',
    'extrude',
    'alphaThreshold',
  ] as const) {
    const value = resolved[key];
    const min = key === 'maxWidth' || key === 'maxHeight' ? 1 : 0;
    const max = key === 'alphaThreshold' ? 255 : 8192;
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new AtlasError('INVALID_OPTIONS', `${key} must be an integer in [${min}, ${max}]`);
    }
  }
  for (const key of [
    'fixedSize',
    'powerOfTwo',
    'square',
    'trim',
    'deduplicate',
    'rotate',
  ] as const) {
    if (typeof resolved[key] !== 'boolean')
      throw new AtlasError('INVALID_OPTIONS', `${key} must be boolean`);
  }
  if (typeof resolved.name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(resolved.name)) {
    throw new AtlasError('INVALID_OPTIONS', 'name must be a safe filename stem');
  }
  if (
    /[. ]$/.test(resolved.name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(resolved.name)
  ) {
    throw new AtlasError(
      'INVALID_OPTIONS',
      'name must be portable across supported operating systems',
    );
  }
  if (resolved.fixedSize && resolved.square && resolved.maxWidth !== resolved.maxHeight) {
    throw new AtlasError('INVALID_OPTIONS', 'A fixed square atlas needs equal dimensions');
  }
  if (
    resolved.fixedSize &&
    resolved.powerOfTwo &&
    (!isPowerOfTwo(resolved.maxWidth) || !isPowerOfTwo(resolved.maxHeight))
  ) {
    throw new AtlasError('INVALID_OPTIONS', 'Fixed dimensions must be powers of two');
  }
  return resolved;
}

function isPowerOfTwo(value: number): boolean {
  return (value & (value - 1)) === 0;
}

export function ceilPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)));
}

export function floorPowerOfTwo(value: number): number {
  return 2 ** Math.floor(Math.log2(value));
}
