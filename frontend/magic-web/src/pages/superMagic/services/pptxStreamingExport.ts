import {
	createBufferedPptxSink,
	exportPPTXLegacy,
	exportPPTXStreaming,
	imagePolicyRequiresReplay,
	isOpfsUnavailableError,
	PPTX_MIME_TYPE,
} from "@magic/html2pptx"
import type {
	ExportProgress,
	LargeExportOptions,
	PptxDestination,
	PptxOutputSink,
	StreamingExportContent,
	StreamingExportHandle,
	StreamingHtmlPage,
	StreamingHtmlPageInput,
} from "@magic/html2pptx"
import { prepareHtmlForExport } from "@/utils/htmlExportPrepare"
import {
	resolvePptxExportStrategy,
	resolvePptxMediaPolicyMode,
	type PptxExportStrategyDecision,
	type PptxExportStrategyInput,
} from "./pptxExportStrategy"

export {
	DEFAULT_PPTX_EXPORT_FEATURE_FLAGS,
	PPTX_EXPORT_FLAGS_STORAGE_KEY,
	PPTX_EXPORT_ROUTING_LIMITS,
	resolvePptxExportFeatureFlags,
	resolvePptxExportStrategy,
	resolvePptxMediaPolicyMode,
} from "./pptxExportStrategy"
export type {
	PptxExportFeatureFlags,
	PptxExportRoute,
	PptxExportStrategyDecision,
	PptxExportStrategyInput,
	PptxExportStrategyReasonCode,
	PptxMediaSourceReliability,
	ResolvedPptxMediaPolicyMode,
} from "./pptxExportStrategy"

/** File System Access picker options kept local because lib.dom does not expose the picker yet. */
interface SaveFilePickerOptions {
	suggestedName?: string
	types?: Array<{
		description?: string
		accept: Record<string, string[]>
	}>
	excludeAcceptAllOption?: boolean
}

interface SaveFilePickerGlobal {
	showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
}

export interface PptxDestinationLease {
	destination: PptxDestination
	abort: (reason?: unknown) => Promise<void>
	route?: "file-stream" | "buffered-download" | "legacy-blob"
}

type WritablePptxFile = Pick<FileSystemWritableFileStream, "write" | "close" | "abort">

const legacyPptxDestinations = new WeakSet<object>()
let opfsCapability: boolean | undefined
let opfsProbePromise: Promise<boolean> | null = null

export interface OpenPptxDestinationOptions {
	suggestedName: string
}

/** Structured application-level failure returned before expensive export work starts. */
export class PptxExportUnavailableError extends Error {
	readonly name = "PptxExportUnavailableError"
	readonly code: PptxExportStrategyDecision["reasonCode"]

	constructor(readonly decision: PptxExportStrategyDecision) {
		super(decision.reason)
		this.code = decision.reasonCode
	}
}

type HtmlExportPreparationOptions = Omit<Parameters<typeof prepareHtmlForExport>[0], "content">

export type PptxStreamingPageSourceFactory = (
	signal: AbortSignal,
) => AsyncIterable<StreamingHtmlPageInput>

/** Stable business-facing alias used by batch and single-target exporters. */
export type StreamingPageFactory = PptxStreamingPageSourceFactory

export type PptxStreamingOptionsResolver =
	| LargeExportOptions
	| ((firstPage: StreamingHtmlPage) => LargeExportOptions | Promise<LargeExportOptions>)

export interface PeekedAsyncIterable<T> {
	first: T
	replay: AsyncIterable<T>
	close: (reason?: unknown) => Promise<void>
}

/**
 * Return a stable `.pptx` filename without changing names that already carry the extension.
 */
export function ensurePptxFileName(fileName: string): string {
	const trimmed = fileName.trim() || "export"
	return /\.pptx$/i.test(trimmed) ? trimmed : `${trimmed}.pptx`
}

/**
 * Whether the current browser can open a user-selected writable destination.
 *
 * This check is intentionally capability based. User-agent checks are not sufficient for
 * Chromium desktop shells and can incorrectly advertise a path that cannot be written.
 */
export function supportsPptxFileStreaming(input: PptxExportStrategyInput = {}): boolean {
	return getPptxExportStrategy(input).route === "streaming"
}

