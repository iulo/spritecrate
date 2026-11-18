# 发布约定

三个包统一版本。Lerna 只管理版本和发布，pnpm 负责安装及 workspace 协议转换。

1. 确认 scope 归属、三个包名及个人署名。2026-11-18 registry 查询均为未发布，不代表 scope 已归本项目所有。
2. 在实际 Git 仓库运行 pnpm check、pnpm check:phaser，等待跨平台 CI 成功。
3. 在干净分支使用 pnpm version:packages，审阅版本、包间引用和 CHANGELOG，更新并提交锁文件。首期尚未生成 CHANGELOG。
4. 配置 npm scope 权限、包的 Trusted Publisher 和 GitHub npm environment 审批规则。首次发布是否支持 OIDC 需要按账号及 npm 实际状态确认；必要时由维护者完成首次引导发布。
5. 推送经过审阅的版本提交和 tag，在目标提交手动触发 Release workflow。workflow 重新验证后执行 Lerna from-package 发布。

当前 workflow 是待配置的发布入口，不表示账号、首次发布或 OIDC 已验证。本次实现没有发布 npm 包，也没有创建远程仓库或 tag。

随包发布 dist、LICENSE、LICENSES、THIRD_PARTY_NOTICES；CLI 额外发布 config.schema.json。发布产物不包含测试、示例或工具侧依赖。
