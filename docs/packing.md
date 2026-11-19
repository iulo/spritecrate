# Packing quality

`atlas.packMode` accepts `best` (default) and `fast`. The field is shared by core, Node SDK and CLI JSON configuration. Existing callers automatically use `best`; frame coordinates may change, while IDs, source dimensions and trim semantics keep their existing meaning.

## Geometry before pixels

Preprocessing trims and deduplicates sprites once. The planner evaluates geometry only; the selected layout is composited and encoded once. Candidate attempts do not allocate atlas pixel arrays or run PNG encoding.

`fast` performs one global Best Short Side Fit (BSSF) pass at the configured maximum size and crops each page to its contents, matching 0.1.2. `best` starts with that complete plan as its fallback and tries:

- Best Short Side Fit.
- Best Long Side Fit.
- Best Area Fit.
- Bottom Left.
- Contact Point.

A candidate must satisfy the existing resource limits. If the fast baseline is valid, a replacement cannot increase its page count or total pixel area. Eligible candidates are compared by page count first, then total pixel area; exact ties keep the earlier result. All decisions use integer geometry, stable input ordering and deterministic tie rules.

## Size search

For non-fixed output, the planner generates a bounded coarse grid of candidate widths/heights, including their limits and minimum sprite sizes. It discards clearly undersized candidates, orders the rest by canvas area and refines around the best cap with successively smaller steps. The coarse spacing is approximately one forty-eighth of each maximum dimension. `maxWidth`/`maxHeight` remain hard limits, rather than dimensions to force onto the result.

Power-of-two candidates use powers of two only. Square candidates have equal dimensions. Fixed-size output tries placement strategies at the specified size without size search. Every result still retains extrusion, padding, borders, rotation and alias geometry.

Optimization has a deterministic scoring-work budget: 8 million weighted free-rectangle evaluations for BSSF and 2 million for each other strategy. Contact Point evaluations account for the number of used rectangles; rotated orientation checks also consume budget. Coarse search reserves a quarter of its remaining budget for local refinement. Incomplete attempts are discarded; the complete fast baseline is never interrupted. This is a bound on scoring work, not a promised runtime limit.

This is heuristic search, not exhaustive enumeration or a global optimality guarantee. Large sets can exhaust the optimization budget without improving the baseline. Choose `fast` when packing latency matters more than compactness.

## Regression and measurement

`tests/fixtures/animation-rectangles.json` contains the sizes and alias groups of 100 real animation frames, with no artwork or original pixel data. Tests generate synthetic pixels for these rectangles, verify legacy sizes, require an aggregate area improvement, and check rotation, borders, padding, square/POT/fixed-size constraints and input-order determinism. Separate tests exercise all five strategies and budget exhaustion.

Additional local verification used all 100 original PNG frames through the Node SDK: the optimized pages preserve every visible RGBA pixel and every 300×300 source canvas. The `fast` PNG/JSON outputs match the installed 0.1.2 SDK byte-for-byte on the tested machine. Original images are not included in this repository.

| Animation    | 0.1.2 size | Optimized size |
| ------------ | ---------- | -------------- |
| Normal idle  | 1518×1288  | 1518×1287      |
| Normal death | 1504×924   | 1136×1104      |
| Fast idle    | 1479×1295  | 1466×1034      |
| Fast death   | 1533×971   | 1023×1197      |

The four pages total 6,748,728 → 5,948,185 pixels (11.86% smaller), or 25.74 → 22.69 MiB of base RGBA data. This excludes mipmaps, driver alignment and engine overhead.

A local Phaser 4.2.1 WebGL check rendered every optimized frame alongside its original PNG, with the same 300×300 source canvas: all 100 frames matched pixel-for-pixel, with nonblank-source checks. The standard Phaser 4/3 and PixiJS consumer suites also pass. These results are not YYRT device validation of the new layouts.

Run `pnpm benchmark` for side-by-side `fast`/`best` results at 10, 100 and 500 synthetic sprites. It performs one warmup and three measured iterations per mode, reports median time, page count, total area, occupancy and cumulative process peak RSS. The core benchmark excludes decoding and PNG encoding. See [measured results](benchmark-packing.json); timings depend on machine/runtime and are not pass/fail test thresholds.

References: [upstream sources](upstream.md), [MaxRects reference implementation and survey](https://github.com/juj/RectangleBinPack), [TexturePacker packing settings](https://www.codeandweb.com/texturepacker/documentation/texture-settings#layout).
