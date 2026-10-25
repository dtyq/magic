import type {
	ExportProgress,
	ExportSummary,
	ExportIssue,
	LargeExportOptions,
	PptxDestination,
	ResourceLoadError,
	SlideConfig,
	StreamingExportContent,
	StreamingExportHandle,
	StreamingHtmlPage,
} from "./api/options"
import { configureLogger, resetLogger } from "./logger"
import { createAbortError } from "./sandbox/abort"
import { HtmlRenderSandbox, type SandboxInstance } from "./sandbox"
import { DEFAULT_CONFIG } from "./shared/unit"
import { runStreamingExport } from "./pipeline/streaming-export"
import type { Html2PptxRuntime } from "./runtime"
import { normalizePptxExportError } from "./errors"

/** Input contract for the optional runtime-owned large export implementation. */
export interface StreamingExportTaskInput {
	config: SlideConfig
	fileName: string
	pages: AsyncIterable<StreamingHtmlPage>
	pageCount?: number
	sandbox: SandboxInstance
	signal: AbortSignal
	skipFailedPages: boolean
	autoSize: boolean
	onResourceError?: (error: ResourceLoadError) => void
	onExportIssue?: (issue: ExportIssue) => void
	onProgress?: (progress: ExportProgress) => void
	fontResolver?: LargeExportOptions["fontResolver"]
	fontMissPolicy?: LargeExportOptions["fontMissPolicy"]
	outputPolicy?: LargeExportOptions["outputPolicy"]
	destination: PptxDestination
	workerUrl?: LargeExportOptions["workerUrl"]
	mediaPolicy?: LargeExportOptions["mediaPolicy"]
	imagePolicy?: LargeExportOptions["imagePolicy"]
	stagingPolicy?: LargeExportOptions["stagingPolicy"]
	compression?: boolean
	pipeline?: Html2PptxRuntime["pipeline"]
}

/** Runtime hook implemented by the streaming page/IR/packaging pipeline. */
export type StreamingExportRunner = (input: StreamingExportTaskInput) => Promise<ExportSummary>

/** Optional streaming additions accepted by createPptxStreamingExporter(). */
export interface StreamingExportPipelineRuntime {
	/** Preferred hook name. It must consume pages serially and close/abort the destination. */
	exportStreaming?: StreamingExportRunner
}

export type Html2PptxStreamingRuntime = Omit<Html2PptxRuntime, "pipeline"> & {
	pipeline?: NonNullable<Html2PptxRuntime["pipeline"]> & StreamingExportPipelineRuntime
}

function getStreamingExportConfig(options?: LargeExportOptions) {
	return { ...DEFAULT_CONFIG, ...options?.config }
}

/**
 * Create a cancellable destination-first exporter. This entry never
 * buffers an AsyncIterable into string[] and never falls back to a final Blob.
 */
export function createPptxStreamingExporter(runtime: Html2PptxStreamingRuntime = {}) {
	return function exportPPTXStreaming(
		content: StreamingExportContent,
		options: LargeExportOptions,
	): StreamingExportHandle {
		const controller = new AbortController()
		const promise = runStreamingExportPipeline(content, options, controller.signal, runtime)
		return { promise, cancel: () => controller.abort() }
	}
}

/** Export an AsyncIterable page source to a caller-selected streaming destination. */
export const exportPPTXStreaming = createPptxStreamingExporter()

/** Compatibility Blob exporter for browsers without File System Access/OPFS. */
export { createPptxLegacyExporter, exportPPTXLegacy } from "./pipeline/legacy-export"
export { detectImageContentType, validateImageBlobResponse } from "./media/image-response"
export {
	createBufferedPptxSink,
	PPTX_MIME_TYPE,
	type BufferedPptxSink,
} from "./packaging/buffered-sink"
export { createInMemoryStreamingStagingStore } from "./packaging/in-memory-staging-store"
export type { InMemoryStreamingStagingStoreOptions } from "./packaging/in-memory-staging-store"

