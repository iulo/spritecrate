import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { pack } from '@spritecrate/node';

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
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
try {
  const target = { version: '8.23.0' };
  for (const mode of ['single', 'multi', 'rotation']) {
    const rotate = mode === 'rotation';
    const packed = await pack({
      inputs: images,
      atlas: {
        name: 'test',
        maxWidth: mode === 'single' ? 64 : rotate ? 3 : 6,
        maxHeight: mode === 'single' ? 64 : rotate ? 6 : 3,
        rotate,
        extrude: mode === 'single' ? 1 : 0,
        padding: mode === 'single' ? 2 : 0,
      },
      format: 'pixijs',
    });
    assert.equal(packed.report.pageCount, mode === 'single' ? 1 : 2);
    const files = new Map(packed.files.map((file) => ['/' + file.name, file.data]));
    files.set(
      '/pixi.js',
      await readFile(new URL('../node_modules/pixi.js/dist/pixi.js', import.meta.url)),
    );
    files.set(
      '/',
      Buffer.from(`<!doctype html><meta charset="utf-8"><body><script src="/pixi.js"></script><script>
window.testResult=null;
(async()=>{
 const app=new PIXI.Application();
 await app.init({preference:'webgl',width:64,height:64,backgroundAlpha:0,antialias:false,autoStart:false});
 document.body.appendChild(app.canvas);
 const sheet=await PIXI.Assets.load('${mode === 'single' ? '/test.json' : '/test-0.json'}');
 const sheets=[sheet,...sheet.linkedSheets];
 const frames=['a','b'].map((id,index)=>{
  const texture=sheets.map(s=>s.textures[id]).find(Boolean);
  texture.source.scaleMode='nearest';
  const sprite=new PIXI.Sprite(texture);sprite.position.set(index*6,0);app.stage.addChild(sprite);
  return {width:texture.orig.width,height:texture.orig.height,rotated:texture.rotate!==0,source:sheets.findIndex(s=>s.textures[id])};
 });
 const extracted=app.renderer.extract.pixels({target:app.stage,frame:new PIXI.Rectangle(0,0,14,5)});
 window.testResult={version:PIXI.VERSION,frames,pixels:Array.from(extracted.pixels),pages:sheets.length};
})().catch(error=>{window.testResult={error:String(error)};});
</script>`),
    );
    const server = createServer((req, res) => {
      const name = new URL(req.url, 'http://localhost').pathname;
      const data = files.get(name);
      if (!data) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        'Content-Type',
        name.endsWith('.png')
          ? 'image/png'
          : name.endsWith('.json')
            ? 'application/json'
            : name.endsWith('.js')
              ? 'text/javascript'
              : 'text/html',
      );
      res.end(data);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const page = await browser.newPage();
    try {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.waitForFunction(() => window.testResult !== null, undefined, { timeout: 30000 });
      const result = await page.evaluate(() => window.testResult);
      assert.deepEqual(errors, []);
      assert.equal(result.error, undefined);
      assert.equal(result.version, target.version);
      assert.equal(result.pages, packed.report.pageCount);
      assert.deepEqual(
        result.frames.map((f) => [f.width, f.height, f.rotated]),
        [
          [6, 3, rotate],
          [8, 5, rotate],
        ],
      );
      if (mode === 'single') assert.equal(result.frames[0].source, result.frames[1].source);
      else assert.notEqual(result.frames[0].source, result.frames[1].source);
      let mismatches = 0;
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 14; x++) {
          const image = images[x < 6 ? 0 : 1],
            sx = x < 6 ? x : x - 6;
          const expected =
            y >= image.height
              ? [0, 0, 0, 0]
              : image.expected.slice((y * image.width + sx) * 4, (y * image.width + sx) * 4 + 4);
          if (!expected.every((v, i) => v === result.pixels[(y * 14 + x) * 4 + i])) mismatches++;
        }
      console.log(`PixiJS ${target.version} ${mode}: ${mismatches} pixel mismatches`);
      assert.equal(mismatches, 0);
    } finally {
      await page.close();
      await new Promise((resolve) => server.close(resolve));
    }
  }
} finally {
  await browser.close();
}
