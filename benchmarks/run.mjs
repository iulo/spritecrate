import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { pack, VERSION } from '@spritetuck/core';

const cases = [];
for (const count of [10, 100, 500]) {
  const sprites = Array.from({ length: count }, (_, i) => {
    const width = 8 + ((i * 17) % 57),
      height = 8 + ((i * 23) % 57);
    const pixels = new Uint8Array(width * height * 4);
    for (let p = 0; p < pixels.length; p += 4)
      pixels.set([i % 256, (i >> 8) % 256, p % 256, 255], p);
    return { id: `sprite-${i}`, width, height, pixels };
  });
  for (const packMode of ['fast', 'best']) {
    const options = { packMode, maxWidth: 512, maxHeight: 512, rotate: true, deduplicate: false };
    pack({ sprites, options });
    const durations = [];
    let result;
    for (let iteration = 0; iteration < 3; iteration++) {
      const start = performance.now();
      result = pack({ sprites, options });
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    cases.push({
      count,
      packMode,
      totalPixels: result.pages.reduce((sum, page) => sum + page.width * page.height, 0),
      medianMs: durations[1],
      pages: result.report.pageCount,
      occupancy: result.report.occupancy,
      processPeakRssKiB: process.resourceUsage().maxRSS,
    });
  }
}
console.log(
  JSON.stringify(
    {
      version: VERSION,
      implementation: 'multi-heuristic-size-search',
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpu: os.cpus()[0]?.model,
      fixture:
        'self-generated seeded dimensions; RGBA core only; 1 warmup + 3 measurements; peak RSS is cumulative process high-water mark',
      cases,
    },
    null,
    2,
  ),
);
