import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const root = process.cwd();
const useRegistry = process.argv.includes('--registry');
const temporary = await mkdtemp(path.join(tmpdir(), 'spritecrate-consumer-'));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const tooling = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const dependencies = {};
for (const name of ['core', 'node', 'cli']) {
  const manifest = JSON.parse(
    await readFile(path.join(root, 'packages', name, 'package.json'), 'utf8'),
  );
  dependencies[manifest.name] = useRegistry
    ? manifest.version
    : `file:${path.join(root, '.cache', 'packs', `spritecrate-${name}-${manifest.version}.tgz`)}`;
}
const run = (args) =>
  execFileSync(pnpm, args, {
    cwd: temporary,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
try {
  if (useRegistry) {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (true) {
      const missing = [];
      for (const [name, version] of Object.entries(dependencies)) {
        const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) {
          const metadata = await response.json();
          const published = metadata.versions[version];
          if (published) {
            // npm metadata can propagate before the associated tarball is downloadable.
            const archive = await fetch(published.dist.tarball, {
              method: 'HEAD',
              cache: 'no-store',
              signal: AbortSignal.timeout(15000),
            });
            if (archive.ok) continue;
            if (archive.status !== 404) throw new Error(`Tarball returned ${archive.status}`);
          }
        } else if (response.status !== 404) throw new Error(`Registry returned ${response.status}`);
        missing.push(`${name}@${version}`);
      }
      if (!missing.length) break;
      if (Date.now() >= deadline) throw new Error(`Registry timed out: ${missing.join(', ')}`);
      console.log(`Waiting: ${missing.join(', ')}`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
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
  run([
    'install',
    ...(useRegistry ? [] : ['--prefer-offline']),
    '--ignore-scripts',
    '--registry=https://registry.npmjs.org',
  ]);
  await mkdir(path.join(temporary, 'assets'));
  await sharp({ create: { width: 2, height: 3, channels: 4, background: '#ff0000' } })
    .png()
    .toFile(path.join(temporary, 'assets', 'a.png'));
  await writeFile(
    path.join(temporary, 'consumer.ts'),
    `
import { pack as packPixels } from '@spritecrate/core';
import { pack, writeOutput } from '@spritecrate/node';
const core = packPixels({ sprites: [{ id: 'x', width: 1, height: 1, pixels: new Uint8Array([1, 2, 3, 255]) }] });
if (core.pages.length !== 1) throw new Error('core consumer failed');
const result = await pack({ inputs: ['assets/*.png'], format: 'phaser4' });
await writeOutput(result.files, { directory: 'sdk-output' });
for (const format of ['pixijs', 'cocos2d'] as const) {
  const output = await pack({ inputs: ['assets/*.png'], format });
  const suffix = format === 'cocos2d' ? '.plist' : '.json';
  if (!output.files.some(file => file.name.endsWith(suffix))) throw new Error(format + ' consumer output missing');
}
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
  run(['exec', 'spritecrate', 'pack', 'assets/*.png', '--out-dir', 'cli-output', '--json']);
  const json = JSON.parse(await readFile(path.join(temporary, 'cli-output', 'atlas.json'), 'utf8'));
  if (!json.frames['assets/a.png']) throw new Error('CLI consumer output is missing the frame');
  for (const format of ['pixijs', 'cocos2d']) {
    const directory = `cli-${format}`;
    run([
      'exec',
      'spritecrate',
      'pack',
      'assets/*.png',
      '--format',
      format,
      '--out-dir',
      directory,
      '--json',
    ]);
    const suffix = format === 'cocos2d' ? '.plist' : '.json';
    const descriptor = await readFile(path.join(temporary, directory, 'atlas' + suffix), 'utf8');
    if (
      format === 'pixijs'
        ? !JSON.parse(descriptor).frames['assets/a.png']
        : !descriptor.includes('<key>assets/a.png</key>')
    ) {
      throw new Error(format + ' CLI consumer output is missing the frame');
    }
  }
  console.log(
    `${useRegistry ? 'Public npm registry' : 'Installed tarballs'}: SDK runtime, TypeScript declarations and CLI bin passed.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
