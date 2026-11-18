# @spritetunk/core

Platform-independent RGBA processing, MaxRects packing, compositing, and atlas metadata export. No Node.js, DOM, or image codec dependencies.

```bash
npm install @spritetunk/core
```

```ts
import { pack, exportAtlas } from '@spritetunk/core';

const result = pack({
  sprites: [{ id: 'pixel', width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) }],
});
const descriptions = exportAtlas(result.pages, 'phaser4');
```

Pages contain raw RGBA bytes. Use @spritetunk/node for PNG codecs and file input.

## Documentation

- [Project README](https://github.com/iulo/spritetunk#readme)
- [简体中文](https://github.com/iulo/spritetunk/blob/main/README_CN.md)
- [Configuration](https://github.com/iulo/spritetunk/blob/main/docs/configuration.md)

Based in part on [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core). Adapted portions retain the original attribution; see THIRD_PARTY_NOTICES.md and LICENSES.

## License

MIT © SpriteTunk contributors.
