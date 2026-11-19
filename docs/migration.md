# SpriteTunk → SpriteCrate

The project is now named **SpriteCrate**. Version 0.1.3 continues the existing version sequence under the new npm scope. All versions of the original `@spritetunk/core`, `@spritetunk/node`, and `@spritetunk/cli` packages were unpublished on 2026-11-19. Update dependencies and lockfiles to the new scope before reinstalling. The interim SpriteTuck and SpriteStow names were not released to npm.

| Before                       | After                         |
| ---------------------------- | ----------------------------- |
| `@spritetunk/core`           | `@spritecrate/core`           |
| `@spritetunk/node`           | `@spritecrate/node`           |
| `@spritetunk/cli`            | `@spritecrate/cli`            |
| `spritetunk pack`            | `spritecrate pack`            |
| `github.com/iulo/spritetunk` | `github.com/iulo/spritecrate` |

Replace installed packages, update import specifiers and package scripts, then regenerate your lockfile. SDK function signatures and exporter format names are unchanged. Explicitly passed JSON configuration files can keep their existing filenames.

For example, migrate the Node.js SDK:

```sh
npm uninstall @spritetunk/node
npm install --save-dev @spritecrate/node@0.1.3
```

For the CLI:

```sh
npm uninstall @spritetunk/cli
npm install --save-dev @spritecrate/cli@0.1.3
npx spritecrate pack --config spritetunk.config.json
```

Version 0.1.3 also includes improved MaxRects packing and automatic canvas-size search. Repacking may change coordinates and PNG dimensions; regenerate PNGs and descriptors together. Use `atlas.packMode: 'fast'` to retain the previous single-pass layout strategy.

`writeOutput()` automatically migrates `.spritetunk-manifest.json` or an interim `.spritetuck-manifest.json` / `.spritestow-manifest.json` to `.spritecrate-manifest.json` after verifying file hashes. It preserves unrelated files and refuses to overwrite edited outputs. Writers coordinate through the current and legacy lock names during migration. Do not alternate old and new SDKs against the same output directory after migration: the old SDK cannot read the new manifest. If multiple manifest versions are present, inspect the directory before continuing.

GitHub redirects the old repository URL. Update local clones with:

```sh
git remote set-url origin https://github.com/iulo/spritecrate.git
```

## 中文说明

项目由 SpriteTunk 更名为 **SpriteCrate**。三个 npm 包改用 `@spritecrate` scope，命令改为 `spritecrate`，版本沿用到 0.1.3。旧 scope 的三个包已于 2026-11-19 撤销全部版本，重新安装前需要更新依赖和锁文件；同时更新 import 和脚本。SDK 接口和导出格式名称不变。通过 `--config` 显式指定的配置文件可以保留原文件名。

此前短暂使用的 SpriteTuck、SpriteStow 名称没有发布到 npm；本地开发生成的对应输出清单也支持迁移。

本版本同时包含排布优化，重新打包时应一起更新 PNG 和描述文件；需要此前单次排布策略时设置 `atlas.packMode: 'fast'`。输出归属清单会在校验文件哈希后自动迁移，已手动编辑或不属于工具的文件仍受保护。迁移后不要对同一输出目录交替使用新旧 SDK；两个版本的清单同时存在时，需要先检查目录。
