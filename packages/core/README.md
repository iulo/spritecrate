# @spritecrate/core

Platform-independent RGBA processing, MaxRects packing, compositing, and atlas metadata export. No Node.js, DOM, or image codec dependencies.

```bash
npm install @spritecrate/core
```

```ts
import { pack, exportAtlas } from '@spritecrate/core';

const result = pack({
  sprites: [{ id: 'pixel', width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) }],
});
const descriptions = exportAtlas(result.pages, 'phaser4');
```

Pages contain raw RGBA bytes. Use @spritecrate/node for PNG codecs and file input.

## Documentation

- [Project README](https://github.com/iulo/spritecrate#readme)
- [简体中文](https://github.com/iulo/spritecrate/blob/main/README_CN.md)
- [Configuration](https://github.com/iulo/spritecrate/blob/main/docs/configuration.md)

Based in part on [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core). Adapted portions retain the original attribution; see THIRD_PARTY_NOTICES.md and LICENSES.

## License

MIT © SpriteCrate contributors.

## Export targets

Built-in formats: `phaser4` (primary), `phaser3`, `pixijs`, `cocos2d`, `json-hash`, and `json-array`. Phaser and PixiJS have WebGL rendering checks; Cocos plist has metadata/pixel reconstruction tests, with editor/runtime validation pending. See the [framework guide](https://github.com/iulo/spritecrate/blob/main/docs/frameworks.md).
