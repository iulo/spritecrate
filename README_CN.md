# SpriteTunk

[English](README.md) | 简体中文

面向 JavaScript 项目的纹理图集打包工具，提供 SDK 和命令行支持。

将多张 PNG 合并为图集，生成可供 Phaser 4 等引擎读取的描述文件，适合接入游戏资源构建流程。

## 特性

- **图集排布**：MaxRects 算法，支持多页、固定尺寸、2 的幂尺寸和正方形约束。
- **素材处理**：透明裁边、重复图片合并、可选 90° 旋转和边缘像素扩展。
- **多种导出**：JSON Hash、JSON Array 和 Phaser 4；SDK 支持自定义描述文件导出。
- **构建集成**：命令行、JSON 配置、dry-run 和机器可读的执行结果。
- **TypeScript 支持**：完整类型声明，可单独使用不依赖 Node.js 或 DOM 的核心包。

## 快速开始

安装 Node.js SDK：

```bash
npm install @spritetunk/node
```

安装命令行工具：

```bash
npm install --save-dev @spritetunk/cli
npx spritetunk pack "assets/**/*.png" --out-dir dist/atlas --format phaser4
```

需要 Node.js 22.18.0 或更高版本，所有包均为 ESM。

## 使用

### 命令行

将指定目录中的 PNG 打包为 Phaser 4 图集：

```bash
npx spritetunk pack "assets/**/*.png" \
  --out-dir dist/atlas \
  --name characters \
  --format phaser4
```

也可以使用 JSON 配置文件：

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

保存为 `spritetunk.config.json` 后运行：

```bash
npx spritetunk pack --config spritetunk.config.json
```

预览产物而不写入文件，或获取 JSON 格式的执行结果：

```bash
npx spritetunk pack --config spritetunk.config.json --dry-run
npx spritetunk pack --config spritetunk.config.json --json
```

配置文件中的路径相对于配置文件所在目录；命令行中传入的路径相对于当前工作目录。更多选项见[配置文档](docs/configuration.md)。

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

`pack()` 返回产物内容和统计信息，`writeOutput()` 负责写入文件。也可以通过 `{ id, data: Uint8Array }` 直接传入 PNG 字节。

完整示例见 [examples/node-basic.mjs](examples/node-basic.mjs)。

### Phaser 4

使用 Phaser 4 的 `multiatlas` 加载器读取导出的图集：

```js
// preload()
this.load.multiatlas('characters', 'dist/atlas/characters.json', 'dist/atlas/');

// create()
this.add.image(100, 100, 'characters', 'assets/hero.png');
```

精灵名称保留输入文件的相对路径和扩展名。Phaser 4 导出要求关闭旋转，详见下方支持范围。

## 包

| 包                 | 用途                                        |
| ------------------ | ------------------------------------------- |
| `@spritetunk/core` | RGBA 像素处理、图集排布、合成和描述文件导出 |
| `@spritetunk/node` | Node.js SDK，提供图片编解码与文件读写       |
| `@spritetunk/cli`  | 命令行工具，命令名为 `spritetunk`           |

需要直接操作 RGBA 数据时，可单独安装 `@spritetunk/core`。

Phaser 4 是主要目标，保留 `phaser3` 导出选项用于兼容。

## 支持范围

- 当前支持静态 PNG 输入和 PNG 输出。
- 通用 core/JSON 支持旋转；Phaser 4 导出禁止旋转，因为 Phaser 4.2.1 的实测渲染存在采样错误。
- 暂不提供 GUI、watch、缩放或上游 GUI 工程文件迁移。

输出目录由清单跟踪，已有的无关文件或被手工修改过的同名文件不会被覆盖。详细行为和资源限制见[配置文档](docs/configuration.md)。

## 文档

- [配置与输出格式](docs/configuration.md)
- [架构设计](docs/architecture.md)
- [上游移植记录](docs/upstream.md)
- [验证记录](docs/validation.md)

## 参与开发

欢迎提交 Issue 和 Pull Request。开发环境、检查命令和贡献约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

开发环境需要 Node.js `^22.22.2 || ^24.15.0 || ^26.0.0` 和 pnpm `10.34.7`。在仓库根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm example
```

示例会生成测试素材，并在 `examples/output/` 输出图集。

## 致谢

本项目参考了 [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core)，其中 MaxRects 排布实现基于上游代码进行 TypeScript 改写；图片处理规则与导出格式也参考了该项目。产品功能设计参考了 [odrick/free-tex-packer](https://github.com/odrick/free-tex-packer)。感谢原作者及贡献者。

移植部分保留原作者 Copyright (c) 2018 Alexander Norinchak 及 MIT 条款，详见各包的 `THIRD_PARTY_NOTICES.md` 和 `LICENSES/`。

## 许可证

[MIT](LICENSE) © 2026 SpriteTunk contributors。

欢迎在使用工具的产品文档中注明 SpriteTunk；这是自愿请求，不构成额外许可条件。
