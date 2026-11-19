# Framework integration

Phaser 4 is the primary target. Packing and PNG generation are engine-independent; select a metadata format with the SDK's `format` option or CLI `--format`.

## Phaser 4 and Phaser 3

```bash
spritetuck pack "assets/**/*.png" --name characters --format phaser4 --out-dir dist/atlas
```

```js
// Scene.preload
this.load.multiatlas('characters', 'dist/atlas/characters.json', 'dist/atlas/');
// Scene.create
this.add.image(100, 100, 'characters', 'assets/hero.png');
```

Use `phaser3` for Phaser 3. Both formats emit one JSON referencing all PNG pages. Both reject `atlas.rotate: true`: Phaser 4.2.1 and 3.90.0 load rotated metadata but fail the pixel comparison. This is unrelated to rotating a Sprite game object.

Validation: Chromium WebGL, single/multiple pages, trim offsets, extrusion, and a negative rotation probe. No YYRT device validation.

## PixiJS

```bash
spritetuck pack "assets/**/*.png" --name characters --format pixijs --out-dir dist/atlas
```

```js
import { Application, Assets, Sprite } from 'pixi.js';

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

// Single page: characters.json. Multiple pages: characters-0.json.
const sheet = await Assets.load('dist/atlas/characters.json');
const sheets = [sheet, ...sheet.linkedSheets];
const texture = sheets.map((page) => page.textures['assets/hero.png']).find(Boolean);
if (!texture) throw new Error('Missing frame: assets/hero.png');
app.stage.addChild(new Sprite(texture));
```

The `pixijs` format emits TexturePacker-style JSON Hash, with `meta.related_multi_packs` linking every other page by relative JSON filename. Linked sheets retain their own `textures` maps; the example searches all loaded pages. Frame IDs preserve relative input paths and extensions. Generic `json-hash` does not emit these links.

Rotation is optional (`atlas.rotate: true` in JSON configuration or SDK options). PixiJS 8.23.0 WebGL single-page, multipage, trim, extrusion and forced clockwise rotation pass exact pixel comparisons. WebGPU and older PixiJS versions have not been tested. No animation timelines are generated.

Reference: [PixiJS textures](https://pixijs.com/8.x/guides/components/textures), [multipack loader](https://github.com/pixijs/pixijs/blob/v8.23.0/src/spritesheet/spritesheetAsset.ts).

## Cocos Creator / Cocos2d-x

```bash
spritetuck pack "assets/**/*.png" --name characters --format cocos2d --out-dir dist/atlas
```

Each PNG has a matching `.plist`, using Cocos2d-x plist format 3. Import each PNG/plist pair into Cocos Creator's Assets panel together. With multiple pages, import every pair; no aggregate atlas asset or Creator `.meta` UUIDs are generated. In Cocos2d-x, register every page with `SpriteFrameCache::addSpriteFramesWithFile`.

```cpp
auto cache = cocos2d::SpriteFrameCache::getInstance();
cache->addSpriteFramesWithFile("characters.plist");
auto sprite = cocos2d::Sprite::createWithSpriteFrameName("assets/hero.png");
```

The exporter writes `textureRect` with logical dimensions, `spriteSize`, original `spriteSourceSize`, `textureRotated`, and source-center offsets with positive Y upward. Each deduplicated name keeps its own geometry. PNGs use straight alpha (`premultiplyAlpha: false`).

Validation: independent plist parsing and pixel reconstruction cover asymmetric trimming, half-pixel center offsets, forced rotation, deduplication, transparent placeholders, Unicode/XML escaping and page filenames. The contract follows the [Cocos2d-x 3.17.2 format-3 reader](https://github.com/cocos2d/cocos2d-x/blob/cocos2d-x-3.17.2/cocos/2d/CCSpriteFrameCache.cpp). Cocos Creator editor import and Cocos runtime rendering have **not** been tested; this is format support, not a completed runtime certification.

Reference: [Cocos Creator 3.8 atlas workflow](https://docs.cocos.com/creator/3.8/manual/en/asset/atlas.html).

## Other engines

`json-hash` and `json-array` contain texture rectangles, rotation flags, source dimensions and trim offsets. A custom loader can consume them, or the Node SDK can accept `(pages, name) => OutputFile[]` as `format` to emit another metadata format. Godot, Unity and Spine-specific integration is not implemented.

## Reproduce validation

```bash
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm check:engines
```

Engine and plist packages are development dependencies only; consumers do not install them through SpriteTuck.