async function runStreamingExportPipeline(
	content: StreamingExportContent,
	options: LargeExportOptions,
	signal: AbortSignal,
	runtime: Html2PptxStreamingRuntime,
): Promise<ExportSummary> {
	configureLogger({
		minLevel: options?.logLevel,
		logger: options?.logger,
	})

	let sandbox: SandboxInstance | undefined
	let runnerOwnsDestination = false
	try {
		throwIfStreamingAborted(signal)
		const config = getStreamingExportConfig(options)
		const fileName = options?.fileName ?? "export.pptx"
		const pageCount = options?.pageCount ?? getKnownStreamingPageCount(content)
		options?.onProgress?.({ phase: "preflight", pageCount })

		// Validate the host-selected destination before resolving an injected runner. Otherwise a
		// custom runtime could bypass the built-in preflight gate and report a false success.
		const destination = requireStreamingDestination(options, pageCount)
		const runner = runtime.pipeline?.exportStreaming ?? runStreamingExport

		sandbox = runtime.createSandbox
			? runtime.createSandbox(config)
			: new HtmlRenderSandbox(config, {
					ReadyController: runtime.sandboxReadyController,
				})

		const runnerPromise = runner({
			config,
			fileName,
			pages: iterateStreamingHtmlPages(content, signal),
			pageCount,
			sandbox,
			signal,
			skipFailedPages: options?.skipFailedPages ?? false,
			autoSize: options?.autoSize ?? false,
			onResourceError: options?.onResourceLoadError,
			onExportIssue: options?.onExportIssue,
			onProgress: options?.onProgress,
			fontResolver: options?.fontResolver,
			fontMissPolicy: options?.fontMissPolicy,
			outputPolicy: options?.outputPolicy,
			destination,
			workerUrl: options?.workerUrl,
			mediaPolicy: options?.mediaPolicy,
			imagePolicy: options?.imagePolicy,
			stagingPolicy: options?.stagingPolicy,
			compression: options?.compression,
			pipeline: runtime.pipeline,
		})
		runnerOwnsDestination = true
		const summary = await runnerPromise
		// Once the runner resolves, finalize has closed the destination. A cancel
		// racing with this continuation must not turn a completed file into failure.
		options?.onProgress?.({
			phase: "completed",
			pageCount: summary.pageCount,
			bytesWritten: summary.bytesWritten,
		})
		return summary
	} catch (error) {
		if (!runnerOwnsDestination) {
			await abortUnclaimedPptxDestination(options?.destination, error)
		}
		throw error
	} finally {
		sandbox?.destroy()
		if (options?.logLevel || options?.logger) resetLogger()
	}
}

/** Keep the public destination contract strict while preserving the structured preflight error. */
function requireStreamingDestination(
	options: LargeExportOptions | undefined,
	pageCount: number | undefined,
): PptxDestination {
	const destination = options?.destination
	if (destination) return destination

	throw normalizePptxExportError(
		new Error(
			"[exportPPTXStreaming] Preflight failed: Choose a save destination before starting a large export.",
		),
		{
			phase: "preflight",
			code: "preflight-rejected",
			fileName: options?.fileName ?? "export.pptx",
			pageCount,
			outputPolicy: "file-stream",
			details: {
				issues: [{ code: "destination-required", severity: "error" }],
			},
		},
	)
}

/** Abort a selected destination if setup fails before the streaming runner takes ownership. */
async function abortUnclaimedPptxDestination(
	destination: PptxDestination | undefined,
	reason: unknown,
): Promise<void> {
	if (!destination) return
	try {
		const wrapped = destination as {
			kind?: string
			writable?: { abort?: (reason?: unknown) => void | Promise<void>; destroy?: unknown }
			sink?: { abort?: (reason?: unknown) => void | Promise<void> }
			abort?: (reason?: unknown) => void | Promise<void>
			destroy?: (error?: Error) => void
		}
		if (wrapped.kind === "sink-proxy") {
			await wrapped.sink?.abort?.(reason)
			return
		}
		if (wrapped.kind === "writable-stream" || wrapped.kind === "transferable-stream") {
			await wrapped.writable?.abort?.(reason)
			return
		}
		if (wrapped.kind === "node-writable") {
			const destroy = wrapped.writable?.destroy
			if (typeof destroy === "function") {
				destroy.call(
					wrapped.writable,
					reason instanceof Error
						? reason
						: new Error(String(reason ?? "Export aborted")),
				)
			}
			return
		}
		if (typeof wrapped.abort === "function") {
			await wrapped.abort(reason)
			return
		}
		wrapped.destroy?.(
			reason instanceof Error ? reason : new Error(String(reason ?? "Export aborted")),
		)
	} catch {
		// Preserve the setup error that prevented the runner from taking ownership.
	}
}

