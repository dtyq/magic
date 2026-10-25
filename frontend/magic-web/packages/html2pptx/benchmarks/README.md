# html2pptx benchmarks

This directory contains the reproducible phase-0 benchmarks for `@magic/html2pptx`.
The commands write machine-readable JSON to stdout. Progress is written to stderr, so stdout can
be redirected directly to a result file.

Convenience package scripts are available when running from this package:

```bash
pnpm run benchmark:node -- --profile quick
pnpm run benchmark:browser -- --profile quick --target source
pnpm run benchmark:smoke
```

`benchmark:smoke` runs every scenario with one slide and one measured iteration. It verifies the
harness wiring; it is not a performance baseline.

The Phase 4 forward-only smoke uses the real Vite Packaging Worker and writes to a real Origin
Private File System (OPFS) file. It also reopens the completed file and verifies the expected
`ppt/slides/slideN.xml` entries:

```bash
pnpm exec tsx benchmarks/browser/streaming-smoke.ts \
  --slides 300 \
  --cpu-throttle 4 \
  --timeout-ms 900000 \
  --output benchmarks/results/streaming-smoke-300.json
```

The smoke intentionally uses a test-only zero-wait readiness controller. Chromium does not
currently structured-clone `FileSystemWritableFileStream` into a Worker, so the script keeps the
real OPFS writable on the main thread and exercises the production sink-proxy backpressure path
for Worker-generated ZIP chunks. This still avoids an in-memory final Blob.

### GB-scale validation semantics

The completed OPFS file is never loaded with `file.arrayBuffer()`. The smoke validates it in
bounded pieces:

- ZIP metadata is read from the file tail only. Classic ZIP uses the EOCD record; ZIP64 uses the
  ZIP64 EOCD and locator as well.
- Only the central-directory range is read to count entries and verify
  `ppt/slides/slideN.xml`. Central-directory parsing is chunked and does not read local-file data,
  image payloads, video payloads, or other media bytes into one JavaScript allocation.
- SHA-256 reads fixed-size `Blob.slice()` ranges incrementally with a small pure-TypeScript
	SHA-256 state. Chunks are discarded after each update; the final digest is a 64-character
	hexadecimal string, and the hash read working set has an explicit chunk-size bound.

The result keeps the original archive fields and adds bounded-validation and sink telemetry:

| Field                                                                    | Meaning                                                                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `archiveType`                                                            | `classic` or `zip64` selected from the tail metadata.                                                                      |
| `centralDirectoryOffset`, `centralDirectorySize`                         | Parsed ZIP directory range.                                                                                                |
| `archiveMetadataBytesRead`, `centralDirectoryBytesRead`                  | Bytes read for ZIP validation; media payloads are excluded.                                                                |
| `maxArchiveValidationBufferBytes`                                        | Largest temporary buffer used while reading ZIP metadata/directory.                                                        |
| `hashBytesRead`, `hashChunkCount`, `maxHashChunkBytes`, `hashDurationMs` | Streaming SHA-256 read statistics.                                                                                         |
| `chunkCount`, `totalChunkBytes`, `maxChunkBytes`                         | Main-thread sink-proxy output chunks.                                                                                      |
| `maxInFlightBytes`, `maxInFlightChunks`                                  | Outstanding writes observed by the sink wrapper.                                                                           |
| `writeWait*`                                                             | Time from calling `sink.write()` until the destination write completes.                                                    |
| `ackWait*`                                                               | The same completion gate from the sink-proxy perspective: the Worker ACK is posted only after that write promise resolves. |

`maxInFlightBytes` is a main-thread sink-proxy observation. It is not a Worker/native process
peak and does not include browser file-system cache, OPFS reservation, or the media bytes already
written to disk. Heap fields have the same limitation and still do not include Worker/native
memory. GB-scale runs therefore require sufficient local OPFS/disk quota; the smoke provides a
bounded-memory validation path, not an unlimited-storage guarantee. It also does not replace
opening the resulting PPTX in PowerPoint on Windows and macOS.

The pure benchmark helpers have focused small-file coverage for classic ZIP, ZIP64 tails,
cross-chunk central-directory entries, malformed tails, incremental SHA-256, sink backpressure,
and write failure cleanup:

```bash
pnpm exec vitest run --config packages/html2pptx/benchmarks/vitest.config.ts
```

Add `--media` to place one reused deterministic PNG on every page and exercise Worker-side media
fetching and deduplication without making the smoke fixture multi-GB:

```bash
pnpm exec tsx benchmarks/browser/streaming-smoke.ts --slides 300 --media
```

## Scope

Two independent benchmark layers are provided:

- `node/run.ts`: packaging-only benchmark built from deterministic PPT IR. It measures creation of
  the PptxGenJS presentation, drawing nodes, and the destination-first `writeTo()` call. Output is
  consumed by a counting/hash sink so the benchmark does not request a final in-memory artifact.
- `browser/run.ts`: Chromium end-to-end benchmark. It runs real iframe rendering, resource loading,
  DOM-to-IR conversion, Packaging Worker streaming, sink writes, and artifact hashing through
  `exportPPTXStreaming()`.

The first fixture set intentionally covers `text`, `image-reuse`, `image-unique`, and `mixed`.
Audio/video and multi-GB fixture suites are not part of this first harness. They should be added as
a separate media/ZIP64 suite so quick CI runs do not need to store or generate GB-scale assets.

## Node packaging benchmark

