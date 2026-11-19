import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, readdir, rm, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { pack, writeOutput } from '@spritetuck/node';
import { png, sprite } from './helpers.js';

const directories: string[] = [];
async function directory(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'spritetuck-test-'));
  directories.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Node SDK', () => {
  it.each(['phaser4', 'phaser3'] as const)(
    'rejects %s rotation before reading inputs',
    async (format) => {
      await expect(
        pack({ inputs: ['missing.png'], format, atlas: { rotate: true } }),
      ).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
    },
  );
  it('encodes a valid PNG and emits structured descriptors without writing', async () => {
    const result = await pack({
      inputs: [{ id: 'hero.png', data: await png(sprite('hero.png', 3, 4)) }],
      atlas: { name: 'game', extrude: 0 },
      format: 'phaser4',
    });
    expect(result.files.map((file) => file.name)).toEqual(['game.png', 'game.json']);
    const decoded = await sharp(result.files[0]!.data).raw().toBuffer({ resolveWithObject: true });
    expect([decoded.info.width, decoded.info.height, decoded.info.channels]).toEqual([3, 4, 4]);
    expect(new Uint8Array(decoded.data)).toEqual(sprite('hero.png', 3, 4).pixels);
    const meta = JSON.parse(Buffer.from(result.files[1]!.data).toString());
    expect(meta.textures[0].frames[0].filename).toBe('hero.png');
    expect(result.report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('accepts overlapping globs once and normalizes relative ids', async () => {
    const cwd = await directory();
    await writeFile(path.join(cwd, '中文.png'), await png(sprite('image', 1, 1)));
    const result = await pack({ inputs: ['*.png', '中文.png'], cwd });
    expect(result.report.inputCount).toBe(1);
    const data = JSON.parse(Buffer.from(result.files[1]!.data).toString());
    expect(Object.keys(data.frames)).toEqual(['中文.png']);
  });

  it('accepts custom in-memory exporters', async () => {
    const result = await pack({
      inputs: [{ id: 'a', data: await png(sprite('a', 1, 1)) }],
      format: (pages) => [
        { name: 'custom.txt', data: new TextEncoder().encode(String(pages.length)) },
      ],
    });
    expect(result.files.at(-1)!.name).toBe('custom.txt');
  });

  it('reports missing, corrupt and unsupported inputs', async () => {
    await expect(pack({ inputs: ['missing-*.png'], cwd: await directory() })).rejects.toMatchObject(
      { code: 'NO_INPUT' },
    );
    await expect(
      pack({ inputs: [{ id: 'bad', data: new Uint8Array([1, 2]) }] }),
    ).rejects.toMatchObject({ code: 'DECODE_FAILED', details: { id: 'bad' } });
    const jpg = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } })
      .jpeg()
      .toBuffer();
    await expect(pack({ inputs: [{ id: 'jpg', data: jpg }] })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('generates byte-identical results on repeated runs', async () => {
    const input = [{ id: 'a', data: await png(sprite('a', 5, 4)) }];
    expect((await pack({ inputs: input })).files).toEqual((await pack({ inputs: input })).files);
  });
});

describe('output ownership and recovery', () => {
  const file = (name: string, content: string): { name: string; data: Uint8Array } => ({
    name,
    data: new TextEncoder().encode(content),
  });

  it('replaces owned files and cleans only unchanged stale outputs', async () => {
    const dir = await directory();
    await writeFile(path.join(dir, 'README.txt'), 'unrelated');
    await writeOutput([file('old.png', 'old'), file('keep.png', 'keep')], { directory: dir });
    await writeFile(path.join(dir, 'keep.png'), 'user edit');
    await writeOutput([file('new.png', 'new')], { directory: dir });
    const names = await readdir(dir);
    expect(names).not.toContain('old.png');
    expect(await readFile(path.join(dir, 'README.txt'), 'utf8')).toBe('unrelated');
    expect(await readFile(path.join(dir, 'keep.png'), 'utf8')).toBe('user edit');
    await writeOutput([file('new.png', 'updated')], { directory: dir });
    expect(await readFile(path.join(dir, 'new.png'), 'utf8')).toBe('updated');
  });

  it('refuses unmanaged or modified targets before replacing any files', async () => {
    const dir = await directory();
    await writeOutput([file('a.png', 'a'), file('b.png', 'b')], { directory: dir });
    await writeFile(path.join(dir, 'b.png'), 'edit');
    await expect(
      writeOutput([file('a.png', 'new'), file('b.png', 'new')], { directory: dir }),
    ).rejects.toMatchObject({ code: 'OUTPUT_IO' });
    expect(await readFile(path.join(dir, 'a.png'), 'utf8')).toBe('a');
    expect(await readdir(dir)).not.toContain('.spritetuck.lock');
  });

  it('migrates legacy ownership while preserving unrelated and edited stale files', async () => {
    const dir = await directory();
    await writeOutput([file('a.png', 'a'), file('stale.png', 'old')], { directory: dir });
    await rename(
      path.join(dir, '.spritetuck-manifest.json'),
      path.join(dir, '.spritetunk-manifest.json'),
    );
    await writeFile(path.join(dir, 'stale.png'), 'user edit');
    await writeFile(path.join(dir, 'README.txt'), 'unrelated');
    await writeOutput([file('a.png', 'updated')], { directory: dir });
    expect(await readFile(path.join(dir, 'a.png'), 'utf8')).toBe('updated');
    expect(await readFile(path.join(dir, 'stale.png'), 'utf8')).toBe('user edit');
    expect(await readFile(path.join(dir, 'README.txt'), 'utf8')).toBe('unrelated');
    expect((await readdir(dir)).sort()).toEqual([
      '.spritetuck-manifest.json',
      'README.txt',
      'a.png',
      'stale.png',
    ]);
  });

  it('refuses edited legacy outputs without migrating their ownership', async () => {
    const dir = await directory();
    await writeOutput([file('a.png', 'a')], { directory: dir });
    await rename(
      path.join(dir, '.spritetuck-manifest.json'),
      path.join(dir, '.spritetunk-manifest.json'),
    );
    await writeFile(path.join(dir, 'a.png'), 'edit');
    await expect(writeOutput([file('a.png', 'new')], { directory: dir })).rejects.toMatchObject({
      code: 'OUTPUT_IO',
    });
    expect(await readFile(path.join(dir, 'a.png'), 'utf8')).toBe('edit');
    expect(await readdir(dir)).toContain('.spritetunk-manifest.json');
    expect(await readdir(dir)).not.toContain('.spritetuck-manifest.json');
  });

  it('respects legacy writer locks without deleting another writer lock', async () => {
    const dir = await directory();
    await writeFile(path.join(dir, '.spritetunk.lock'), 'active');
    await expect(writeOutput([file('a.png', 'new')], { directory: dir })).rejects.toMatchObject({
      code: 'OUTPUT_IO',
    });
    expect(await readFile(path.join(dir, '.spritetunk.lock'), 'utf8')).toBe('active');
    expect(await readdir(dir)).not.toContain('.spritetuck.lock');
  });

  it.each([
    '../escape',
    '/absolute.png',
    'sub/file.png',
    'sub\\file.png',
    '.spritetuck.lock',
    '.spritetuck-manifest.json',
    '.spritetunk.lock',
    '.spritetunk-manifest.json',
  ])('rejects unsafe name %s', async (name) => {
    await expect(
      writeOutput([file(name, 'x')], { directory: await directory() }),
    ).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  });

  it('refuses a symbolic-link output and concurrent writer lock', async () => {
    const dir = await directory();
    const outside = path.join(await directory(), 'target');
    await writeFile(outside, 'untouched');
    await symlink(outside, path.join(dir, 'a.png'));
    await expect(writeOutput([file('a.png', 'x')], { directory: dir })).rejects.toMatchObject({
      code: 'OUTPUT_IO',
    });
    expect(await readFile(outside, 'utf8')).toBe('untouched');
    await writeFile(path.join(dir, '.spritetuck.lock'), '');
    await expect(writeOutput([file('b.png', 'x')], { directory: dir })).rejects.toMatchObject({
      code: 'OUTPUT_IO',
    });
  });
});