/** Whether a client-side PPTX export route is available, including the legacy Blob fallback. */
export function supportsPptxExport(input: PptxExportStrategyInput = {}): boolean {
	return getPptxExportStrategy(input).route !== "unavailable"
}

/** Resolve the current route once so callers can log the selected destination capability. */
export function getPptxExportStrategy(
	input: PptxExportStrategyInput = {},
): PptxExportStrategyDecision {
	return resolvePptxExportStrategy({
		...input,
		fileStreamingAvailable: input.fileStreamingAvailable ?? hasFileStreamingCapability(),
	})
}

/** Throw a structured error when a known large export has no safe client-side route. */
export function assertPptxExportAvailable(
	input: PptxExportStrategyInput = {},
): PptxExportStrategyDecision {
	const decision = getPptxExportStrategy(input)
	if (decision.route === "unavailable") throw new PptxExportUnavailableError(decision)
	return decision
}

/**
 * Open the final destination while the original click activation is still alive.
 *
 * The returned sink deliberately exposes only `Uint8Array` writes. This keeps the browser
 * file handle on the application side while the packaging pipeline applies ACK/backpressure.
 * A cancelled picker returns `null` and does not create a partial file.
 */
export async function openPptxDestination(
	options: OpenPptxDestinationOptions,
): Promise<PptxDestinationLease | null> {
	const picker = (globalThis as SaveFilePickerGlobal).showSaveFilePicker
	if (!picker || opfsCapability === false) {
		if (!supportsBufferedPptxDownload()) return null
		return createPptxLegacyDestinationLease()
	}
	// Never await an unknown capability probe before opening the picker: doing so
	// can consume the user-activation required by File System Access. The probe is
	// warmed when this module loads and runtime OPFS errors still retry via legacy.
	if (opfsCapability === undefined && hasOpfsApi()) void supportsOpfsStaging()

	let handle: FileSystemFileHandle
	try {
		handle = await picker({
			suggestedName: ensurePptxFileName(options.suggestedName),
			types: [
				{
					description: "PowerPoint presentation",
					accept: {
						"application/vnd.openxmlformats-officedocument.presentationml.presentation":
							[".pptx"],
					},
				},
			],
			excludeAcceptAllOption: true,
		})
	} catch (error) {
		if (isAbortError(error)) return null
		throw error
	}

	try {
		return createPptxDestinationLease(await handle.createWritable())
	} catch (error) {
		// Some browser shells expose the picker but reject createWritable(). Keep the
		// same Worker/media pipeline and fall back to a normal Blob download instead
		// of routing the export through a renderer that bypasses enterprise hooks.
		if (supportsBufferedPptxDownload()) {
			return createPptxBufferedDestinationLease(options.suggestedName)
		}
		throw error
	}
}

/**
 * Collect streamed PPTX chunks in the browser and trigger a normal download on close.
 * Kept for callers that explicitly need a buffered sink; automatic browser fallback uses
 * `createPptxLegacyDestinationLease` so it never enters the streaming/OPFS pipeline.
 */
export function createPptxBufferedDestinationLease(suggestedName: string): PptxDestinationLease {
	const fileName = ensurePptxFileName(suggestedName)
	const buffered = createBufferedPptxSink(PPTX_MIME_TYPE)
	let settled = false
	let closeOperation: Promise<void> | null = null
	let abortOperation: Promise<void> | null = null

	const close = (): Promise<void> => {
		if (settled) return Promise.resolve()
		if (abortOperation) return abortOperation
		if (closeOperation) return closeOperation

		const operation = (async () => {
			try {
				await buffered.sink.close()
				triggerPptxBlobDownload(buffered.getBlob(), fileName)
				settled = true
			} catch (error) {
				await buffered.sink.abort?.(error)
				settled = true
				throw error
			} finally {
				closeOperation = null
			}
		})()
		closeOperation = operation
		return operation
	}

	const abort = (reason?: unknown): Promise<void> => {
		if (settled) return Promise.resolve()
		if (abortOperation) return abortOperation

		const operation = (async () => {
			try {
				await buffered.sink.abort?.(reason)
				settled = true
			} finally {
				abortOperation = null
			}
		})()
		abortOperation = operation
		return operation
	}

	const sink: PptxOutputSink = {
		write: async (chunk) => {
			if (settled || closeOperation || abortOperation) {
				throw new Error("PPTX buffered destination is already closing or closed")
			}
			await buffered.sink.write(chunk)
		},
		close,
		abort,
	}

	return {
		destination: { kind: "sink-proxy", sink, replayPolicy: "buffered" },
		abort,
		route: "buffered-download",
	}
}

