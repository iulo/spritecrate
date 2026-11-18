import { afterEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { png, sprite } from './helpers.js';
import { parse } from 'plist';
import { VERSION } from '@spritetunk/core';

const exec = promisify(execFile);
const bin = path.resolve('packages/cli/dist/index.js');
const directories: string[] = [];
async function setup(): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), 'spritetunk-cli-'));
  directories.push(cwd);
  await writeFile(path.join(cwd, 'a.png'), await png(sprite('a', 2, 3)));
  return cwd;
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('CLI subprocess', () => {
  it('supports help and version', async () => {
    expect((await exec(process.execPath, [bin, '--help'])).stdout).toContain('Usage:');
    expect((await exec(process.execPath, [bin, '--version'])).stdout.trim()).toBe(VERSION);
  });

  it('packs from configuration relative to the config directory', async () => {
    const cwd = await setup();
    const unrelated = await setup();
    await writeFile(
      path.join(cwd, 'config.json'),
      JSON.stringify({
        inputs: ['*.png'],
        outDir: 'result',
        atlas: { name: 'configured' },
        format: 'phaser3',
      }),
    );
    const { stdout, stderr } = await exec(
      process.execPath,
      [bin, 'pack', '--config', path.join(cwd, 'config.json'), '--json'],
      { cwd: unrelated },
    );
    expect(stderr).toBe('');
    expect(JSON.parse(stdout).ok).toBe(true);
    expect(await readdir(path.join(cwd, 'result'))).toContain('configured.json');
    expect(
      JSON.parse(await readFile(path.join(cwd, 'result', 'configured.json'), 'utf8')).textures[0]
        .image,
    ).toBe('configured.png');
    expect(await readdir(unrelated)).not.toContain('result');
  });

  it('lets explicit CLI paths and options override configuration', async () => {
    const cwd = await setup();
    const configDir = await setup();
    await writeFile(
      path.join(configDir, 'config.json'),
      JSON.stringify({
        inputs: ['missing.png'],
        outDir: 'not-used',
        atlas: { name: 'configured' },
      }),
    );
    await exec(
      process.execPath,
      [
        bin,
        'pack',
        '*.png',
        '--config',
        path.join(configDir, 'config.json'),
        '--name',
        'override',
        '--out-dir',
        'actual',
      ],
      { cwd },
    );
    expect(await readdir(path.join(cwd, 'actual'))).toContain('override.png');
  });

  it.each(['pixijs', 'cocos2d'])('accepts %s in configuration and CLI flags', async (format) => {
    const cwd = await setup();
    await writeFile(
      path.join(cwd, 'config.json'),
      JSON.stringify({ inputs: ['a.png'], outDir: 'output', format }),
    );
    const { stdout } = await exec(
      process.execPath,
      [bin, 'pack', '--config', 'config.json', '--format', format, '--json'],
      { cwd },
    );
    expect(JSON.parse(stdout).ok).toBe(true);
    const name = `atlas.${format === 'cocos2d' ? 'plist' : 'json'}`;
    const text = await readFile(path.join(cwd, 'output', name), 'utf8');
    const data = format === 'cocos2d' ? parse(text) : JSON.parse(text);
    expect(Object.keys((data as { frames: object }).frames)).toContain('a.png');
  });

  it('dry-runs without creating output directories', async () => {
    const cwd = await setup();
    const { stdout } = await exec(
      process.execPath,
      [bin, 'pack', '*.png', '--out-dir', 'preview', '--dry-run', '--json'],
      { cwd },
    );
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, dryRun: true });
    expect(await readdir(cwd)).not.toContain('preview');
  });

  it.each([
    { args: ['pack', '--wat'], code: 2, error: 'INVALID_OPTIONS' },
    { args: ['pack', '*.nothing'], code: 3, error: 'NO_INPUT' },
    { args: ['pack', '*.png', '--format', 'wrong'], code: 2, error: 'INVALID_OPTIONS' },
  ])('has structured errors and exit code $code', async ({ args, code, error }) => {
    await expect(
      exec(process.execPath, [bin, ...args, '--json'], { cwd: await setup() }),
    ).rejects.toMatchObject({
      code,
      stdout: expect.stringContaining(`"code":"${error}"`),
      stderr: expect.stringContaining(error),
    });
  });

  it('validates schema and never executes config code', async () => {
    const cwd = await setup();
    await mkdir(path.join(cwd, 'config'));
    const file = path.join(cwd, 'config', 'bad.json');
    await writeFile(
      file,
      JSON.stringify({ inputs: ['*.png'], atlas: { padding: -1 }, unexpected: true }),
    );
    await expect(
      exec(process.execPath, [bin, 'pack', '--config', file, '--json'], { cwd }),
    ).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining('INVALID_OPTIONS') });
  });
});
