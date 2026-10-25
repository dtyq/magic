import type { ExternalLogger, LogLevelLabel } from "../logger"
import type { FontMissPolicy, FontResolver } from "./font"
import type { ImagePolicy } from "../media/image-preflight"

export type { ImagePolicy } from "../media/image-preflight"

/** Slide configuration */
export interface SlideConfig {
	/** Design width in pixels */
	htmlWidth: number
	/** Design height in pixels */
	htmlHeight: number
	/** PPT Width in inches */
	slideWidth: number
	/** PPT Height in inches */
	slideHeight: number
}

/** Shared options for the destination-first streaming exporter. */
export interface StreamingOptionsBase {
	/** Output file name */
	fileName?: string
	/** Slide configuration overrides */
	config?: Partial<SlideConfig>
	/**
	 * Continue after page-local failures. Failed pages are represented by a
	 * diagnostic placeholder slide and reported through onExportIssue. Packaging,
	 * destination and finalization failures still stop the export.
	 */
	skipFailedPages?: boolean
	/**
	 * Auto-size mode switch (defaults to `false`, standard PPT mode).
	 *
	 * - `false` (default / PPT mode): output one page strictly using `config.slideWidth/slideHeight`,
	 *   overflowing content is clipped by the PPT page bounds, and the export size stays fixed independently of the design size.
	 * - `true` (auto-size mode): adapt to the actual HTML dimensions:
	 *   - when actual width exceeds `config.htmlWidth`, expand `slideWidth` to the maximum measured width
	 *   - when actual height exceeds `config.htmlHeight`, split into multiple PPT pages by `slideHeight`
	 *   - throw immediately if any page width exceeds PowerPoint's 56-inch single-page limit (5376px)
	 */
	autoSize?: boolean
	/**
	 * Callback invoked when resources such as images or video posters fail to load or are skipped.
	 * Failed resources do not stop export and are only used for user notification. The same resource may trigger multiple times, so callers should deduplicate if needed.
	 */
	onResourceLoadError?: (error: ResourceLoadError) => void
	onExportIssue?: (issue: ExportIssue) => void
	/** Minimum output level; logs below this level are ignored. Defaults to "info" */
	logLevel?: LogLevelLabel
	/** External logger. Passing console is supported; all methods are optional */
	logger?: ExternalLogger
	/** Font resolver. The package only reports used fonts; manifests, CDNs, and private paths are handled by the host application */
	fontResolver?: FontResolver
	/**
	 * Policy for missing fonts; defaults to 'fallback-with-warning'.
	 * - 'fallback-with-warning': skip that font and print a warning; embed the remaining fonts normally
	 * - 'no-embed': skip silently
	 * - 'fail': throw an error and stop export
	 */
	fontMissPolicy?: FontMissPolicy
}

/**
 * Options for the compatibility exporter used when a browser cannot provide
 * the File System Access/OPFS primitives required by the streaming pipeline.
 *
 * This is deliberately separate from `LargeExportOptions`: legacy export
 * creates a complete Blob in memory and never stages data in OPFS.
 */
export interface LegacyExportOptions extends StreamingOptionsBase {
	/** Export progress is reported with the same phases as the streaming API. */
	onProgress?: (progress: ExportProgress) => void
}

/** Result returned by the compatibility exporter before the host downloads it. */
export interface LegacyExportSummary {
	fileName: string
	pageCount: number
	bytesWritten: number
	data: Blob
}

/** Cancellable handle returned by the compatibility exporter. */
export interface LegacyExportHandle {
	promise: Promise<LegacyExportSummary>
	cancel: () => void
}

export interface ExportIssue {
	pageIndex?: number
	/** Stable source-page identity used to map diagnostics back to the originating HTML file. */
	pageKey?: string
	/** Optional human-readable source page name/path supplied by the host application. */
	pageName?: string
	pagePath?: string
	/** Optional host file id used when creating a structured project-file mention. */
	pageFileId?: string
	code: "page-script-error" | "resource-error" | "render-error"
	message: string
	severity: "warning" | "error"
	details?: Record<string, unknown>
}

/** Output policy used by the forward-only large export entry point. */
export type LargeExportOutputPolicy = "file-stream"

/** Byte counts may exceed Number.MAX_SAFE_INTEGER on a multi-GB/ZIP64 path. */
export type ByteCount = number | bigint

export type CapacityConfidence = "exact" | "upper-bound" | "streaming-unknown"