/** Marker destination used to select the true legacy Blob engine. */
function createPptxLegacyDestinationLease(): PptxDestinationLease {
	const sink: PptxOutputSink = {
		write: () => undefined,
		close: () => undefined,
		abort: () => undefined,
	}
	const destination = { kind: "sink-proxy" as const, sink, legacy: true }
	legacyPptxDestinations.add(destination)
	return {
		destination,
		abort: async () => undefined,
		route: "legacy-blob",
	}
}

function isLegacyPptxDestination(destination: PptxDestination): boolean {
	return (
		typeof destination === "object" &&
		destination !== null &&
		legacyPptxDestinations.has(destination as object)
	)
}

/** Probe OPFS once per tab. Presence of the API alone is insufficient in Safari/private contexts. */
async function supportsOpfsStaging(): Promise<boolean> {
	if (opfsCapability !== undefined) return opfsCapability
	if (opfsProbePromise) return opfsProbePromise
	opfsProbePromise = (async () => {
		let root: FileSystemDirectoryHandle | undefined
		let directoryName: string | undefined
		try {
			const storage = (globalThis as { navigator?: Navigator }).navigator?.storage as
				| (StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> })
				| undefined
			if (!storage || typeof storage.getDirectory !== "function") return false
			root = await storage.getDirectory()
			directoryName = `magic-pptx-probe-${Math.random().toString(36).slice(2)}`
			const directory = await root.getDirectoryHandle(directoryName, { create: true })
			const file = await directory.getFileHandle("probe", { create: true })
			const writable = await file.createWritable()
			await writable.write(new Uint8Array([1]))
			await writable.close()
			return true
		} catch {
			return false
		} finally {
			if (root && directoryName) {
				await root.removeEntry(directoryName, { recursive: true }).catch(() => undefined)
			}
			opfsProbePromise = null
		}
	})()
	opfsCapability = await opfsProbePromise
	return opfsCapability
}

function hasOpfsApi(): boolean {
	const storage = (globalThis as { navigator?: Navigator }).navigator?.storage as
		{ getDirectory?: unknown } | undefined
	return typeof storage?.getDirectory === "function"
}

function supportsBufferedPptxDownload(): boolean {
	return (
		typeof Blob === "function" &&
		typeof URL !== "undefined" &&
		typeof URL.createObjectURL === "function" &&
		typeof document !== "undefined" &&
		typeof document.createElement === "function"
	)
}