function getKnownStreamingPageCount(content: StreamingExportContent): number | undefined {
	if (typeof content === "string") return 1
	if (Array.isArray(content)) return content.length
	return undefined
}

/** Normalize compatibility inputs lazily so the runtime owns at most one prepared page at a time. */
async function* iterateStreamingHtmlPages(
	content: StreamingExportContent,
	signal: AbortSignal,
): AsyncIterable<StreamingHtmlPage> {
	if (typeof content === "string") {
		throwIfStreamingAborted(signal)
		yield { index: 0, html: content }
		return
	}

	let sourceIndex = 0
	for await (const page of content) {
		throwIfStreamingAborted(signal)
		if (typeof page === "string") {
			yield { index: sourceIndex, html: page }
		} else if (page && typeof page.html === "string") {
			yield page
		} else {
			throw new TypeError(
				"[exportPPTXStreaming] Each page must be an HTML string or { index, html } object",
			)
		}
		sourceIndex += 1
	}
	throwIfStreamingAborted(signal)
}

function throwIfStreamingAborted(signal: AbortSignal): void {
	if (signal.aborted) throw createAbortError()
}

export type {
	SlideConfig,
	ResourceLoadError,
	ExportIssue,
	ExportPhase,
	ExportPreflightResult,
	ExportProgress,
	ExportSummary,
	ExportExecutionInfo,
	ExportFailureCode,
	ExportFailureDiagnostic,
	ExportFailurePhase,
	ByteCount,
	CapacityConfidence,
	LargeExportOptions,
	LargeExportOutputPolicy,
	MediaPolicy,
	NodeWritable,
	PptxDestination,
	PptxOutputSink,
	PreflightIssue,
	StagingPolicy,
	StreamingExportContent,
	StreamingExportHandle,
	LegacyExportHandle,
	LegacyExportOptions,
	LegacyExportSummary,
	StreamingOptionsBase,
	StreamingHtmlPage,
	StreamingHtmlPageInput,
	ZipMode,
} from "./api/options"
export type {
	ImagePolicy,
	ImagePreflightAction,
	ImagePreflightDecision,
	ImagePreflightPolicy,
	ImagePreflightReason,
	ImagePreflightRejectAction,
	ImageTransformDescriptor,
	ImageTransformDescriptorInput,
	ImageTransformDescriptorResult,
} from "./media/image-preflight"
export { imagePolicyRequiresReplay, preflightPptImage } from "./media/image-preflight"
export {
	MAX_INLINE_MEDIA_BYTES,
	bytesMediaSourceDescriptor,
	createMediaSourceDescriptor,
	mediaSourceDescriptorFromBytes,
	normalizeMediaSourceDescriptor,
	withMediaSourceKey,
} from "./media/source-descriptor"
export type {
	BlobMediaSourceDescriptor,
	BytesMediaSourceDescriptor,
	MediaMetadataOrigin,
	MediaSourceDescriptor,
	MediaSourceDescriptorBase,
	OpfsMediaSourceDescriptor,
	PathMediaSourceDescriptor,
	UrlMediaSourceDescriptor,
} from "./media/source-descriptor"
export { preflightPptxExport, type PreflightOptions } from "./api/preflight"
export {
	resolveStreamingMediaPolicyMode,
	type ResolveMediaPolicyModeOptions,
	type ResolvedMediaPolicyMode,
} from "./api/strategy"
export type { EmbedFontInput, FontMissPolicy, FontResolver, UsedFont } from "./api/font"
export { DEFAULT_CONFIG } from "./shared/unit"
export {
	ExportFidelityError,
	createOpfsUnavailableError,
	isOpfsUnavailableError,
	isExportFidelityError,
	PptxExportError,
	isPptxExportError,
	getPptxExportDiagnostic,
	normalizePptxExportError,
} from "./errors"
export type { ExportFidelityFailureKind, PptxExportErrorContext } from "./errors"
export { LogLevel } from "./logger"
export type { ExternalLogger } from "./logger"