export type ZipMode = "classic" | "zip64"

/** A preflight diagnostic that can be shown before a long export starts. */
export interface PreflightIssue {
	code: string
	message: string
	severity: "warning" | "error"
	details?: Record<string, unknown>
}

/** Capability and capacity decision made before the first ZIP entry is written. */
export interface ExportPreflightResult {
	accepted: boolean
	outputPolicy: Exclude<LargeExportOutputPolicy, "auto">
	zipMode: ZipMode
	capacityConfidence: CapacityConfidence
	pageCount: number
	knownMinimumOutputBytes: ByteCount
	estimatedOutputBytes?: ByteCount
	estimatedZipEntries?: bigint
	estimatedCentralDirectoryBytes?: ByteCount
	estimatedScratchBytes?: ByteCount
	destinationCapacityKnown: boolean
	destinationAvailableBytes?: ByteCount
	destinationMaxFileBytes?: ByteCount
	centralDirectoryMode: "memory" | "spill"
	requiresOpfs: boolean
	requiresSlidePlan: boolean
	warnings: PreflightIssue[]
	errors: PreflightIssue[]
}

/** Coarse-grained stages reported without retaining page HTML or media payloads. */
export type ExportPhase =
	| "preflight"
	| "prepare-page"
	| "render-page"
	| "stage-media"
	| "package-page"
	| "finalize"
	| "completed"

/**
 * The last externally observable operation before an export failed.
 *
 * This is intentionally separate from ExportPhase: failure diagnostics also need to describe
 * picker/source/worker/sink failures that are not progress phases shown to users.
 */
export type ExportFailurePhase =
	| ExportPhase
	| "picker"
	| "source"
	| "media-fetch"
	| "transform-media"
	| "worker"
	| "sink-write"
	| "cleanup"
	| "unknown"

export type ExportFailureCode =
	| "cancelled"
	| "preflight-rejected"
	| "opfs-unavailable"
	| "source-failed"
	| "prepare-page-failed"
	| "render-page-failed"
	| "media-fetch-failed"
	| "media-transform-failed"
	| "package-page-failed"
	| "worker-failed"
	| "sink-write-failed"
	| "finalize-failed"
	| "cleanup-failed"
	| "fidelity-failed"
	| "unknown"

/** Structured information attached to a failed export for metrics and support diagnostics. */
export interface ExportFailureDiagnostic {
	phase: ExportFailurePhase
	code: ExportFailureCode
	message: string
	recoverable: boolean
	cancelled: boolean
	fileName?: string
	pageIndex?: number
	pageCount?: number
	bytesWritten?: number
	outputPolicy?: Exclude<LargeExportOutputPolicy, "auto">
	mediaPolicyMode?: Exclude<NonNullable<MediaPolicy["mode"]>, "auto">
	zipMode?: ZipMode
	details?: Record<string, unknown>
}

/** Metadata describing the actual large-export execution path. */
export interface ExportExecutionInfo {
	outputPolicy: Exclude<LargeExportOutputPolicy, "auto">
	mediaPolicyMode: Exclude<NonNullable<MediaPolicy["mode"]>, "auto">
	zipMode: ZipMode
	pipeline: "direct" | "staged"
}

/** Progress information safe to retain in application state or logs. */
export interface ExportProgress {
	phase: ExportPhase
	pageIndex?: number
	pageCount?: number
	resourceIndex?: number
	resourceCount?: number
	bytesRead?: number
	bytesWritten?: number
	estimatedTotalBytes?: number
}

/** Writable destination used when the browser cannot transfer a WritableStream directly. */
export interface PptxOutputSink {
	write: (chunk: Uint8Array) => void | Promise<void>
	close: () => void | Promise<void>
	abort?: (reason?: unknown) => void | Promise<void>
}

/**
 * Minimal Node-compatible writable contract accepted by the streaming exporter.
 *
 * This intentionally describes the runtime shape instead of exposing the
 * Node-specific writable namespace from the public declaration. Browser-only
 * TypeScript consumers can therefore import `PptxDestination` without also
 * installing `@types/node`, while native Node streams remain structurally
 * compatible with the contract.
 */
export interface NodeWritable {
	write(chunk: Uint8Array, callback?: (error?: Error | null) => void): boolean
	end(callback?: () => void): this
	on(event: string, listener: (...args: any[]) => void): this
	once?(event: string, listener: (...args: any[]) => void): this
	removeListener?(event: string, listener: (...args: any[]) => void): this
	destroy?(error?: Error): void
}