function triggerPptxBlobDownload(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = fileName
	anchor.rel = "noopener"
	anchor.style.display = "none"
	document.body?.appendChild(anchor)
	anchor.click()
	anchor.remove()
	// Keep the object URL alive for the browser's asynchronous download hand-off.
	setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Adapt a File System Access writable into the ACK sink consumed by html2pptx.
 * Close is not considered terminal until it succeeds, so a failed commit can
 * still be followed by abort() to discard the partially written destination.
 */
export function createPptxDestinationLease(writable: WritablePptxFile): PptxDestinationLease {
	let settled = false
	let closeOperation: Promise<void> | null = null
	let abortOperation: Promise<void> | null = null

	const close = (): Promise<void> => {
		if (settled) return Promise.resolve()
		if (abortOperation) return abortOperation
		if (closeOperation) return closeOperation

		const operation = (async () => {
			try {
				await writable.close()
				settled = true
			} finally {
				closeOperation = null
			}
		})()
		closeOperation = operation
		return operation
	}

	const abort = (reason?: unknown): Promise<void> => {
		if (settled) return Promise.resolve()
		if (abortOperation) return abortOperation

		// Abort is intentionally allowed while close is pending. WritableStream
		// semantics will serialize the underlying operations and discard the file
		// when cancellation wins the race.
		const operation = (async () => {
			try {
				await writable.abort(reason)
				settled = true
			} finally {
				abortOperation = null
			}
		})()
		abortOperation = operation
		return operation
	}

	const sink: PptxOutputSink = {
		write: async (chunk) => {
			if (settled || closeOperation || abortOperation) {
				throw new Error("PPTX destination is already closing or closed")
			}
			await writable.write(chunk)
		},
		close,
		abort,
	}

	return {
		destination: { kind: "sink-proxy", sink, replayPolicy: "opfs-required" },
		abort,
		route: "file-stream",
	}
}

/**
 * Start a streaming export with a destination selected by the caller. The function is kept
 * small so business entry points can open the picker before their first asynchronous fetch,
 * then pass the page provider directly to html2pptx without creating a page array or Blob.
 */
export function startPptxStreamingExport(
	content: StreamingExportContent,
	options: LargeExportOptions,
): StreamingExportHandle {
	if (isLegacyPptxDestination(options.destination)) {
		const controller = new AbortController()
		const handle = startLegacyBlobExport(
			normalizeStreamingPages(
				typeof content === "string" ? [content] : content,
				controller.signal,
			),
			options,
			controller.signal,
		)
		return {
			promise: handle.promise,
			cancel: () => {
				controller.abort(createPptxAbortError())
				handle.cancel()
			},
		}
	}
	return exportPPTXStreaming(content, withResolvedMediaPolicy(options))
}

/**
 * Start a large export from a signal-aware lazy page source. The source is peeked once before the
 * Packaging Worker starts so an options resolver can derive the presentation layout from the
 * first page without materializing the remaining pages.
 */
export function startPptxStreamingExportFromFactory(
	createPages: StreamingPageFactory,
	optionsOrResolver: PptxStreamingOptionsResolver,
): StreamingExportHandle {
	const sourceController = new AbortController()
	let activeHandle: StreamingExportHandle | null = null
	let closeSource: ((reason?: unknown) => Promise<void>) | null = null
	let firstPage: StreamingHtmlPage | null = null

	const promise = (async () => {
		let peeked: Awaited<ReturnType<typeof peekStreamingPage>> | null = await peekStreamingPage(
			createPages(sourceController.signal),
			sourceController.signal,
		)
		const close = peeked.close
		closeSource = close
		firstPage = peeked.firstPage
		const pages = peeked.pages
		peeked = null

		try {
			let resolverPage: StreamingHtmlPage | null = firstPage
			if (!resolverPage) throw new Error("PPTX page source did not yield any pages")
			let options: LargeExportOptions
			if (typeof optionsOrResolver === "function") {
				const pendingOptions = Promise.resolve(optionsOrResolver(resolverPage))
				resolverPage = null
				firstPage = null
				options = await waitForAbortable(pendingOptions, sourceController.signal)
			} else {
				resolverPage = null
				firstPage = null
				options = optionsOrResolver
			}
			// The replay source now owns the first page until its first yield is consumed.
			// Do not retain a second business-layer reference for the remainder of the export.
			throwIfAborted(sourceController.signal)

			if (isLegacyPptxDestination(options.destination)) {
				activeHandle = startLegacyBlobExport(pages, options, sourceController.signal)
			} else {
				activeHandle = exportPPTXStreaming(pages, withResolvedMediaPolicy(options))
			}
			if (sourceController.signal.aborted) activeHandle.cancel()
			try {
				return await activeHandle.promise
			} catch (error) {
				if (
					isLegacyPptxDestination(options.destination) ||
					!isOpfsUnavailableError(error)
				) {
					throw error
				}
				// Capability probes can race with privacy/storage policy changes. Recreate
				// the source and retry once with the independent legacy engine.
				opfsCapability = false
				await close(error).catch(() => undefined)
				const fallbackPages = normalizeStreamingPages(
					createPages(sourceController.signal),
					sourceController.signal,
				)
				activeHandle = startLegacyBlobExport(
					fallbackPages,
					options,
					sourceController.signal,
				)
				return await activeHandle.promise
			}
		} finally {
			firstPage = null
			await close(sourceController.signal.reason).catch(() => undefined)
		}
	})()

	return {
		promise,
		cancel: () => {
			const reason = createPptxAbortError()
			if (!sourceController.signal.aborted) sourceController.abort(reason)
			void closeSource?.(reason).catch(() => undefined)
			activeHandle?.cancel()
		},
	}
}

function startLegacyBlobExport(
	pages: AsyncIterable<StreamingHtmlPage>,
	options: LargeExportOptions,
	signal: AbortSignal,
): StreamingExportHandle {
	const handle = exportPPTXLegacy(pages, {
		fileName: options.fileName,
		config: options.config,
		autoSize: options.autoSize,
		skipFailedPages: options.skipFailedPages,
		fontResolver: options.fontResolver,
		fontMissPolicy: options.fontMissPolicy,
		logger: options.logger,
		logLevel: options.logLevel,
		onResourceLoadError: options.onResourceLoadError,
		onExportIssue: options.onExportIssue,
		onProgress: options.onProgress,
	})
	const promise = handle.promise.then((result) => {
		triggerPptxBlobDownload(result.data, result.fileName)
		return {
			fileName: result.fileName,
			pageCount: result.pageCount,
			mediaPartCount: 0,
			bytesWritten: result.bytesWritten,
			durationMs: 0,
			execution: {
				outputPolicy: "file-stream" as const,
				mediaPolicyMode: "direct-stream" as const,
				zipMode: "classic" as const,
				pipeline: "direct" as const,
			},
		}
	})
	if (signal.aborted) handle.cancel()
	else signal.addEventListener("abort", () => handle.cancel(), { once: true })
	return { promise, cancel: handle.cancel }
}

/** Peek the first normalized page while preserving it in the returned single-use replay source. */
export async function peekStreamingPage(
	source: AsyncIterable<StreamingHtmlPageInput>,
	signal: AbortSignal,
): Promise<{
	firstPage: StreamingHtmlPage
	pages: AsyncIterable<StreamingHtmlPage>
	close: (reason?: unknown) => Promise<void>
}> {
	const normalized = normalizeStreamingPages(source, signal)
	const peeked = await peekAndReplayAsyncIterable(normalized, signal)
	return { firstPage: peeked.first, pages: peeked.replay, close: peeked.close }
}

/**
 * Pull exactly one item from a lazy source, then expose a single-use replay iterable that yields
 * that item before continuing with the same iterator. This lets callers derive presentation-wide
 * options from the first page without fetching or retaining the complete deck.
 */
export async function peekAndReplayAsyncIterable<T>(
	source: AsyncIterable<T>,
	signal: AbortSignal,
): Promise<PeekedAsyncIterable<T>> {
	const iterator = source[Symbol.asyncIterator]()
	let closed = false
	let replayClaimed = false

	const close = async (reason?: unknown) => {
		if (closed) return
		closed = true
		if (typeof iterator.return === "function") await iterator.return(reason)
	}

	let firstResult: IteratorResult<T>
	try {
		firstResult = await waitForAbortable(iterator.next(), signal, () => {
			void close(signal.reason).catch(() => undefined)
		})
		throwIfAborted(signal)
	} catch (error) {
		await close(error).catch(() => undefined)
		throw error
	}
	if (firstResult.done) {
		closed = true
		throw new Error("PPTX page source did not yield any pages")
	}
	const first = firstResult.value
	let replayFirst: T | undefined = first

	const replay: AsyncIterable<T> = {
		async *[Symbol.asyncIterator]() {
			if (replayClaimed) throw new Error("PPTX page source replay can only be consumed once")
			replayClaimed = true
			try {
				throwIfAborted(signal)
				yield replayFirst as T
				replayFirst = undefined
				while (!closed) {
					const next = await waitForAbortable(iterator.next(), signal, () => {
						void close(signal.reason).catch(() => undefined)
					})
					throwIfAborted(signal)
					if (next.done) {
						closed = true
						return
					}
					yield next.value
				}
			} finally {
				replayFirst = undefined
				await close(signal.reason).catch(() => undefined)
			}
		},
	}

	return { first, replay, close }
}

/**
 * Compose an arbitrary lazy HTML source with the application's export preparation step.
 * Only the current raw page and current prepared page are retained.
 */
export async function* iteratePreparedPptxPages(
	pages: Iterable<StreamingHtmlPageInput> | AsyncIterable<StreamingHtmlPageInput>,
	options: HtmlExportPreparationOptions & { signal?: AbortSignal },
): AsyncIterable<StreamingHtmlPage> {
	const { signal, ...preparationOptions } = options
	let fallbackIndex = 0
	for await (const page of pages) {
		throwIfAborted(signal)
		const sourcePage = typeof page === "string" ? { index: fallbackIndex, html: page } : page
		const html = await waitForAbortable(
			prepareHtmlForExport({
				...preparationOptions,
				content: sourcePage.html,
			}),
			signal,
		)
		throwIfAborted(signal)
		yield {
			index: sourcePage.index,
			html,
			...(sourcePage.key ? { key: sourcePage.key } : {}),
			...(sourcePage.pageName ? { pageName: sourcePage.pageName } : {}),
			...(sourcePage.pagePath ? { pagePath: sourcePage.pagePath } : {}),
			...(sourcePage.pageFileId ? { pageFileId: sourcePage.pageFileId } : {}),
		}
		fallbackIndex += 1
	}
}

async function* normalizeStreamingPages(
	source: Iterable<StreamingHtmlPageInput> | AsyncIterable<StreamingHtmlPageInput>,
	signal: AbortSignal,
): AsyncIterable<StreamingHtmlPage> {
	let fallbackIndex = 0
	for await (const page of source) {
		throwIfAborted(signal)
		if (typeof page === "string") {
			yield { index: fallbackIndex, html: page }
		} else if (page && typeof page.html === "string") {
			yield page
		} else {
			throw new TypeError(
				"[startPptxStreamingExportFromFactory] Each page must be an HTML string or { index, html } object",
			)
		}
		fallbackIndex += 1
	}
}

/** Build user-facing progress text without exposing internal export phase names. */
export function formatPptxStreamingProgress(baseText: string, progress: ExportProgress): string {
	const pageText =
		progress.pageIndex !== undefined
			? progress.pageCount !== undefined
				? ` (${progress.pageIndex + 1}/${progress.pageCount})`
				: ` (${progress.pageIndex + 1})`
			: ""
	return `${baseText}${pageText}`
}

function isAbortError(error: unknown): boolean {
	return (
		(typeof DOMException !== "undefined" &&
			error instanceof DOMException &&
			error.name === "AbortError") ||
		(typeof error === "object" &&
			error !== null &&
			"name" in error &&
			(error as { name?: unknown }).name === "AbortError")
	)
}

function waitForAbortable<T>(
	promise: PromiseLike<T>,
	signal?: AbortSignal,
	onAbort?: () => void,
): Promise<T> {
	if (!signal) return Promise.resolve(promise)
	if (signal.aborted) {
		onAbort?.()
		return Promise.reject(abortReason(signal))
	}

	return new Promise<T>((resolve, reject) => {
		let settled = false
		const cleanup = () => signal.removeEventListener("abort", handleAbort)
		const handleAbort = () => {
			if (settled) return
			settled = true
			cleanup()
			onAbort?.()
			reject(abortReason(signal))
		}
		signal.addEventListener("abort", handleAbort, { once: true })
		Promise.resolve(promise).then(
			(value) => {
				if (settled) return
				settled = true
				cleanup()
				resolve(value)
			},
			(error) => {
				if (settled) return
				settled = true
				cleanup()
				reject(error)
			},
		)
	})
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw abortReason(signal)
}

function abortReason(signal: AbortSignal): Error {
	return signal.reason instanceof Error ? signal.reason : createPptxAbortError(signal.reason)
}

function createPptxAbortError(reason?: unknown): Error {
	if (typeof DOMException !== "undefined") {
		return new DOMException(
			reason === undefined ? "Export aborted" : String(reason),
			"AbortError",
		)
	}
	const error = new Error(reason === undefined ? "Export aborted" : String(reason))
	error.name = "AbortError"
	return error
}

function withResolvedMediaPolicy(options: LargeExportOptions): LargeExportOptions {
	const requiresReplay =
		options.autoSize === true ||
		Boolean(options.fontResolver) ||
		options.stagingPolicy?.mode === "opfs" ||
		imagePolicyRequiresReplay(options.imagePolicy)
	const mode = resolvePptxMediaPolicyMode({
		requested: options.mediaPolicy?.mode,
		mediaSource: requiresReplay ? "signed-url" : undefined,
		requiresReplay,
	})
	return {
		...options,
		mediaPolicy: {
			...options.mediaPolicy,
			mode,
		},
	}
}

function hasFileStreamingCapability(): boolean {
	return typeof (globalThis as SaveFilePickerGlobal).showSaveFilePicker === "function"
}

// Warm the real OPFS probe long before a user clicks export, preserving picker activation.
if (hasFileStreamingCapability()) void supportsOpfsStaging()
