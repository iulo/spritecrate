# SpriteTunk

English | [简体中文](README_CN.md)

A texture atlas packer for JavaScript projects, with a Node.js SDK and CLI.

Combine PNG sprites into texture atlases and export metadata for Phaser 4 and other engines. Use it in your asset pipeline or work directly with RGBA pixels through the standalone core.

## Features

- **Atlas packing** — MaxRects, multiple pages, fixed sizes, power-of-two dimensions, and square atlases.
- **Sprite processing** — transparent trimming, deduplication, optional 90° rotation, and edge extrusion.
- **Export formats** — JSON Hash, JSON Array, Phaser 4, and custom metadata exporters through the SDK.
- **Build integration** — CLI, JSON configuration, dry runs, and machine-readable results.
- **TypeScript support** — type declarations and a core package with no Node.js or DOM dependencies.

## Quick start

Install the Node.js SDK:

```bash
npm install @spritetunk/node
```

Or install the CLI:

```bash
npm install --save-dev @spritetunk/cli
npx spritetunk pack "assets/**/*.png" --out-dir dist/atlas --format phaser4
```

Requires Node.js 22.18.0 or later. All packages are ESM.

## Usage

### CLI

Pack PNG files into a Phaser 4 atlas:

```bash
npx spritetunk pack "assets/**/*.png" \
  --out-dir dist/atlas \
  --name characters \
  --format phaser4
```

You can also use a JSON configuration file:

```json
{
  "inputs": ["assets/**/*.png"],
  "outDir": "dist/atlas",
  "format": "phaser4",
  "atlas": {
    "name": "characters",
    "maxWidth": 2048,
    "maxHeight": 2048,
    "trim": true,
    "extrude": 1
  }
}
```

Save it as `spritetunk.config.json` and run:

```bash
npx spritetunk pack --config spritetunk.config.json
```

Preview the output without writing files, or return a JSON report:

```bash
npx spritetunk pack --config spritetunk.config.json --dry-run
npx spritetunk pack --config spritetunk.config.json --json
```

Paths in a configuration file are relative to that file. Paths passed on the command line are relative to the current working directory. See the [configuration reference](docs/configuration.md) for all options.

### Node.js SDK

```ts
import { pack, writeOutput } from '@spritetunk/node';

const result = await pack({
  inputs: ['assets/**/*.png'],
  atlas: {
    name: 'characters',
    maxWidth: 2048,
    maxHeight: 2048,
  },
  format: 'phaser4',
});

await writeOutput(result.files, { directory: 'dist/atlas' });
```

`pack()` returns output files and statistics. `writeOutput()` writes those files to disk. You can also pass PNG bytes as `{ id, data: Uint8Array }`.

See [examples/node-basic.mjs](examples/node-basic.mjs) for a complete example.

### Phaser 4

Load the exported atlas with Phaser's `multiatlas` loader:

```js
// preload()
this.load.multiatlas('characters', 'dist/atlas/characters.json', 'dist/atlas/');

// create()
this.add.image(100, 100, 'characters', 'assets/hero.png');
```

Frame names preserve the input file's relative path and extension. Rotation must be disabled for Phaser 4 exports; see the limitations below.

## Packages

| Package            | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `@spritetunk/core` | RGBA processing, atlas packing, compositing, and metadata export |
| `@spritetunk/node` | Node.js SDK with image codecs and file I/O                       |
| `@spritetunk/cli`  | Command-line tool, available as `spritetunk`                     |

Use `@spritetunk/core` on its own when you need to work directly with RGBA data.

Phaser 4 is the primary target. The `phaser3` export remains available for compatibility.

## Limitations

- Static PNG input and PNG output.
- The core and generic JSON exporters support rotation. Phaser 4 exports reject it because testing with Phaser 4.2.1 showed incorrect rendering of rotated frames.
- No GUI, watch mode, scaling, or migration of upstream GUI project files yet.

Output files are tracked in a manifest. Unrelated files and manually edited files are not overwritten. See the [configuration reference](docs/configuration.md) for output behavior and resource limits.

## Documentation

- [Configuration and export formats](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Upstream sources](docs/upstream.md)
- [Validation](docs/validation.md)

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

Development requires Node.js `^22.22.2 || ^24.15.0 || ^26.0.0` and pnpm `10.34.7`. From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm example
```

The example generates sample sprites and writes the atlas to `examples/output/`.

## Acknowledgments

This project draws on [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core). Its MaxRects implementation is adapted from the upstream code in TypeScript; image-processing rules and export formats also reference that project. Product features are informed by [odrick/free-tex-packer](https://github.com/odrick/free-tex-packer). Thanks to the original author and contributors.

Adapted portions retain Copyright (c) 2018 Alexander Norinchak and the MIT license. See `THIRD_PARTY_NOTICES.md` and `LICENSES/` in each package.

## License

[MIT](LICENSE) © 2026 SpriteTunk contributors.

Attribution in your product documentation is appreciated, but is not an additional license requirement.
