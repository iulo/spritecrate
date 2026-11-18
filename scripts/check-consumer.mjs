import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const root = process.cwd();
const temporary = await mkdtemp(path.join(tmpdir(), 'spritetunk-consumer-'));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const tooling = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const dependencies = {};
for (const name of ['core', 'node', 'cli']) {
  const manifest = JSON.parse(
    await readFile(path.join(root, 'packages', name, 'package.json'), 'utf8'),
  );
  dependencies[manifest.name] =
    `file:${path.join(root, '.cache', 'packs', `spritetunk-${name}-${manifest.version}.tgz`)}`;
}
const run = (args) =>
  execFileSync(pnpm, args, {
    cwd: temporary,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
try {
  await writeFile(
    path.join(temporary, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies,
        devDependencies: {
          typescript: tooling.devDependencies.typescript,
          '@types/node': tooling.devDependencies['@types/node'],
        },
        pnpm: { overrides: dependencies },
      },
      null,
      2,
    ),
  );
  run(['install', '--prefer-offline', '--ignore-scripts']);
  await mkdir(path.join(temporary, 'assets'));
  await sharp({ create: { width: 2, height: 3, channels: 4, background: '#ff0000' } })
    .png()
    .toFile(path.join(temporary, 'assets', 'a.png'));
  await writeFile(
    path.join(temporary, 'consumer.ts'),
    `
import { pack as packPixels } from '@spritetunk/core';
import { pack, writeOutput } from '@spritetunk/node';
const core = packPixels({ sprites: [{ id: 'x', width: 1, height: 1, pixels: new Uint8Array([1, 2, 3, 255]) }] });
if (core.pages.length !== 1) throw new Error('core consumer failed');
const result = await pack({ inputs: ['assets/*.png'], format: 'phaser3' });
await writeOutput(result.files, { directory: 'sdk-output' });
`,
  );
  await writeFile(
    path.join(temporary, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        strict: true,
        types: ['node'],
        outDir: 'built',
      },
      include: ['consumer.ts'],
    }),
  );
  run(['exec', 'tsc']);
  execFileSync(process.execPath, ['built/consumer.js'], { cwd: temporary, stdio: 'inherit' });
  run(['exec', 'spritetunk', 'pack', 'assets/*.png', '--out-dir', 'cli-output', '--json']);
  const json = JSON.parse(await readFile(path.join(temporary, 'cli-output', 'atlas.json'), 'utf8'));
  if (!json.frames['assets/a.png']) throw new Error('CLI consumer output is missing the frame');
  console.log('Installed tarballs: SDK runtime, TypeScript declarations and CLI bin passed.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
