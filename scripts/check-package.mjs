import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const destination = path.join(root, '.cache', 'packs');
await mkdir(destination, { recursive: true });
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
function run(args) {
  execFileSync(pnpm, args, { stdio: 'inherit', shell: process.platform === 'win32' });
}
run(['exec', 'publint']);
run(['pack', '--pack-destination', destination]);
const archive = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
run(['exec', 'attw', path.join(destination, archive), '--profile', 'esm-only']);
