# @spritetuck/cli

Pack PNG sprites into texture atlases and JSON metadata from the command line.

```bash
npm install --save-dev @spritetuck/cli
npx spritetuck pack "assets/**/*.png" --out-dir dist/atlas --format phaser4
```

```bash
npx spritetuck pack --config spritetuck.config.json
npx spritetuck pack --config spritetuck.config.json --dry-run --json
npx spritetuck --help
```

JSON configuration supports Schema completion. See the configuration reference for paths and export formats.

## Documentation

- [Project README](https://github.com/iulo/spritetuck#readme)
- [简体中文](https://github.com/iulo/spritetuck/blob/main/README_CN.md)
- [Configuration](https://github.com/iulo/spritetuck/blob/main/docs/configuration.md)

Based in part on [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core). Adapted portions retain the original attribution; see THIRD_PARTY_NOTICES.md and LICENSES.

## License

MIT © SpriteTuck contributors.

## Export targets

Built-in formats: `phaser4` (primary), `phaser3`, `pixijs`, `cocos2d`, `json-hash`, and `json-array`. Phaser and PixiJS have WebGL rendering checks; Cocos plist has metadata/pixel reconstruction tests, with editor/runtime validation pending. See the [framework guide](https://github.com/iulo/spritetuck/blob/main/docs/frameworks.md).
