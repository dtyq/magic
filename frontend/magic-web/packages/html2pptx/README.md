# html2pptx

Convert HTML content to PPTX slides.

## Development

```bash
pnpm install
pnpm run dev
```

## Build

```bash
pnpm run build
```

## Test

```bash
pnpm run test
```

## Benchmark

Run the quick Node packaging and real-browser smoke benchmarks:

```bash
pnpm run benchmark:smoke
```

Run the 200-page browser baseline against the tracked source code:

```bash
pnpm run benchmark
```

Run a comparison against an existing built `dist` artifact:

```bash
pnpm run benchmark:dist
```

Every report records the Git revision, target (`dist` or `source`), artifact SHA-256,
PptxGenJS version, timings, output size, and memory samples. Results from different target or
artifact hashes must not be compared as the same baseline. See [benchmarks/README.md](./benchmarks/README.md)
for scenarios, profiles, and CLI options.

## Package layout

This repository contains the self-contained open-source package. The public entry point is
`src/index.ts`; `vite.config.ts` builds it as ESM and CommonJS output under `dist/`, while
`tsconfig.json` emits the declaration files. The package does not depend on an `enterprise/`,
`customer/`, or Overlay source tree.

The repository-only benchmark harness lives under `benchmarks/` and is not included in the
published package. Its Node and Chromium runners can be type-checked with
`pnpm run typecheck` and are documented in [benchmarks/README.md](./benchmarks/README.md).

Application code consumes the package only through its public package name:

```ts
import { exportPPTXStreaming } from "@magic/html2pptx"
```

Version 2 removes the buffered `exportPPTX` and `generatePPTX` APIs. All exports must provide a
caller-owned destination and use `exportPPTXStreaming`. The package never chooses a Blob output
destination by itself. A browser host that intentionally owns a buffered-download sink
may mark that sink with `replayPolicy: "buffered"`; the export still runs through the Packaging
Worker and may use an in-memory replay store when OPFS is unavailable. File-stream sinks remain
OPFS-backed and are never silently converted to an unbounded memory export.

The package must be built before a workspace consumer resolves its `dist` exports. Commercial
applications may compose their own integration around these public exports, but no commercial
source or build configuration is part of this open-source package.

## Large-export runtime requirements

`exportPPTXStreaming` is the forward-only large-export API. Its built-in packaging path requires
the PptxGenJS v5 streaming runtime to provide `beginStreaming()`, `writeTo()`, and
`createOpfsStagingStore()`. This repository obtains that runtime from the public registry
`pptxgenjs@4.0.1` and applies the committed pnpm patch
`patches/pptxgenjs@4.0.1.patch`; the patched package keeps the registry base version for pnpm
resolution while exposing the v5 runtime. Run `pnpm install --frozen-lockfile` from
`frontend/magic-web` so the lockfile-selected patch is applied. The committed patch, the
`pnpm.patchedDependencies` entry in `package.json`, and the lockfile are the complete installation
chain; no local PptxGenJS `.tgz` or separate metadata file is required.

### Packaging Worker URL

The ESM/Vite build emits the Packaging Worker under `dist/assets/` and resolves it when that
directory stays beside `dist/index.js`. Do not rely on that default for CJS browser consumers,
non-Vite bundlers, direct script loading, CDN/sub-path deployments, or copied/renamed assets.
Those integrations must pass an absolute `workerUrl` (or inject a host-owned `workerFactory` at
the lower-level packaging hook):

```ts
const workerUrl = new URL("https://static.example.com/html2pptx/packaging-worker.js")

const handle = exportPPTXStreaming(pages, {
	workerUrl,
	destination,
})
await handle.promise
```

### Page-owned export readiness

Pages that need to stop application-owned animations or finish asynchronous rendering can opt in
to the export handshake. The sandbox sets `data-magic-export-mode="pptx"` on the document root and
dispatches `magic:export-start` after DOM parsing. The page should switch to its deterministic
static state, then set `data-magic-export-ready="true"` (or `"error"` when it cannot produce a
valid snapshot):

```html
<html data-magic-export-ready="pending">
  <script>
    window.addEventListener("magic:export-start", async () => {
      document.documentElement.classList.add("pptx-export-mode")
      await renderChartsAndImages()
      document.documentElement.dataset.magicExportReady = "true"
    })
  </script>
</html>
```

The exporter waits for this marker only when the page declares the protocol, so existing pages keep
their current behavior. The legacy `data-render-ready` marker remains supported. 页面可以通过
`data-magic-export-mode="pptx"` 判断当前处于导出模式，在完成动画、图表和资源初始化后设置
`data-magic-export-ready="true"`；旧的 `data-render-ready` 写法继续兼容。

The CJS build test covers this explicit override path. The browser smoke benchmark also accepts
`--target dist` to verify the generated ESM asset path after a package build.
