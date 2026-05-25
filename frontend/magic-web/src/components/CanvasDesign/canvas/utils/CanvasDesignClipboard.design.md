# CanvasDesignClipboard Browser Compatibility Design

## Background

CanvasDesign copy/paste needs to support rich internal data: element metadata, source element data, image/video blobs, and canvas-export files. The previous protocol wrote multiple `ClipboardItem` entries, for example:

1. one private metadata item;
2. one private file item per media blob;
3. optional native media MIME types for interoperability.

This shape is not browser-safe. The DeepSeek reference points out the same root issue: most browsers currently only support `navigator.clipboard.write()` with an array containing a single `ClipboardItem`. Passing multiple clipboard items may fail even when each item is valid.

Reference:

- <https://chat.deepseek.com/share/f6kpedadxcznowc15f>

## Browser MIME support model

Browser support for `ClipboardItem` MIME types should be treated as two categories.

### Baseline MIME types

These MIME types are broadly supported by browsers that implement the Async Clipboard API and can be used without feature detection:

| MIME type       | Purpose                                                                         |
| --------------- | ------------------------------------------------------------------------------- |
| `text/plain`    | Plain text                                                                      |
| `text/html`     | Rich HTML content                                                               |
| `image/png`     | PNG image content                                                               |
| `text/uri-list` | URI list; important for WebKit/Safari and also writable in other major browsers |

CanvasDesign must not expose element metadata via `text/plain` or `text/html`, so these baseline text formats are not valid carriers for CanvasDesign internal protocol data. `image/png` is the only safe native media format for external interoperability.

### Conditionally supported MIME types

These MIME types must be checked before writing:

| MIME type       | Notes                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| `image/svg+xml` | Possible browser/version-dependent support                              |
| `web <mime>`    | Web custom formats, used for custom or otherwise unsupported MIME types |

Feature detection should use:

```ts
ClipboardItem.supports(type)
```

For example:

```ts
if (ClipboardItem.supports("image/svg+xml")) {
	const blob = new Blob(["<svg>...</svg>"], { type: "image/svg+xml" })
	await navigator.clipboard.write([new ClipboardItem({ "image/svg+xml": blob })])
}
```

CanvasDesign private formats must be written as Web Custom Formats, for example:

```ts
web application/x-canvas-design-clipboard-bundle
```

## Design goals

`CanvasDesignClipboard` is the browser compatibility boundary for CanvasDesign clipboard operations.

It should:

1. write at most one `ClipboardItem` to the browser;
2. use `ClipboardItem.supports()` before writing conditional MIME types;
3. keep CanvasDesign element metadata out of public formats such as `text/plain`, `text/html`, and plain `application/json`;
4. expose at most one native `image/png` representation when useful for external paste;
5. propagate native browser write errors instead of returning success-shaped fallbacks;
6. keep protocol parsing and element semantics in `CanvasElementClipboard`.

It should not:

1. decide whether a paste result is `canvas-elements` or `files`;
2. mutate element data;
3. upload files;
4. create canvas elements;
5. use project-level `@/` imports, because `src/components/CanvasDesign` must remain independently portable.

## Layer responsibilities

### `CanvasDesignClipboard`

Browser adapter responsibilities:

- call host-provided `clipboard.read/write` when injected;
- fall back to `navigator.clipboard.read/write`;
- detect MIME support;
- normalize CanvasDesign writes into a single `ClipboardItem`;
- create and parse the CanvasDesign bundle blob;
- log browser-level read/write decisions and native errors.

### `CanvasElementClipboard`

Protocol responsibilities:

- define element payload and file metadata schema;
- build copy payloads;
- interpret bundle read results;
- decide content-driven paste result type;
- keep element operation provenance such as `copy-elements` and `copy-as-png`.

### `ClipboardManager`

Business orchestration responsibilities:

- collect selected elements;
- fetch source blobs and source resource references;
- call `CanvasElementClipboard` to build protocol payloads;
- call `CanvasDesignClipboard` through protocol helpers;
- download referenced source files when inline blobs are unavailable;
- upload pasted files and create pasted elements.

## V2 single-item bundle protocol

### MIME type

Use a new private bundle MIME:

```ts
export const CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE =
	"web application/x-canvas-design-clipboard-bundle"
```

This replaces the browser-facing multi-item protocol:

