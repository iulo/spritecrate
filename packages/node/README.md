# @spritetunk/node

The SpriteTunk Node.js SDK, with PNG codecs and explicit file output.

```bash
npm install @spritetunk/node
```

```ts
import { pack, writeOutput } from '@spritetunk/node';

const result = await pack({
  inputs: ['assets/**/*.png'],
  atlas: { name: 'characters' },
  format: 'phaser4',
});
await writeOutput(result.files, { directory: 'dist/atlas' });
```

Accepts file globs or named PNG bytes. Phaser 4 is the primary target; Phaser exports require rotation to be disabled.

## Documentation

- [Project README](https://github.com/iulo/spritetunk#readme)
- [简体中文](https://github.com/iulo/spritetunk/blob/main/README_CN.md)
- [Configuration](https://github.com/iulo/spritetunk/blob/main/docs/configuration.md)

Based in part on [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core). Adapted portions retain the original attribution; see THIRD_PARTY_NOTICES.md and LICENSES.

## License

MIT © SpriteTunk contributors.
