import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { pack, writeOutput } from '@spritecrate/node';

await mkdir('examples/assets', { recursive: true });
for (const [name, background] of [
  ['red', '#ff0000'],
  ['blue', '#0000ff'],
]) {
  await sharp({ create: { width: 32, height: 24, channels: 4, background } })
    .png()
    .toFile(`examples/assets/${name}.png`);
}
const result = await pack({
  inputs: ['examples/assets/*.png'],
  atlas: { name: 'atlas' },
  format: 'phaser4',
});
await writeOutput(result.files, { directory: 'examples/output' });
console.log(result.report);
