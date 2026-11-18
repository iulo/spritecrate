# 发布维护

## 项目与权限

- GitHub 仓库：https://github.com/iulo/spritetunk
- npm scope：@spritetunk；三个包统一版本。
- 发布入口：GitHub Actions → Release → Run workflow，选择 main。
- 发布环境：npm，仅 main 分支可部署；不保存长期 npm 发布 token。

CI 检查三种操作系统和三个 Node 版本，另外验证 Phaser 4 实际加载。Release 会重新运行 pnpm check 和 Phaser 检查，通过后由 Lerna 发布 registry 中不存在的新版本。

## 日常发布

1. 确保 main 的 CI 全部通过，且工作区干净。
2. 运行 pnpm version:packages，选择版本；审阅三个包和 Lerna 的版本变更，更新并提交 pnpm-lock.yaml。需要 CHANGELOG 时由维护者补充本次变更。
3. 推送版本提交及对应 tag。Release 不因 tag 自动触发。
4. 在 main 手动触发 Release，跟进执行到完成。
5. 核对三个包的版本、dist-tag、安装结果与 provenance。

发布过程按依赖关系执行 core → node → cli。若部分包成功后失败，不修改已经发布的同版本内容；修复原因后重新运行 from-package，发布其余尚不存在的版本。

## 首次初始化

npm 的可信发布设置要求包已经存在。首次引导由具备组织权限的维护者登录 npm，按依赖顺序发布经过检查的 tarball，并完成 npm 要求的 2FA 授权。

随后为每个包绑定相同的可信发布配置，例如：

```bash
npm trust github @spritetunk/core \
  --repository iulo/spritetunk \
  --file release.yml \
  --environment npm \
  --allow-publish \
  --yes
```

对 @spritetunk/node 和 @spritetunk/cli 重复执行，并用 npm trust list 核实。不要增加不相关仓库、workflow 或长期凭据的权限。

环境策略的可审阅定义保存在 scripts/github-npm-environment.json 和 scripts/github-npm-branch-policy.json；文件不会自行修改 GitHub 设置。

## 发布产物

每包包含 dist、README、LICENSE、LICENSES、THIRD_PARTY_NOTICES；CLI 额外包含 config.schema.json。源码和依赖引用通过 pnpm pack 处理，workspace 协议转换为可安装的版本范围。

pnpm check:package 检查 exports、声明与 tarball；pnpm check:consumer 在独立项目安装三包，验证 SDK、类型和命令行入口。

## 参考

- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/cli/v11/commands/npm-trust/
