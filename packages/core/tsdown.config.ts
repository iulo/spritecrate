import { defineConfig } from 'tsdown';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  define: { __SPRITECRATE_VERSION__: JSON.stringify(version) },
  fixedExtension: false,
  sourcemap: true,
  clean: true,
});
