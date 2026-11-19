# @spritecrate/node

The SpriteCrate Node.js SDK, with PNG codecs and explicit file output.

```bash
npm install @spritecrate/node
```

```ts
import { pack, writeOutput } from '@spritecrate/node';

const result = await pack({
  inputs: ['assets/**/*.png'],
  atlas: { name: 'characters' },
  format: 'phaser4',
});
await writeOutput(result.files, { directory: 'dist/atlas' });
```

Accepts file globs or named PNG bytes. Phaser 4 is the primary target; Phaser exports require rotation to be disabled.

## Documentation

- [Project README](https://github.com/iulo/spritecrate#readme)
- [简体中文](https://github.com/iulo/spritecrate/blob/main/README_CN.md)
- [Configuration](https://github.com/iulo/spritecrate/blob/main/docs/configuration.md)

Based in part on [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core). Adapted portions retain the original attribution; see THIRD_PARTY_NOTICES.md and LICENSES.

## License

MIT © 2026 [iulo](https://github.com/iulo).

## Export targets

Built-in formats: `phaser4` (primary), `phaser3`, `pixijs`, `cocos2d`, `json-hash`, and `json-array`. Phaser and PixiJS have WebGL rendering checks; Cocos plist has metadata/pixel reconstruction tests, with editor/runtime validation pending. See the [framework guide](https://github.com/iulo/spritecrate/blob/main/docs/frameworks.md).
