# 发布依赖补丁

`sigstore@5.0.1.patch` 修改 Sigstore 5.0.1 的 `dist/config.js` 和 `dist/sigstore.js`，仅供 Lerna 的开发侧发布链路使用。

Copyright 2023 The Sigstore Authors. 上游使用 Apache-2.0，许可证副本见 [LICENSE-sigstore.txt](LICENSE-sigstore.txt)。原文件中的版权及许可头保留。

本项目的修改启用 Rekor 冲突回读，并在返回 attestation 前完整验证 Sigstore bundle。原因、边界与回归见 [发布维护](../docs/release.md)。这些补丁及其依赖不包含在三个 SDK/CLI npm 包中。

上游：[sigstore/sigstore-js](https://github.com/sigstore/sigstore-js)。
