# 验证记录

初始验证日期：2026-11-18。环境：macOS / Apple M4 / arm64 / Node v26.13.1 / pnpm 10.34.7。

本文件按阶段保留当时的验证结果。版本号和用例数对应各节记录的阶段；当前发布状态见文末的更名与发布记录。

## 已执行

- 三包 tsdown 构建与 TypeScript 7.0.2 类型检查通过。
- Oxlint 与 Oxfmt 检查通过。
- 68 项 Vitest 用例通过：像素还原、裁边、透明占位、顺时针旋转、去重、extrude、间距、尺寸约束、分页、错误、CLI 和输出保护。
- 排布性质用例内部执行 20 组固定种子的矩形集，每组 30 个素材；检查每帧还原、无越界、无重叠及间距。
- 三包 publint / attw 的 ESM 消费检查通过；tarball 携带许可证和第三方声明。
- 独立临时项目安装三个 tarball，SDK 运行、TS7 声明消费和 CLI bin 执行通过；测试不通过源码 alias 绕过包出口。
- Node 示例可生成 PNG + Phaser 描述文件。
- Phaser 3.90.0 + Chromium 159.0.8154.6 的真实 WebGL multiatlas 加载、不同页引用、透明裁边偏移及渲染逐像素对比通过。
- 10/100/500 张自生成素材的纯 core 基线已记录到 benchmark-baseline.json。它不包含 PNG 编解码或 CLI 启动时间，峰值内存为进程累计高水位。

## Phaser 旋转调查

最初测试采用 12×3 视口，奇数高度在 pixelArt 配置下出现一像素偏移。改为 64×64 视口后，无旋转对照逐像素一致，旋转版本仍存在错误采样；例如第一像素预期 [40,0,80,255]，实际 [45,0,80,255]。

源码核查与实测基于锁定的 phaser@3.90.0。为保证交付结果，Phaser 导出禁止旋转配置，core 导出器也拒绝已旋转的页面；通用 core/JSON 仍保留旋转能力，并有独立像素还原测试。

## CI

