# @spritetunk/core

SpriteTunk 的平台无关图集核心，提供 RGBA 处理、MaxRects 排布、合成和描述文件导出。不依赖 Node.js、DOM 或图片编解码库。

```bash
npm install @spritetunk/core
```

```ts
import { pack, exportAtlas } from '@spritetunk/core';

const result = pack({
  sprites: [{ id: 'pixel', width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) }],
});
const descriptions = exportAtlas(result.pages, 'json-hash');
```

结果中的 pixels 为未编码的 RGBA 字节；需要 PNG 和文件输入请使用 @spritetunk/node。

## 文档与来源

- [项目文档](https://github.com/iulo/spritetunk#readme)
- [配置参考](https://github.com/iulo/spritetunk/blob/main/docs/configuration.md)

参考 [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core)，移植部分保留原作者声明，详见 THIRD_PARTY_NOTICES.md 和 LICENSES。

## License

MIT © SpriteTunk contributors.
