# 验证记录

日期：2026-11-18。环境：macOS / Apple M4 / arm64 / Node v26.13.1 / pnpm 10.34.7。

## 已执行

- 三包 tsdown 构建与 TypeScript 7.0.2 类型检查通过。
- Oxlint 与 Oxfmt 检查通过。
- 57 项 Vitest 用例通过：像素还原、裁边、透明占位、顺时针旋转、去重、extrude、间距、尺寸约束、分页、错误、CLI 和输出保护。
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

首次 Windows 检查因 CRLF 失败，已通过 .gitattributes 修复；第二轮全部通过。

## 尚未覆盖

- GitHub Actions 的 Linux/macOS/Windows × Node 22.22.2/24.15.0/26 已全部通过，另有 Phaser 浏览器验证。见 [CI](https://github.com/iulo/spritetunk/actions/runs/44269183130)。
- 原生 Sharp 跨平台编码的 PNG 字节一致性不作保证。
- 文件系统中断、断电、恶意并发替换和回滚本身失败等故障未全部注入测试；writeOutput 不提供多文件事务保证。
- 尚未进行上游全功能差异测试、超大素材压力测试和真实业务素材基准。
- 三包 0.1.0 已发布，三项 Trusted Publishing 已配置；CI 的实际写入尚未验证。
- 没有 GUI 或 YYRT 设备验证；这是开发工具，不宣称游戏运行时兼容性。

## 阶段结果

M0 工具链/来源基线、M1 工程、M2 最小闭环已完成本机验证。M3 功能已实现，Phaser 旋转限制按实测收敛。M4 的本机包质量、示例和跨平台 CI 已完成。npm 三包已发布；可信发布仍需实际写入验证。
