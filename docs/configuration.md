# 配置与行为

## CLI

```bash
npx @spritecrate/cli pack 'assets/**/*.png' --out-dir dist/atlas --name game --format phaser4
npx @spritecrate/cli pack --config spritecrate.config.json --json
npx @spritecrate/cli pack --config spritecrate.config.json --dry-run
```

JSON 配置示例：

```json
{
  "$schema": "./node_modules/@spritecrate/cli/config.schema.json",
  "inputs": ["assets/**/*.png"],
  "outDir": "dist/atlas",
  "format": "phaser4",
  "atlas": {
    "name": "game",
    "maxWidth": 2048,
    "maxHeight": 2048,
    "trim": true,
    "rotate": false,
    "extrude": 1,
    "padding": 2
  }
}
```

显式命令行参数覆盖配置。配置中的 inputs/outDir 相对于配置文件；命令行输入和 --out-dir 相对于 cwd。glob 建议加引号。输入保留相对目录和文件扩展名作为 frame id，重叠 glob 的同一文件只加载一次。

首期不执行 JS/TS 配置。--dry-run 执行完整处理但不写文件；--json 的 stdout 为单个 JSON 对象，错误诊断写 stderr。

退出码：0 成功；2 配置/参数错误；3 输入、解码、尺寸或资源限制错误；1 输出或未预期执行错误。

## Atlas 选项

| 字段               | 默认值    | 语义                                              |
| ------------------ | --------- | ------------------------------------------------- |
| name               | atlas     | 可跨平台使用的 ASCII 文件名主体，不含路径         |
| maxWidth/maxHeight | 2048/2048 | 每页上限；整数 1–8192                             |
| packMode           | best      | best 多策略及尺寸搜索；fast 使用旧版单次 BSSF     |
| fixedSize          | false     | 固定为上限尺寸                                    |
| powerOfTwo         | false     | 两个维度分别为 2 的幂，上限向下取可用幂           |
| square             | false     | 正方形；可用最大边取两个上限的较小值              |
| trim               | true      | 以 alpha 严格大于阈值的像素求裁边框               |
| alphaThreshold     | 0         | 0–255；不改变裁边框内部像素，框外被丢弃           |
| rotate             | false     | 允许将精灵顺时针旋转 90°                          |
| deduplicate        | true      | 预处理后按尺寸及完整 RGBA 去重，保留别名          |
| extrude            | 1         | 向外复制边缘和角像素，不计入 frame                |
| padding            | 2         | 两块 extrude 后区域之间的最小空隙，无尾部强制间距 |
| border             | 0         | 图集内容与画布四边的最小留白                      |

fixedSize + square 要求两个上限相等；fixedSize + powerOfTwo 要求固定尺寸本身为幂。不能容纳的精灵抛 IMAGE_TOO_LARGE，不会丢失。

完全透明素材采用 1×1 透明占位，保留源尺寸。裁边关闭时不进行此收缩。预处理不修改输入数据。

## 排布质量

默认 `packMode=best`；也可显式选择 `fast`。best 包含短边、长边、面积、Bottom Left 和 Contact Point 五种 MaxRects 策略，并在非固定尺寸时搜索候选宽高。保留 fast 基线，不接受页数或总面积比有效基线更大的候选结果；候选之间优先减少页数，再减少总面积。同分时保留先找到的方案。

fixedSize=true 时只选择放置策略，不搜索其他尺寸；POT 和正方形约束也参与搜索及结果比较。先选几何排布，再合成像素，不为每次候选尝试编码 PNG。

best 使用确定的候选评分工作量预算；数量较多时可能耗尽预算并退回基线，不能将它理解为穷举或数学最优。fast 的坐标与旧版一致。详见 [Packing](packing.md)。

## 模型与导出

core 的 frame 使用实际图集矩形宽高；rotated=true 时物理宽高交换。spriteSourceSize 描述未旋转裁边区域，sourceSize 描述原图。

JSON Hash、JSON Array 导出遵循 TexturePacker 的逻辑宽高约定：rotated=true 时描述中的 frame.w/h 为未旋转宽高。需要据 rotated 交换，才能获得物理采样范围。

Phaser 4 导出不允许旋转。已在 Phaser 4.2.1 的真实 WebGL 渲染中验证：旋转元数据能被加载，但采样像素不正确。因此 SDK 对 format=phaser4 + rotate=true 明确报 INVALID_OPTIONS；core 导出器也拒绝包含已旋转帧的 Phaser 输出。不要通过通用 JSON 格式绕过此限制后加载到 Phaser。

单页 PNG 使用 name.png，多页使用 name-0.png、name-1.png。JSON Hash/Array 每页一个同名 JSON；Phaser 4 为一个 name.json，textures 中引用所有页，使用 this.load.multiatlas 加载。

SDK format 还可传入 `(pages, name) => OutputFile[]` 自定义描述文件导出函数。CLI 接受 json-hash、json-array、phaser4、phaser3、pixijs、cocos2d 六个内置格式。自定义输出文件必须是平铺的安全文件名，不能含目录。

## PixiJS 与 Cocos

`format=pixijs` 输出每页 JSON Hash，额外通过 meta.related_multi_packs 关联其他页。单页加载 name.json，多页加载 name-0.json；精灵分布在主 sheet 与 linkedSheets 的 textures 中。支持 rotate=true，已通过 PixiJS 8.23.0 WebGL 逐像素验证。

`format=cocos2d` 每页输出同名 PNG + plist，使用 Cocos2d-x plist 格式 3。包含原图尺寸、裁边中心偏移、纹理位置、未旋转逻辑宽高及旋转标记。支持多页与旋转，已通过独立 plist 解析和像素还原测试；Cocos Creator 编辑器导入和运行时渲染待实测。XML 1.0 不能表示的 frame id 会报 INVALID_INPUT。

集成示例和验证范围见 [Framework integration](frameworks.md)。

## 输出所有权

writeOutput 使用锁、暂存文件、备份及 manifest。它拒绝覆盖非本工具管理或被用户编辑过的目标文件。只删除上一轮 manifest 记录且哈希仍匹配的旧文件，保留无关文件和编辑过的旧产物。

拒绝路径穿越、符号链接目标及大小写冲突。多文件替换不是文件系统事务；异常时尝试回滚，失败时保留备份目录并明确报错。不要在另一个进程仍在运行时手动删除锁文件。

## 限制与兼容

- 仅静态 PNG 输入和 PNG 输出，统一为直通 alpha 的 sRGB RGBA。
- 每个输入或输出页最多 16,777,216 像素；输入总像素和输出总像素分别最多 67,108,864；每次最多 10,000 个精灵。
- 图片解码和编码顺序执行，尚无 watch、增量缓存、Worker 池和缩放。
- 固定输入、配置和版本环境下排布及输出稳定；不保证不同原生编码器环境下 PNG 字节一致。
- 不读取上游 GUI 工程，不承诺旧 SDK 配置或布局逐字节兼容。
- ESM-only；CommonJS 调用方可使用动态 import。

## Phaser 版本

Phaser 4 是主要目标，使用 format=phaser4。保留 phaser3 作为兼容入口；当前两者都使用 multiatlas 描述结构，且都禁止旋转。
