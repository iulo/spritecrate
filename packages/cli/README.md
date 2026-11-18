# @spritetunk/cli

Pack PNG sprites into texture atlases and JSON metadata from the command line.

```bash
npm install --save-dev @spritetunk/cli
npx spritetunk pack "assets/**/*.png" --out-dir dist/atlas --format phaser4
```

```bash
npx spritetunk pack --config spritetunk.config.json
npx spritetunk pack --config spritetunk.config.json --dry-run --json
npx spritetunk --help
```

JSON configuration supports Schema completion. See the configuration reference for paths and export formats.

## Documentation

- [Project README](https://github.com/iulo/spritetunk#readme)
- [简体中文](https://github.com/iulo/spritetunk/blob/main/README_CN.md)
- [Configuration](https://github.com/iulo/spritetunk/blob/main/docs/configuration.md)

Based in part on [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core). Adapted portions retain the original attribution; see THIRD_PARTY_NOTICES.md and LICENSES.

## License

MIT © SpriteTunk contributors.
