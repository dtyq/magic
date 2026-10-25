import type { EmbedFontInput } from "../api/font"
import type { ResourceLoadError, SlideConfig } from "../api/options"
import type { Pptx, Slide } from "../ir/node"
import type { SerializablePPTNode } from "../ir/serialize"
import { drawByRegistry } from "../registry/drawer-registry"
import { createPresentation } from "./pptx-document"
import { createSinkProxyWritable } from "./sink-proxy"
import type {
	SerializedStreamingError,
	StreamingCommitSlidePayload,
	StreamingExportSummary,
	StreamingPackagingWorkerRequest,
	StreamingPackagingWorkerResponse,
	StreamingPresentationPlan,
	StreamingSlideCommitSummary,
} from "./streaming-types"

interface StreamingSessionLike {
	addSlide(options?: Record<string, unknown>): StreamingSlideLike
	commitSlide(slide: StreamingSlideLike): Promise<RuntimeStreamingSlideCommitSummary>
	finalize(): Promise<RuntimeStreamingExportSummary>
	abort(reason?: unknown): Promise<void>
}

/**
 * PptxGenJS v5 tracks ZIP byte counts as bigint so ZIP64 output cannot lose
 * precision. The browser Worker protocol intentionally exposes safe numbers
 * to html2pptx callers, so normalize at this boundary instead of leaking a
 * bigint into structured diagnostics and application telemetry.
 */
interface RuntimeStreamingSlideCommitSummary {
	readonly manifest?: unknown
	readonly bytesWritten: number | bigint
	readonly resourceErrors?: ResourceLoadError[]
}

interface RuntimeStreamingExportSummary {
	readonly slideCount: number
	readonly mediaPartCount: number
	readonly bytesWritten: number | bigint
}

type StreamingSlideLike = Slide

type StreamingPresentationLike = Pptx & {
	beginStreaming?: (options: {
		destination: WritableStream<Uint8Array>
		plan: StreamingPresentationPlan
		compression?: boolean
		signal?: AbortSignal
	}) => Promise<StreamingSessionLike>
}

type QueuedWorkerRequest = Exclude<
	StreamingPackagingWorkerRequest,
	{ type: "abort" } | { type: "sink-ack" }
>

export interface PackagingWorkerPort {
	postMessage(message: StreamingPackagingWorkerResponse, transfer?: Transferable[]): void
}

export interface PackagingWorkerFactoryOptions {
	/** Injected for tests and hosts whose pptxgenjs package is patched at runtime. */
	createPresentation?: (config: SlideConfig) => Pptx | Promise<Pptx>
	postMessage?: PackagingWorkerPort["postMessage"]
	ackWindow?: number
	/** Prepare one serialized slide before it is handed to PptxGenJS. */
	prepareSlide?: (
		payload: StreamingCommitSlidePayload,
		signal?: AbortSignal,
	) => Promise<ResourceLoadError[] | void>
	/** Perform worker-specific relation/materialization work after drawing the slide. */
	afterSlideDraw?: (
		slide: Slide,
		nodes: SerializablePPTNode[],
		signal?: AbortSignal,
	) => Promise<void>
}

export interface StreamingPackagingWorkerHandler {
	handle(request: StreamingPackagingWorkerRequest): void
	abort(reason?: unknown): Promise<void>
}

type WorkerState =
	| "idle"
	| "starting"
	| "accepting-slides"
	| "committing-slide"
	| "finalizing"
	| "completed"
	| "failed"
	| "aborted"

/**
 * Build the streaming protocol handler separately from the global Worker entrypoint. This
 * keeps ordering, ACK, and cancellation rules testable without constructing a
 * browser Worker or requiring a patched PptxGenJS package in Node.
 */
