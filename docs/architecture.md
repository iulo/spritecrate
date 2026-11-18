# 架构与接口设计

状态：首期已实现；运行验证和已知限制见 [验证记录](validation.md)。项目名按现有目录使用 SpriteTunk，不自动更正为其他拼写。

## 目标与范围

首期为构建脚本及 CI 提供可靠的 Node.js SDK 和 CLI。业务目标是图集正确、行为明确、输出可复现、错误可定位。未来桌面 GUI 复用 Node SDK，Web GUI 复用纯 core。

此仓库是独立开发工具，不继承游戏仓库的 Phaser UI 或 YYRT 运行约束。Phaser 是首期导出格式的消费端，不是工具运行依赖。

不承诺旧 SDK 参数、回调或排布坐标完全兼容；通过来源记录和差异测试解释迁移行为。

## 目录与依赖

```text
packages/
  core/src/
    index.ts
    model.ts
    preprocess/
    packing/
    rendering/
    exporters/
  node/src/
    index.ts
    input.ts
    codec.ts
    output.ts
  cli/src/
    index.ts
    config.ts
    reporting.ts
examples/
fixtures/
benchmarks/
docs/
.github/workflows/
```

单向依赖：cli → node → core。各包只通过声明的公开出口交互，不跨包导入 src。

不预建 GUI 空包，不拆独立 types/utils 包，不设计通用插件生命周期。已有模块产生真实的独立消费需求后再拆包。

## 工具职责

| 工具           | 职责与约束                                                       |
| -------------- | ---------------------------------------------------------------- |
| pnpm           | Workspace、安装、锁文件、递归任务；包间使用 workspace 协议       |
| Lerna          | 首期统一版本、版本变更和发布；不管理依赖安装                     |
| TypeScript 7   | 类型检查；strict、noUncheckedIndexedAccess、isolatedDeclarations |
| tsdown         | JavaScript、声明文件、sourcemap；声明生成不替代类型检查          |
| Oxlint / Oxfmt | 规则与格式；类型感知规则经过兼容验证后开启                       |
| Vitest         | 单元、性质、像素、集成、消费测试                                 |
| GitHub Actions | 平台矩阵、检查、打包、受控发布                                   |
| publint / attw | npm exports 和类型消费验证                                       |

采用 ESM，避免首期双格式维护。core 的类型环境不包含 Node 或 DOM，数据使用 Uint8Array 等标准类型。原生依赖保持 external，不打进库文件。最低 Node 版本在 M0 根据工具链与图片库实际要求确定。

## 数据流程

Node 输入解析 → 解码 → core 校验 RGBA → 预处理 → 去重 → 排布/分页 → 合成 → 标准图集模型 → 描述文件导出 → Node 编码 → 显式写盘。

core 不访问文件系统、网络、DOM，不打印日志。内部保留几何排布与像素合成的独立模块，但不为其全部创建公开入口。

Node 图片编解码优先验证 Sharp；只放在 node 包。验证跨平台安装、RGBA 与透明通道行为后再确定。首期不同时维护两套后端。

## 公开接口草案

Node SDK 的主要接口：

```ts
import { pack, writeOutput } from '@spritetunk/node';

const result = await pack({
  inputs: ['assets/**/*.png'],
  atlas: {
    name: 'characters',
    maxWidth: 2048,
    maxHeight: 2048,
    trim: true,
    rotate: false,
    extrude: 1,
  },
  format: 'phaser3',
});

await writeOutput(result.files, { directory: 'dist/atlas' });
```

`pack` 返回 files、report、warnings；files 为相对文件名及 Uint8Array 内容。输入解析可读盘，pack 不写盘。纯 core 接受具备 id、width、height、RGBA pixels 的素材，返回图集模型与 RGBA 页；不负责 PNG 编码。

错误携带稳定 code、素材 id 和相关尺寸。结果使用普通数据，便于 GUI 消费；耗时只进入 report，不进入图集元数据。

首期支持自定义描述文件导出函数；不执行字符串模板或第三方插件。Node 的 pack 同时覆盖文件输入和具名图片字节输入，避免调用方必须落盘。

## 图集约定

- 原点为左上角，坐标和尺寸为整数；使用半开矩形语义。
- 区分源尺寸、裁边区域、逻辑尺寸、旋转后的图集矩形和实际分配区域。
- 精灵 frame 不包含 extrude 和间距；间距定义为两块扩展后区域之间的最小空隙，画布边距独立设置。
- 自动尺寸受 maxWidth/maxHeight 限制；固定尺寸、POT、正方形约束必须同时校验，不静默突破上限。
- 默认关闭旋转；开启时只旋转 90°，明确方向并按导出器规范转换。
- 去重在预处理后进行，哈希命中后比较像素；别名保留各自裁边及源尺寸元数据。
- 全透明素材以受控的透明占位参与排布，保留原尺寸并记录裁边信息，不直接丢弃。
- 明确 alphaThreshold 的比较规则；超大、损坏、重复 id、无匹配输入均产生可定位结果或错误。
- 内部多页模型统一；每个导出器独立规定文件组织及引用，Phaser 必须以真实加载验证。

## 确定性与资源限制

素材 id 统一相对路径和斜线，禁止绝对路径泄漏。排序使用明确的字符序，不依赖系统 locale；算法同分时固定决胜规则。默认元数据不写时间戳。

固定输入、配置、工具与编码依赖版本后，保证稳定排布并验证产物复现。跨平台先验证解码像素和语义；不提前承诺不同原生编码环境下 PNG 字节完全相同。

图片解码及合成设置像素、尺寸和并发限制；限制值在基准测试后文档化。首期不做无限并发、不预建 Worker 池。

## CLI 与配置

首期命令：pack、--config、--out-dir、--name、--format、--dry-run、--json、--help、--version。

配置为 JSON + JSON Schema；不执行 JS/TS 配置。SDK 与 CLI 共用配置语义和默认值。CLI 显式参数覆盖配置；配置路径相对于配置文件，命令行路径相对于 cwd。

--json 保持 stdout 为机器可读结果，诊断写 stderr；区分配置、素材及执行错误退出码。dry-run 完成校验和处理，但不写输出目录。

先计算全部产物，再在临时区域准备输出并替换。多文件替换不宣称具备文件系统事务原子性；失败要给出明确诊断。仅清理本工具 manifest 记录的旧文件，校验所有输出路径不越过目标目录。

## 未来 GUI

桌面端消费 node，Web 端未来添加浏览器编解码实现并消费 core。GUI 只管理项目、操作和预览，不复制图集规则。未来项目配置需要 schemaVersion 与迁移策略，但首期不承诺读取上游 GUI 工程文件。

## 来源

- https://github.com/odrick/free-tex-packer
- https://github.com/odrick/free-tex-packer-core
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- https://tsdown.dev/options/dts
- https://lerna.js.org/docs/recipes/using-pnpm-with-lerna
- https://sharp.pixelplumbing.com/install/

## 实测后的约束

Phaser 3.90.0 实际 WebGL 消费测试发现旋转帧采样错误，因此 Phaser 3 导出拒绝旋转；通用 core 和 JSON 导出继续支持旋转。类型和浏览器验证均不代表 YYRT 游戏运行时设备验证。
