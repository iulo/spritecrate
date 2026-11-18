# @spritetunk/cli

SpriteTunk 命令行工具，将 PNG 素材打包为图集及 JSON 描述文件。

```bash
npm install --save-dev @spritetunk/cli
npx spritetunk pack "assets/**/*.png" --out-dir dist/atlas --format phaser3
```

```bash
npx spritetunk pack --config spritetunk.config.json
npx spritetunk pack --config spritetunk.config.json --dry-run --json
npx spritetunk --help
```

配置采用 JSON，支持 Schema 补全；文件路径与输出格式详见配置文档。

## 文档与来源

- [项目文档](https://github.com/iulo/spritetunk#readme)
- [配置参考](https://github.com/iulo/spritetunk/blob/main/docs/configuration.md)

参考 [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core)，移植部分保留原作者声明，详见 THIRD_PARTY_NOTICES.md 和 LICENSES。

## License

MIT © SpriteTunk contributors.
