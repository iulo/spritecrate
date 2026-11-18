export interface Sprite {
  id: string;
  width: number;
  height: number;
  /** Straight-alpha, row-major sRGB RGBA, four bytes per pixel. */
  pixels: Uint8Array;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface AtlasOptions {
  name?: string;
  maxWidth?: number;
  maxHeight?: number;
  fixedSize?: boolean;
  powerOfTwo?: boolean;
  square?: boolean;
  trim?: boolean;
  alphaThreshold?: number;
  deduplicate?: boolean;
  rotate?: boolean;
  padding?: number;
  border?: number;
  extrude?: number;
}

export type ResolvedOptions = Required<AtlasOptions>;

export interface Frame {
  id: string;
  /** Physical rectangle on the atlas; excludes extrusion. */
  frame: Rect;
  /** Clockwise 90 degrees, if true. */
  rotated: boolean;
  trimmed: boolean;
  sourceSize: Size;
  spriteSourceSize: Rect;
}

export interface AtlasPage {
  image: string;
  width: number;
  height: number;
  pixels: Uint8Array;
  frames: Frame[];
}

export interface Report {
  inputCount: number;
  uniqueCount: number;
  pageCount: number;
  /** Unique content area divided by total output area. */
  occupancy: number;
}

export interface PackResult {
  pages: AtlasPage[];
  report: Report;
  warnings: string[];
}

export interface OutputFile {
  name: string;
  data: Uint8Array;
}

export type ExportFormat = 'json-hash' | 'json-array' | 'phaser3';
export type Exporter = (pages: readonly AtlasPage[], name: string) => OutputFile[];

export type ErrorCode =
  | 'INVALID_OPTIONS'
  | 'INVALID_INPUT'
  | 'DUPLICATE_ID'
  | 'NO_INPUT'
  | 'IMAGE_TOO_LARGE'
  | 'LIMIT_EXCEEDED'
  | 'INPUT_IO'
  | 'DECODE_FAILED'
  | 'OUTPUT_IO';

export class AtlasError extends Error {
  readonly code: ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AtlasError';
    this.code = code;
    this.details = details;
  }
}

export const MAX_IMAGE_PIXELS: number = 16_777_216;
export const MAX_TOTAL_PIXELS: number = 67_108_864;
export const MAX_SPRITES: number = 10_000;

export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