```txt
web application/x-canvas-design-elements+json
web application/x-canvas-design-file
```

Those older MIME types may remain as legacy internal constants during migration, but new writes should target the V2 bundle.

### Clipboard write shape

All CanvasDesign writes should become:

```ts
await navigator.clipboard.write([
	new ClipboardItem({
		[CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE]: bundleBlob,
		...(nativePng ? { "image/png": nativePng } : {}),
	}),
])
```

The array length is always one.

### Bundle content

Use a binary container instead of JSON with base64 file content. This avoids base64 size inflation when a flow explicitly needs inline blobs, such as copy-as-PNG. Ordinary element copy should keep media transfer reference-first and avoid embedding large media blobs in the private bundle.

Recommended layout:

```txt
[magic 4 bytes][version 1 byte][headerLength 4 bytes][header JSON utf8][file bytes...]
```

Suggested constants:

```ts
const BUNDLE_MAGIC = "CDCB"
const BUNDLE_VERSION = 2
```

Header shape:

```ts
interface CanvasDesignClipboardBundleHeader {
	source: "canvas-design"
	version: 2
	payload: CanvasElementClipboardPayload
	files: Array<
		CanvasElementClipboardFileMetadata & {
			byteOffset: number
			byteLength: number
		}
	>
}
```

`byteOffset` is relative to the start of the file-bytes region, not the start of the whole bundle blob.

## Native MIME exposure policy

CanvasDesign internal paste must read the private bundle first. Native MIME types are only for external application interoperability.

| Scenario                    | Private bundle | Native exposure                                      |
| --------------------------- | -------------- | ---------------------------------------------------- |
| Multi-element copy          | Required       | None by default                                      |
| Single PNG image copy       | Required       | Optional `image/png`                                 |
| Single JPEG/WebP image copy | Required       | Optional converted `image/png`, not raw `image/jpeg` |
| Single video copy           | Required       | None by default                                      |
| Copy as PNG                 | Required       | `image/png`                                          |

Do not write `image/jpeg`, `image/webp`, `video/mp4`, or other non-baseline native MIME types unless `ClipboardItem.supports(type)` returns true and the product explicitly accepts the compatibility risk.

## Proposed `CanvasDesignClipboard` API

```ts
export interface CanvasDesignClipboardOptions {
	write?: (items: ClipboardItem[]) => Promise<void>
	read?: () => Promise<ClipboardItem[]>
}

export interface CanvasDesignClipboardNativeExposure {
	mimeType: "image/png"
	blob: Blob
}

export interface CanvasDesignClipboardBundleFile {
	metadata: CanvasElementClipboardFileMetadata
	blob: Blob
}

export interface CanvasDesignClipboardWriteBundleOptions {
	payload: CanvasElementClipboardPayload
	files: CanvasDesignClipboardBundleFile[]
	native?: CanvasDesignClipboardNativeExposure
	clipboard?: CanvasDesignClipboardOptions
}

export interface CanvasDesignClipboardReadBundleResult {
	payload: CanvasElementClipboardPayload
	files: CanvasElementClipboardFile[]
}

export class CanvasDesignClipboard {
	static read(options?: CanvasDesignClipboardOptions): Promise<ClipboardItem[] | null>

	static write(items: ClipboardItem[], options?: CanvasDesignClipboardOptions): Promise<void>

	static supports(type: string): boolean

	static writeBundle(options: CanvasDesignClipboardWriteBundleOptions): Promise<void>

	static readBundle(
		options?: CanvasDesignClipboardOptions,
	): Promise<CanvasDesignClipboardReadBundleResult | null>
}
```

`read` and `write` remain low-level browser adapter methods. New CanvasDesign protocol code should prefer `writeBundle` and `readBundle`.

## MIME support algorithm

`CanvasDesignClipboard.supports(type)` should follow this policy:

```ts
const BASELINE_MIME_TYPES = new Set(["text/plain", "text/html", "image/png", "text/uri-list"])

function supports(type: string): boolean {
	if (BASELINE_MIME_TYPES.has(type)) {
		return true
	}

	if (typeof ClipboardItem === "undefined" || typeof ClipboardItem.supports !== "function") {
		return false
	}

	return ClipboardItem.supports(type)
}
```

Before writing the private bundle:

```ts
if (!CanvasDesignClipboard.supports(CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE)) {
	throw new Error("CanvasDesign clipboard bundle MIME is not supported by this browser")
}
```