/**
 * Destination selected by the host while the original click activation is still valid.
 * Wrapper variants are structured-clone friendly and can be forwarded to a packaging Worker.
 */
export type PptxDestination =
	| WritableStream<Uint8Array>
	| NodeWritable
	| PptxOutputSink
	| { kind: "transferable-stream"; writable: WritableStream<Uint8Array> }
	| { kind: "writable-stream"; writable: WritableStream<Uint8Array> }
	| { kind: "node-writable"; writable: NodeWritable }
	| {
			kind: "sink-proxy"
			sink: PptxOutputSink
			ackWindow?: number
			/** Whether this host-owned buffered sink may use in-memory replay staging. */
			replayPolicy?: "buffered" | "opfs-required"
	  }

/**
 * How media should be read or staged before it is committed to the package.
 * In the two-pass SlideIR path, `auto` (the default) rolling-stages URL media
 * while each page is collected so short-lived signed URLs do not expire before
 * replay. Use `direct-stream` only when every URL is known to remain valid.
 */
export interface MediaPolicy {
	mode?: "auto" | "direct-stream" | "rolling-stage" | "full-stage"
	maxInlineBytes?: number
	readConcurrency?: number
	transformConcurrency?: number
}

/** Scratch-storage behavior for page IR and media transformations. */
export interface StagingPolicy {
	mode?: "auto" | "none" | "opfs"
	cleanup?: "always" | "on-success" | "on-error" | "never"
	directory?: string
}

/** A page yielded to the streaming export pipeline. */
export interface StreamingHtmlPage {
	index: number
	html: string
	/** Optional stable business identity used during planning and replay. */
	key?: string
	/** Optional source metadata retained with diagnostics for host UI repair flows. */
	pageName?: string
	pagePath?: string
	pageFileId?: string
}

export type StreamingHtmlPageInput = string | StreamingHtmlPage

/**
 * Streaming export content may be provided lazily instead of as an in-memory array.
 * AsyncIterable is the intended path for hundreds of pages.
 */
export type StreamingExportContent =
	| string
	| readonly string[]
	| Iterable<StreamingHtmlPageInput>
	| AsyncIterable<StreamingHtmlPageInput>

/** Options for exportPPTXStreaming; page progress intentionally never contains HTML. */
export interface LargeExportOptions extends StreamingOptionsBase {
	mode?: "large"
	outputPolicy?: "file-stream"
	/** Destination selected by the host before any asynchronous export work begins. */
	destination: PptxDestination
	/**
	 * URL for the browser Packaging Worker module.
	 *
	 * The ESM build produced by this package can resolve its generated worker
	 * asset when `dist/assets/` remains beside `dist/index.js`. For CJS browser
	 * consumers, non-Vite bundlers, direct script loading, CDN deployments, or
	 * any deployment that relocates assets, automatic resolution is not a
	 * contract: pass an absolute URL (or a host-owned Worker via `workerFactory`)
	 * instead. A relative string is resolved against the document URL.
	 */
	workerUrl?: string | URL
	/** Known source page count when the AsyncIterable cannot expose it itself. */
	pageCount?: number
	onProgress?: (progress: ExportProgress) => void
	mediaPolicy?: MediaPolicy
	/** Descriptor-only image safety policy for large exports. */
	imagePolicy?: ImagePolicy
	stagingPolicy?: StagingPolicy
	compression?: boolean
}

/** Result returned after a forward-only export closes its destination. */
export interface ExportSummary {
	fileName: string
	pageCount: number
	mediaPartCount: number
	bytesWritten: number
	durationMs: number
	/** Execution metadata emitted by the built-in streaming runner. */
	execution?: ExportExecutionInfo
}

/** Cancellable handle returned by exportPPTXStreaming. */
export interface StreamingExportHandle {
	promise: Promise<ExportSummary>
	cancel: () => void
}

/** Resource load failure information */
export interface ResourceLoadError {
	/** Resource URL, possibly truncated */
	url: string
	/** Resource kind, such as image, video, script, or style */
	kind: string
	/** Failure reason: timeout or load error */
	reason: "timeout" | "load-error"
	/** Safe, truncated diagnostic suitable for UI/support logs; never contains response bodies. */
	message?: string
	status?: number
	contentType?: string
}
