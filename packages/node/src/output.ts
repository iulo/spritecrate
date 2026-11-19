import { createHash } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { AtlasError } from '@spritetuck/core';
import type { OutputFile } from '@spritetuck/core';

const MANIFEST = '.spritetuck-manifest.json';
const LOCK = '.spritetuck.lock';
// Coordinate with pre-rename writers and migrate their ownership records safely.
const LEGACY_MANIFEST = '.spritetunk-manifest.json';
const LEGACY_LOCK = '.spritetunk.lock';
interface Entry {
  name: string;
  sha256: string;
}

function safeName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name !== '.' &&
    name !== '..' &&
    !/[\\/<>:"|?*]/.test(name) &&
    ![...name].some((char) => char.charCodeAt(0) < 32) &&
    !/[. ]$/.test(name) &&
    !/^\.sprite(?:tuck|tunk)/i.test(name) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
  );
}

function digest(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

async function regularFile(file: string): Promise<boolean> {
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink())
      throw new AtlasError('OUTPUT_IO', `Refusing nonregular output: ${path.basename(file)}`);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function writeOutput(
  files: readonly OutputFile[],
  options: { directory: string },
): Promise<void> {
  const names = new Set<string>();
  for (const file of files) {
    if (
      !file ||
      !safeName(file.name) ||
      !(file.data instanceof Uint8Array) ||
      names.has(file.name.toLowerCase())
    )
      throw new AtlasError('INVALID_OPTIONS', 'Unsafe or duplicate output filename', {
        name: file?.name,
      });
    names.add(file.name.toLowerCase());
  }
  if (!files.length) throw new AtlasError('INVALID_OPTIONS', 'No output files supplied');
  const directory = path.resolve(options.directory);
  await mkdir(directory, { recursive: true }).catch(() => {
    throw new AtlasError('OUTPUT_IO', 'Cannot create output directory');
  });
  let lock;
  try {
    lock = await open(path.join(directory, LOCK), 'wx');
  } catch {
    throw new AtlasError(
      'OUTPUT_IO',
      'Output directory is locked; remove .spritetuck.lock only after confirming no writer is active',
    );
  }
  let legacyLock;
  let stage: string | undefined;
  const backups = new Map<string, string>();
  const changed: string[] = [];
  try {
    try {
      legacyLock = await open(path.join(directory, LEGACY_LOCK), 'wx');
    } catch {
      throw new AtlasError(
        'OUTPUT_IO',
        'Output directory is locked by a legacy writer; remove .spritetunk.lock only after confirming no writer is active',
      );
    }
    const manifestPath = path.join(directory, MANIFEST);
    const legacyManifestPath = path.join(directory, LEGACY_MANIFEST);
    const hasManifest = await regularFile(manifestPath);
    const hasLegacyManifest = await regularFile(legacyManifestPath);
    if (hasManifest && hasLegacyManifest)
      throw new AtlasError('OUTPUT_IO', 'Both current and legacy output manifests exist');
    let previous: Entry[] = [];
    if (hasManifest || hasLegacyManifest) {
      const manifest = JSON.parse(
        await readFile(hasManifest ? manifestPath : legacyManifestPath, 'utf8'),
      ) as {
        version: unknown;
        files: Entry[];
      };
      if (
        manifest.version !== 1 ||
        !Array.isArray(manifest.files) ||
        !manifest.files.every(
          (entry) => entry && safeName(entry.name) && /^[a-f0-9]{64}$/.test(entry.sha256),
        )
      )
        throw new AtlasError('OUTPUT_IO', 'Invalid output manifest');
      previous = manifest.files;
    }
    const old = new Map(previous.map((entry) => [entry.name, entry.sha256]));
    for (const file of files) {
      const target = path.join(directory, file.name);
      if (await regularFile(target)) {
        if (!old.has(file.name) || digest(await readFile(target)) !== old.get(file.name))
          throw new AtlasError(
            'OUTPUT_IO',
            `Refusing to overwrite an unmanaged or edited file: ${file.name}`,
          );
      }
    }
    const obsolete: string[] = hasLegacyManifest ? [LEGACY_MANIFEST] : [];
    for (const entry of previous) {
      if (names.has(entry.name.toLowerCase())) continue;
      const target = path.join(directory, entry.name);
      if ((await regularFile(target)) && digest(await readFile(target)) === entry.sha256)
        obsolete.push(entry.name);
    }
    stage = await mkdtemp(path.join(directory, '.spritetuck-stage-'));
    const manifest: OutputFile = {
      name: MANIFEST,
      data: new TextEncoder().encode(
        `${JSON.stringify({ version: 1, files: files.map((file) => ({ name: file.name, sha256: digest(file.data) })) }, null, 2)}\n`,
      ),
    };
    const outputs = [...files, manifest];
    for (const [index, file] of outputs.entries())
      await writeFile(path.join(stage, `new-${index}`), file.data);
    const affected = [...new Set([...outputs.map((file) => file.name), ...obsolete])];
    for (const [index, name] of affected.entries()) {
      const target = path.join(directory, name);
      if (await regularFile(target)) {
        const backup = path.join(stage, `old-${index}`);
        await copyFile(target, backup);
        backups.set(name, backup);
      }
    }
    for (const [index, file] of outputs.entries()) {
      await rename(path.join(stage, `new-${index}`), path.join(directory, file.name));
      changed.push(file.name);
    }
    for (const name of obsolete) {
      await rm(path.join(directory, name));
      changed.push(name);
    }
  } catch (error) {
    const failures: string[] = [];
    for (const name of changed.reverse()) {
      try {
        const backup = backups.get(name);
        if (backup) await copyFile(backup, path.join(directory, name));
        else await rm(path.join(directory, name), { force: true });
      } catch {
        failures.push(name);
      }
    }
    if (failures.length)
      throw new AtlasError(
        'OUTPUT_IO',
        'Output failed and rollback was incomplete; backup directory retained',
        { files: failures, backup: stage },
      );
    if (stage) {
      await rm(stage, { recursive: true, force: true });
      stage = undefined;
    }
    if (error instanceof AtlasError) throw error;
    throw new AtlasError('OUTPUT_IO', 'Cannot write output files', {
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (legacyLock) {
      await legacyLock.close();
      await rm(path.join(directory, LEGACY_LOCK), { force: true });
    }
    await lock.close();
    await rm(path.join(directory, LOCK), { force: true });
  }
  if (stage) await rm(stage, { recursive: true, force: true });
}