export function createStreamingPackagingWorkerHandler(
	options: PackagingWorkerFactoryOptions = {},
): StreamingPackagingWorkerHandler {
	const postMessage = options.postMessage ?? (() => undefined)
	const createPres = options.createPresentation ?? ((config) => createPresentation(config))
	let state: WorkerState = "idle"
	let presentation: StreamingPresentationLike | null = null
	let session: StreamingSessionLike | null = null
	let sinkProxy: ReturnType<typeof createSinkProxyWritable> | null = null
	let workerAbortController: AbortController | null = null
	const queue: QueuedWorkerRequest[] = []
	let draining = false
	let terminalError: Error | null = null
	let cleanupPromise: Promise<void> | null = null
	let abortPromise: Promise<void> | null = null

	const fail = async (error: unknown, request?: StreamingPackagingWorkerRequest) => {
		const normalized = toError(error)
		if (!terminalError) terminalError = normalized
		state = state === "aborted" ? "aborted" : "failed"
		await cleanupSession(normalized).catch(() => undefined)
		postError(normalized, getRequestId(request))
	}

	const drain = async () => {
		if (draining) return
		draining = true
		try {
			while (queue.length > 0 && !terminalError && state !== "aborted") {
				const request = queue.shift()
				if (!request) continue
				try {
					await handleRequest(request)
				} catch (error) {
					await fail(error, request)
					// Every request after a terminal failure must settle on the main
					// side too; otherwise a queued commit promise can hang forever.
					for (const pending of queue.splice(0)) {
						postError(terminalError ?? toError(error), getRequestId(pending))
					}
				}
			}
		} finally {
			draining = false
		}
	}

	const handle = (request: StreamingPackagingWorkerRequest) => {
		// ACK and abort are intentionally out-of-band. A commit can be awaiting
		// sink backpressure, so queueing its ACK behind that commit deadlocks.
		if (request.type === "sink-ack") {
			sinkProxy?.acknowledge(request.chunkId)
			return
		}
		if (request.type === "abort") {
			void abort(request.reason, request.requestId).catch((error) => {
				postError(toError(error))
			})
			return
		}
		if (terminalError) {
			postError(terminalError, getRequestId(request))
			return
		}
		queue.push(request as QueuedWorkerRequest)
		void drain()
	}

	const handleRequest = async (request: QueuedWorkerRequest) => {
		if (request.type === "start") {
			if (state !== "idle") throw new Error("Packaging Worker can only be started once")
			state = "starting"
			workerAbortController = new AbortController()
			presentation = (await createPres(
				request.payload.config,
			)) as unknown as StreamingPresentationLike
			throwIfAborted(workerAbortController.signal)
			if (request.payload.embedFonts?.length)
				embedFonts(presentation, request.payload.embedFonts)
			const destination = request.payload.destination
			let writable: WritableStream<Uint8Array>
			if (destination.kind === "transferable-stream") {
				writable = destination.writable
			} else {
				sinkProxy = createSinkProxyWritable({
					transport: { postMessage },
					ackWindow: options.ackWindow ?? destination.ackWindow,
				})
				writable = sinkProxy.writable
			}
			if (typeof presentation.beginStreaming !== "function") {
				throw new Error(
					"PptxGenJS v5 beginStreaming() is unavailable; use the streaming-only runtime or inject a streaming presentation factory",
				)
			}
			session = await presentation.beginStreaming({
				destination: writable,
				plan: request.payload.plan,
				compression: request.payload.compression,
				signal: workerAbortController.signal,
			})
			throwIfAborted(workerAbortController.signal)
			state = "accepting-slides"
			postMessage({ type: "ready" })
			return
		}

		if (!session || state === "idle" || state === "starting") {
			throw new Error("Packaging Worker has not completed start")
		}
		if (state === "completed" || state === "failed" || state === "aborted") {
			throw new Error(`Packaging Worker is already ${state}`)
		}

		if (request.type === "commit-slide") {
			if (state !== "accepting-slides")
				throw new Error(`Cannot commit a slide while Worker is ${state}`)
			state = "committing-slide"
			const resourceErrors = await options.prepareSlide?.(
				request.payload,
				workerAbortController?.signal,
			)
			const summary = normalizeSlideCommitSummary(await commitSlide(
				session,
				request.payload,
				workerAbortController?.signal,
				options.afterSlideDraw,
			))
			state = "accepting-slides"
			postMessage({
				type: "slide-committed",
				requestId: request.requestId,
				summary: resourceErrors?.length ? { ...summary, resourceErrors } : summary,
			})
			return
		}

		state = "finalizing"
		const summary = normalizeExportSummary(await session.finalize())
		state = "completed"
		postMessage({ type: "completed", requestId: request.requestId, summary })
	}

	const abort = (reason?: unknown, requestId?: number): Promise<void> => {
		if (abortPromise) return abortPromise.then(() => postAborted(requestId))
		if (state === "completed" || state === "failed") {
			return cleanupSession(reason).then(() => postAborted(requestId))
		}

		const abortError = toError(reason ?? "Export aborted")
		state = "aborted"
		terminalError = terminalError ?? abortError
		workerAbortController?.abort(abortError)
		for (const pending of queue.splice(0)) postError(abortError, getRequestId(pending))
		abortPromise = cleanupSession(abortError).then(() => undefined)
		return abortPromise.then(() => postAborted(requestId))
	}

	const cleanupSession = (reason: unknown): Promise<void> => {
		if (cleanupPromise) return cleanupPromise
		cleanupPromise = (async () => {
			workerAbortController?.abort(reason)
			try {
				await session?.abort(reason)
			} catch {
				// Preserve the original packaging failure.
			}
			try {
				await sinkProxy?.abort(reason)
			} catch {
				// Destination cleanup is best effort after the terminal error.
			}
			presentation = null
			session = null
		})()
		return cleanupPromise
	}

	return { handle, abort }

	function postError(error: Error, requestId?: number): void {
		const candidate = error as Error & {
			code?: unknown
			capability?: unknown
			causeCode?: unknown
		}
		const serialized: SerializedStreamingError = {
			name: error.name || "Error",
			message: error.message,
			code: typeof candidate.code === "string" ? candidate.code : undefined,
			capability: typeof candidate.capability === "string" ? candidate.capability : undefined,
			causeCode: typeof candidate.causeCode === "string" ? candidate.causeCode : undefined,
			stack: error.stack,
			cause: error.cause === undefined ? undefined : String(error.cause),
		}
		postMessage({ type: "error", requestId, error: serialized })
	}

	function postAborted(requestId?: number): void {
		postMessage({ type: "aborted", requestId })
	}
}