- GitHub Actions 的 Linux/macOS/Windows × Node 22.22.2/24.15.0/26 已全部通过，另有 Phaser 浏览器验证。见 [CI](https://github.com/iulo/spritecrate/actions/runs/44269183130)。
- 旧 scope `@spritetunk/*` 的三包 0.1.1 当时已通过 GitHub OIDC 发布，公共安装也已通过；见 [Release](https://github.com/iulo/spritecrate/actions/runs/44271944279)。这不代表新 scope `@spritecrate/*` 已完成实发验证。

首次 Windows 检查因 CRLF 失败，已通过 .gitattributes 修复；第二轮全部通过。

## 尚未覆盖

- 原生 Sharp 跨平台编码的 PNG 字节一致性不作保证。
- 文件系统中断、断电、恶意并发替换和回滚本身失败等故障未全部注入测试；writeOutput 不提供多文件事务保证。
- 尚未进行上游全功能差异测试或超大素材压力测试。后续的真实业务素材验证范围见排布优化记录，不代表所有业务素材和规模均已覆盖。
- 没有 GUI 或 YYRT 设备验证；这是开发工具，不宣称游戏运行时兼容性。

## 阶段结果

M0 工具链/来源基线、M1 工程、M2 最小闭环已完成本机验证。M3 功能已实现，Phaser 旋转限制按实测收敛。M4 的本机包质量、示例和跨平台 CI 已完成。旧 scope 三包当时已发布并验证可信发布；新 scope 的发布状态单独记录如下。

## Phaser 4 验证

已验证 Phaser 4.2.1 和 3.90.0：单页、多页、裁边偏移、逐像素还原。4.2.1 的旋转探针出现 30 个不符像素，因此 phaser4 导出也禁止旋转。正式示例、SDK/CLI 文档与默认测试引擎已改为 Phaser 4。

## PixiJS 与 Cocos 导出验证

- PixiJS 8.23.0：Chromium WebGL 单页、多页关联自动加载、透明裁边、extrude、强制顺时针旋转均逐像素一致（0 差异）。命令：pnpm check:pixi；CI 浏览器任务已纳入该检查。
- Cocos：plist 格式 3 使用独立 plist 解析器，依据 Cocos2d-x 3.17.2 的字段约定还原原始像素；覆盖不对称裁边、半像素中心偏移、旋转、去重、透明占位、Unicode/XML 字符和多页纹理引用。
- Cocos Creator 编辑器导入、Cocos 原生渲染与设备行为尚未验证。PixiJS 的 WebGPU 及旧版本尚未验证。

## 排布优化验证（2026-11-19）

- 默认 best 增加五种 MaxRects 策略、有预算的画布尺寸搜索和局部细化；fast 保留单次 BSSF。候选只比较几何，最终仅合成一次像素。
- 87 项测试通过：新增真实动画矩形尺寸/别名的合成像素回归，以及固定尺寸、POT、正方形、分页、边距/间距、旋转、确定性、工作预算和 CLI 模式配置。
- pnpm check 通过，包括构建、类型检查、Lint、格式、包质量和独立 tarball 消费验证。
- 四套动画原始 PNG 共 100 帧逐像素还原通过。原始图片不进入本仓库，只保留矩形尺寸和别名关系作为回归数据；fast 在本机的 PNG/JSON 产物与已安装的 npm 0.1.2 字节一致。
- Phaser 4.2.1 WebGL 将全部 100 帧优化图集与原 PNG 并排绘制并读回像素，0 差异；同时检查非空源帧实际绘制，防止空白截图误通过。
- Phaser 4.2.1 / 3.90.0 单页、多页及旋转负向探针通过；PixiJS 8.23.0 单页、多页、旋转检查通过。
- 动画案例总面积 6,748,728 → 5,948,185 像素，减少 11.86%；基础 RGBA 预算 25.74 → 22.69 MiB。该数值不包含 mipmap/驱动开销，不是设备显存实测。
- 此阶段完成时尚未发布 npm 或替换游戏正式资源；后续已随 0.1.3 发布并接入游戏，见下节。新布局仍未执行 YYRT 设备验证。性能对比见 [Packing](packing.md) 和 [基准记录](benchmark-packing.json)。

## 更名、撤包与 0.1.3 发布（2026-11-19）

- 项目、GitHub 仓库、三个 npm 包、CLI 及文档统一为 SpriteCrate / `@spritecrate/*` / `spritecrate`。旧名称只在迁移说明、兼容代码和相应回归中保留。
- 三个新包 0.1.3 通过维护者登录完成首次引导发布；没有 GitHub OIDC provenance。可信发布配置已绑定 `iulo/spritecrate`、`release.yml` 和 `npm` 环境，仅允许 main 部署。
- [Release 检查](https://github.com/iulo/spritecrate/actions/runs/44488018505) 通过，但 Lerna 明确报告没有未发布版本，因此没有执行新 scope 的实际发布；不能以该次成功状态代替 OIDC 实发验证。
- 104 项测试、本机完整检查和 [Linux/macOS/Windows 跨平台 CI](https://github.com/iulo/spritecrate/actions/runs/44489861662) 通过。公开 npm 的独立项目安装、SDK 运行、TypeScript 声明和 CLI 打包检查通过。
- 旧 scope 三个包的全部版本已按维护者决定撤销，组织保留；撤销后再次确认新三包可下载、安装并执行。迁移要求见 [迁移文档](migration.md)。
- `npx @spritecrate/cli pack ...` 已在空目录、独立 npm 缓存、未安装本地 CLI 的条件下实际执行通过。GitHub 文档已修正；npm 页面随下一版本发布更新。
- 游戏已通过公开包接入 0.1.3，并重新生成四组图集；64 项游戏测试、100 帧像素还原、浏览器回归和 YYRT 包结构/脚本/资源检查通过。游戏远端已包含该接入提交。未进行新布局的 YYRT 设备验证。

## 0.1.4 发布验证

- 本次统一根目录和三个包的版权署名为 `iulo`，补齐 author 元数据；上游 Alexander Norinchak 的版权和 MIT 条款继续保留。
- 三个包包含修正后的 scoped CLI 文档。打包逻辑与 0.1.3 相同。
- 本机 `pnpm check` 通过：107 项测试、构建、类型、Lint、格式、包内容和独立 tarball 消费均通过。Phaser 4/3 与 PixiJS 的浏览器像素对比通过；Phaser 旋转负向探针保持预期差异。
- 前两次实际发布在 Sigstore 创建透明日志条目时出现 409，Rekor 中可查询到对应条目，registry 尚无 0.1.4。已对发布依赖增加冲突回读，并在生成 attestation 后完整验证 bundle；3 项回归覆盖带位置的 409、无位置的 409 和服务器错误。
- 本版本将通过修复后的 GitHub Actions 实际发布；完成后记录 Release、公开安装和 provenance 核验结果。
