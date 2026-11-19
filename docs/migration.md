# SpriteTunk → SpriteTuck

The project is now named **SpriteTuck**. Version 0.1.3 continues the existing version sequence under the new npm scope. Previously published packages remain available under their original names.

| Before                       | After                        |
| ---------------------------- | ---------------------------- |
| `@spritetunk/core`           | `@spritetuck/core`           |
| `@spritetunk/node`           | `@spritetuck/node`           |
| `@spritetunk/cli`            | `@spritetuck/cli`            |
| `spritetunk pack`            | `spritetuck pack`            |
| `github.com/iulo/spritetunk` | `github.com/iulo/spritetuck` |

Replace installed packages, update import specifiers and package scripts, then regenerate your lockfile. SDK function signatures and exporter format names are unchanged. Explicitly passed JSON configuration files can keep their existing filenames.

For example, migrate the Node.js SDK:

```sh
npm uninstall @spritetunk/node
npm install --save-dev @spritetuck/node@0.1.3
```

For the CLI:

```sh
npm uninstall @spritetunk/cli
npm install --save-dev @spritetuck/cli@0.1.3
npx spritetuck pack --config spritetunk.config.json
```

Version 0.1.3 also includes improved MaxRects packing and automatic canvas-size search. Repacking may change coordinates and PNG dimensions; regenerate PNGs and descriptors together. Use `atlas.packMode: 'fast'` to retain the previous single-pass layout strategy.

`writeOutput()` automatically migrates `.spritetunk-manifest.json` to `.spritetuck-manifest.json` after verifying file hashes. It preserves unrelated files and refuses to overwrite edited outputs. Writers coordinate through both old and new lock names during migration. Do not alternate old and new SDKs against the same output directory after migration: the old SDK cannot read the new manifest. If both manifest versions are present, inspect the directory before continuing.

GitHub redirects the old repository URL. Update local clones with:

```sh
git remote set-url origin https://github.com/iulo/spritetuck.git
```

## 中文说明

项目由 SpriteTunk 更名为 **SpriteTuck**。三个 npm 包改用 `@spritetuck` scope，命令改为 `spritetuck`，版本沿用到 0.1.3。旧包继续保留；更新依赖、import、脚本及锁文件即可，SDK 接口和导出格式名称不变。通过 `--config` 显式指定的配置文件可以保留原文件名。

本版本同时包含排布优化，重新打包时应一起更新 PNG 和描述文件；需要此前单次排布策略时设置 `atlas.packMode: 'fast'`。输出归属清单会在校验文件哈希后自动迁移，已手动编辑或不属于工具的文件仍受保护。迁移后不要对同一输出目录交替使用新旧 SDK；两个版本的清单同时存在时，需要先检查目录。