async function commitSlide(
	session: StreamingSessionLike,
	payload: StreamingCommitSlidePayload,
	signal?: AbortSignal,
	afterSlideDraw?: PackagingWorkerFactoryOptions["afterSlideDraw"],
): Promise<RuntimeStreamingSlideCommitSummary> {
	throwIfAborted(signal)
	const slide = session.addSlide(payload.options as Record<string, unknown> | undefined)
	if (payload.background) slide.background = { color: payload.background }
	for (const node of payload.nodes) {
		throwIfAborted(signal)
		await drawByRegistry(slide, node, signal)
	}
	if (afterSlideDraw) await afterSlideDraw(slide, payload.nodes, signal)
	throwIfAborted(signal)
	return session.commitSlide(slide)
}

function normalizeSlideCommitSummary(
	summary: RuntimeStreamingSlideCommitSummary,
): StreamingSlideCommitSummary {
	return {
		...summary,
		bytesWritten: normalizeWireByteCount(summary.bytesWritten, "slide summary bytesWritten"),
	}
}

function normalizeExportSummary(summary: RuntimeStreamingExportSummary): StreamingExportSummary {
	return {
		...summary,
		bytesWritten: normalizeWireByteCount(summary.bytesWritten, "export summary bytesWritten"),
	}
}

function normalizeWireByteCount(value: number | bigint, label: string): number {
	const normalized = typeof value === "bigint" ? Number(value) : value
	if (!Number.isSafeInteger(normalized) || normalized < 0) {
		throw new RangeError(
			`Packaging Worker ${label} must be a non-negative safe integer`,
		)
	}
	return normalized
}

function embedFonts(presentation: StreamingPresentationLike, fonts: EmbedFontInput[]): void {
	if (fonts.length === 0) return
	const embedFont = (
		presentation as unknown as {
			embedFont?: (font: EmbedFontInput) => unknown
		}
	).embedFont
	if (typeof embedFont !== "function") {
		throw new Error("PptxGenJS embedFont() is required when embedFonts are provided")
	}
	for (const font of fonts) embedFont.call(presentation, { ...font })
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw signal.reason instanceof Error ? signal.reason : new Error("Export aborted")
	}
}

function getRequestId(
	request: StreamingPackagingWorkerRequest | null | undefined,
): number | undefined {
	return request && "requestId" in request ? request.requestId : undefined
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}
