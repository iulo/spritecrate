import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { pack } from '@spritetunk/node';

// Self-generated asymmetric fixtures, including a transparent border on b.
const images = [];
for (const [id, color, width, height, offset] of [
  ['a', 40, 6, 3, 0],
  ['b', 150, 8, 5, 1],
]) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 6; x++)
      data.set([color + x * 5, y * 30, 80, 255], ((y + offset) * width + x + offset) * 4);
  images.push({
    id,
    width,
    height,
    data: await sharp(data, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer(),
    expected: [...data],
  });
}
const packed = await pack({
  inputs: images,
  atlas: { name: 'test', maxWidth: 6, maxHeight: 3, rotate: false, extrude: 0, padding: 0 },
  format: 'phaser3',
});
assert.equal(packed.report.pageCount, 2);
const files = new Map(packed.files.map((file) => [`/${file.name}`, file.data]));
files.set(
  '/phaser.js',
  await readFile(new URL('../node_modules/phaser/dist/phaser.js', import.meta.url)),
);
files.set(
  '/',
  Buffer.from(`<!doctype html><meta charset="utf-8"><script src="/phaser.js"></script><script>
window.testResult = null;
new Phaser.Game({ type: Phaser.WEBGL, width: 64, height: 64, transparent: true, antialias: false, pixelArt: true, banner: false,
 scene: {
  preload() { this.load.multiatlas('test', '/test.json', '/'); },
  create() {
   const texture = this.textures.get('test');
   const frames = ['a', 'b'].map(id => { const f = texture.get(id); return { name: id, width: f.realWidth, height: f.realHeight, rotated: f.rotated, source: f.sourceIndex }; });
   this.add.image(0, 0, 'test', 'a').setOrigin(0);
   this.add.image(6, 0, 'test', 'b').setOrigin(0);
   this.time.delayedCall(100, () => this.game.renderer.snapshot(image => {
    const canvas = document.createElement('canvas'); canvas.width = 14; canvas.height = 5;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    window.testResult = { frames, pixels: Array.from(context.getImageData(0, 0, 14, 5).data) };
   }));
  }
 }
});</script>`),
);
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const data = files.get(pathname);
  if (!data) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    'Content-Type',
    pathname.endsWith('.png')
      ? 'image/png'
      : pathname.endsWith('.json')
        ? 'application/json'
        : pathname.endsWith('.js')
          ? 'text/javascript'
          : 'text/html',
  );
  res.end(data);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.testResult !== null, undefined, { timeout: 30000 });
  const result = await page.evaluate(() => window.testResult);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    result.frames.map((frame) => [frame.width, frame.height, frame.rotated]),
    [
      [6, 3, false],
      [8, 5, false],
    ],
  );
  assert.notEqual(result.frames[0].source, result.frames[1].source);
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 14; x++) {
      const image = images[x < 6 ? 0 : 1];
      const sourceX = x < 6 ? x : x - 6;
      const expected =
        y >= image.height
          ? [0, 0, 0, 0]
          : image.expected.slice(
              (y * image.width + sourceX) * 4,
              (y * image.width + sourceX) * 4 + 4,
            );
      assert.deepEqual(result.pixels.slice((y * 14 + x) * 4, (y * 14 + x) * 4 + 4), expected);
    }
  console.log(
    'Phaser 3.90.0: real multiatlas loader, separate pages, trimmed offsets and rendered pixels passed.',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
