# 参与开发

开发环境：Node `^22.22.2 || ^24.15.0 || ^26.0.0`、pnpm 10.34.7。

```bash
pnpm install --frozen-lockfile
pnpm check
```

首次没有锁文件的初始化工作已经完成，后续不要手工编辑锁文件。依赖采用精确版本，包间使用 workspace 协议。Lerna 管理统一版本；pnpm 管安装和任务。

修改源码后先 build，再运行消费 dist 的测试。`pnpm check` 会检查构建、类型、规则、格式、测试、包内容与独立消费者。浏览器验证单独执行：

```bash
pnpm exec playwright install chromium
pnpm check:phaser
```

测试素材由代码生成，不拷贝未授权的游戏素材。排布验证覆盖几何约束，像素测试覆盖逆旋转和裁边还原。新导出器需要消费端验证。

core 不依赖 Node、DOM 或原生库；node 不依赖 CLI；包间只能导入公开出口。避免仅为转发类型或工具函数新增包。

提交标题和正文使用中文，类型前缀和标识符可以保留英文。导入上游代码时记录准确 commit，并随发布包保留原作者许可证。

正式发布前先完成 docs/release.md 中的账号与 CI 验证；本地 check 成功不等于所有平台或发布权限已经验证。