```bash
pnpm exec tsx benchmarks/node/run.ts --profile quick

pnpm exec tsx benchmarks/node/run.ts \
  --profile baseline \
  --scenario text,image-reuse,image-unique,mixed \
  --output benchmarks/results/node-baseline.json
```

Options:

- `--profile quick|baseline` (default: `quick`)
- `--scenario all|text,image-reuse,image-unique,mixed` (default: `all`)
- `--iterations N`
- `--warmup N` (`0` is allowed)
- `--timeout-ms N`
- `--slides N`
- `--images-per-slide N`
- `--image-width N`
- `--image-height N`
- `--output path`

The quick profile uses 8 slides and small deterministic PNGs. The baseline profile uses 200
slides, 30 measured iterations, and three 256x144 incompressible PNG fixtures per slide. Every
warmup and measured iteration runs in a fresh Node child process, so RSS is not inherited from the
previous scenario or iteration.

## Browser end-to-end benchmark

```bash
# Source benchmark; does not require dist/.
pnpm exec tsx benchmarks/browser/run.ts \
  --target source \
  --profile quick \
  --scenario text

# Existing built artifact benchmark. This is explicit because dist/ is ignored and may be stale.
pnpm exec tsx benchmarks/browser/run.ts \
  --target dist \
  --profile baseline \
  --scenario mixed \
  --cpu-throttle 4 \
  --output benchmarks/results/browser-dist-baseline.json
```

`dist` is ignored by Git and may not exist in a clean checkout. The default package benchmark and
smoke scripts use `source`; use `benchmark:dist` only for an intentionally preserved built artifact.
Be aware that rebuilding replaces the local `dist`; copy an old artifact elsewhere before rebuilding
when it is the baseline under comparison.

Browser options:

- `--target dist|source` (default: `source`)
- `--profile quick|baseline` (default: `quick`)
- `--scenario all|text,image-reuse,image-unique,mixed`
- `--cpu-throttle N` (default: quick `1`, baseline `4`)
- `--iterations N`
- `--warmup N`
- `--slides N`
- `--images-per-slide N`
- `--image-width N`
- `--image-height N`
- `--timeout-ms N`
- `--chrome-path /absolute/path/to/chrome`
- `--headful`
- `--output path`

Example 300-page pressure run:

```bash
pnpm exec tsx benchmarks/browser/run.ts \
  --target source \
  --profile baseline \
  --scenario image-unique \
  --slides 300 \
  --images-per-slide 4 \
  --image-width 512 \
  --image-height 288 \
  --iterations 1 \
  --warmup 0 \
  --cpu-throttle 4
```

Chrome resolution order is:

1. `--chrome-path` or `PUPPETEER_EXECUTABLE_PATH`;
2. in headless mode, an installed Puppeteer `chrome-headless-shell`;
3. Puppeteer's configured executable;
4. other installed Puppeteer Chrome builds;
5. common system Chrome/Chromium locations.

If no browser is found, install the pinned revision with:

```bash
pnpm exec puppeteer browsers install chrome
```

## Result semantics

Both runners report:

- schema version, Git commit/dirty state, runtime and dependency versions, CPU, memory, profile,
  and fixture shape;
- raw iteration samples plus P50/P95 summaries;
- output byte size and artifact SHA-256;
- benchmark tree, working tree, lockfile, PptxGenJS entry/tree, and target provenance hashes.

Formal baseline profiles use at least 20 successful measurements (browser: 20, Node: 30). Quick,
smoke, failed, or manually shortened runs still emit P95 for inspection, but mark it
`descriptive-only`; it must not be presented as a tail-latency estimate.

An OOM, timeout, page crash, process exit, or benchmark exception is recorded as a failed sample.
The remaining iterations continue, and each scenario reports attempted/succeeded/failed counts and
success rate. Metrics summarize successful samples only.

The browser result includes both `targetModuleSha256` and `targetTreeSha256`. The source tree hash
covers sorted `src/**/*.ts` paths and contents. The dist tree hash covers every file below `dist`,
including worker/assets files.

The browser runner also reports:

- total wall time;
- sampled main-renderer JS heap using Chrome's `--enable-precise-memory-info` (including the
  separate `sampledValidationPeakJsHeapBytes` value after export while ZIP metadata and the
  streamed digest are checked);
- Long Task count, total duration, and maximum duration;
- artifact hash duration separately from export duration.

`sampledExportPeakJsHeapBytes` is sampled before artifact hashing;
`sampledPeakJsHeapBytes` includes hashing. The 20ms main-thread sampler can miss transient
allocations during a Long Task. Browser JS heap also excludes Worker/native/Blob backing memory, so
these fields must not be treated as strict process peaks or whole-process RSS.

The Chromium process is reused, but each scenario gets an independent BrowserContext and every
iteration gets a fresh Page and CDP session. With the default warmup, measured samples use that
scenario's warmed browser cache. With `--warmup 0`, the first measured sample is cold and later
samples are warm; the report records this cache semantic. The synthetic asset server uses a bounded
32MiB/128-entry LRU instead of retaining all unique image fixtures.

Node memory fields use the `sampled*` prefix and a 5ms sampler inside each isolated child process.
They may likewise miss short synchronous allocation spikes; the report records this limitation.

## Type checking

The package's main `tsconfig.json` only includes `src`. Check benchmark code separately:

```bash
pnpm exec tsc -p benchmarks/tsconfig.json --noEmit
```
