# @spritetunk/node

SpriteTunk 的 Node.js SDK，支持静态 PNG 输入、图片编解码和显式文件输出。

```bash
npm install @spritetunk/node
```

```ts
import { pack, writeOutput } from '@spritetunk/node';

const result = await pack({
  inputs: ['assets/**/*.png'],
  atlas: { name: 'characters' },
  format: 'phaser3',
});
await writeOutput(result.files, { directory: 'dist/atlas' });
```

支持文件 glob 或具名 PNG 字节输入。Phaser 3 导出要求关闭旋转。

## 文档与来源

- [项目文档](https://github.com/iulo/spritetunk#readme)
- [配置参考](https://github.com/iulo/spritetunk/blob/main/docs/configuration.md)

参考 [odrick/free-tex-packer-core](https://github.com/odrick/free-tex-packer-core)，移植部分保留原作者声明，详见 THIRD_PARTY_NOTICES.md 和 LICENSES。

## License

MIT © SpriteTunk contributors.
