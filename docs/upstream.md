# 上游来源与迁移记录

基线核查日期：2026-11-18。

| 项目                        | 固定 commit                              | 用途                                 |
| --------------------------- | ---------------------------------------- | ------------------------------------ |
| odrick/free-tex-packer-core | f918f61569e669df61825ec1040540f1d8470acb | MaxRects、图片处理规则和导出格式参考 |
| odrick/free-tex-packer      | c972c97c522a80c6859a2b836a99d1402d95293e | 产品功能、导出与未来 GUI 参考        |

## 已移植与参考

| 上游位置                                       | 本地位置                      | 处理                                                                         |
| ---------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| core/packers/MaxRectsBin.js、math/Rect.js      | packages/core/src/maxrects.ts | TypeScript 改写；保留 BestShortSideFit、自由矩形切分和包含消除；稳定决胜规则 |
| core/PackProcessor.js、utils/Trimmer.js        | core 的 pack/preprocess       | 行为参考，重新实现；区分裁边、物理矩形和别名元数据                           |
| core/exporters/Phaser3*、JsonHash*、JsonArray* | packages/core/src/export.ts   | 字段语义参考；对象序列化取代模板；多页 Phaser 合并为一个描述文件             |
| app 的客户端配置与 README                      | 规划与文档                    | 仅参考，无 GUI 源码移植                                                      |

上游两个项目均为 MIT，原版权为 Copyright (c) 2018 Alexander Norinchak。各发布包携带原许可证及 THIRD_PARTY_NOTICES.md；本项目新增代码为 MIT。

## 明确差异

- 公开接口采用具名对象与 Promise；不保留旧回调入口。
- 默认关闭旋转；Phaser 4 导出明确拒绝旋转，因为 Phaser 4.2.1 真实消费测试存在采样错误。
- 未声明输入缩放、滤镜和 TinyPNG 支持。
- 首期只支持一种排布策略，排序与同分规则稳定化，布局可能与上游不同。
- core 不依赖 Jimp、Sharp、模板引擎或文件系统。
- 输出不包含时间戳，不要求生成素材或游戏展示作者名字。

算法正确性由几何、像素和真实消费测试验证；没有把上游输出当成唯一标准，也尚未建立上游全功能差异测试套件。