Before writing optional native exposure:

```ts
if (native && CanvasDesignClipboard.supports(native.mimeType)) {
	itemData[native.mimeType] = native.blob
}
```

For CanvasDesign internal copy/paste, unsupported bundle MIME should be a hard failure. Falling back to public text formats would leak metadata and violate protocol privacy.

## Write flow

1. `ClipboardManager` collects selected element data and source resource references (`payload.sourceCanvasId`, `sourceRef.src`, and OSS URL context).
2. `CanvasElementClipboard` builds `payload` and file metadata. For ordinary element copy, `payload.files` may contain media metadata while the bundle `files` array is empty.
3. `CanvasDesignClipboard.writeBundle` builds a binary bundle blob.
4. `CanvasDesignClipboard.writeBundle` creates exactly one `ClipboardItem`.
5. `CanvasDesignClipboard.write` calls host `write` or `navigator.clipboard.write`.
6. Native browser errors are logged and rethrown.

Expected log fields:

```ts
{
	event: "write-bundle:start",
	itemCount: 1,
	itemTypes: [["web application/x-canvas-design-clipboard-bundle", "image/png"]],
	elementCount: 2,
	fileCount: 2,
	hasNativeExposure: true,
	nativeMimeType: "image/png",
	bundleSize: 123456
}
```

## Read flow

1. `CanvasDesignClipboard.readBundle` reads clipboard items.
2. It finds the first item containing `CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE`.
3. It reads and parses the binary bundle.
4. It reconstructs `File` objects from byte ranges.
5. It returns payload plus files to `CanvasElementClipboard`.
6. `CanvasElementClipboard` decides whether the result is `canvas-elements`, `files`, `empty`, or `invalid`.

For canvas element paste, `ClipboardManager` should use inline bundle blobs only when present (for example copy-as-PNG or explicit native exposure). Otherwise it should use `CanvasElementClipboardFileMetadata.sourceRef.ossUrl` to download the original resource and then send it through the same upload path as drag/paste files. Download failures such as expired URLs or 404 responses must surface a user-facing hint instead of silently reusing a source URL from another canvas/project.

Same-canvas element paste is an element duplication operation, not a file migration. It should directly reuse the existing element `src` and skip download/upload. Cross-canvas paste should use a target-canvas remote transfer cache keyed by target canvas plus source canvas plus stable source path so repeated Ctrl/Cmd+V from canvas A into canvas B uploads each source resource once: while the first transfer is running, later pasted temporary elements attach to the same Promise; after completion, later pastes create elements directly with the cached target resource path. To cover repeated paste across tabs or windows for the same target canvas, persist completed transfer results to `localStorage` with TTL and load them back into memory cache on demand.

If no bundle exists, the parser can continue to external fallback paths:

1. `ClipboardEvent.clipboardData.files`;
2. `navigator.clipboard.read()` image/video items;
3. empty/invalid.

## Migration plan

### Step 1: Add bundle primitives

Add the following to `CanvasDesignClipboard.ts`:

- `CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE`;
- `supports(type)`;
- `createBundleBlob`;
- `parseBundleBlob`;
- `writeBundle`;
- `readBundle`.

No business behavior changes in this step.

### Step 2: Route writes through V2 bundle

Update `CanvasElementClipboard.createClipboardItems` or replace it with a clearer method name such as `writePayloadBundle`.

The new write path must produce one `ClipboardItem`.

### Step 3: Route reads through V2 bundle

Update `CanvasElementClipboard.parseClipboardContent` to prefer `CanvasDesignClipboard.readBundle`.

Keep external file fallback content-driven. Do not branch behavior by paste source.

### Step 4: Remove or isolate V1 multi-item protocol

After V2 is verified, stop writing:

```txt
web application/x-canvas-design-elements+json
web application/x-canvas-design-file
```

If needed, keep V1 read-only compatibility behind a clearly named legacy parser.

## Open decisions

1. Should unsupported private `web application/...` bundle MIME show a user-facing toast, or only log and fail copy?
2. Should single JPEG/WebP image copy convert to PNG for external paste by default, or only when using "copy as PNG"?
3. Should V1 multi-item reads be kept temporarily for local development sessions, or removed immediately during the refactor?
4. Should bundle size have a soft warning threshold before writing very large videos?
