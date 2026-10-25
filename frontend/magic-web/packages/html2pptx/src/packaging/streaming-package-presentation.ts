import type {
	CreateStreamingPresentationPackagerInput,
	StreamingSlideBatch,
	SerializedStreamingError,
	StreamingCommitSlidePayload,
	StreamingExportSummary,
	StreamingPackagingWorkerRequest,
	StreamingPackagingWorkerResponse,
	StreamingPresentationPackager,
	StreamingSlideCommitSummary,
	StreamingWorkerDestination,
	StreamingWorkerLike,
} from "./streaming-types"
import type { EmbedFontInput } from "../api/font"
import type { ResourceLoadError } from "../api/options"
import type { ExportIssue } from "../api/options"
import { descriptorTransferables } from "../media/source-descriptor"
import defaultPackagingWorkerUrl from "../workers/packaging-worker.ts?worker&url"

type PendingRequest = {
	type: "commit-slide" | "finalize"
	resolve: (value: StreamingSlideCommitSummary | StreamingExportSummary) => void
	reject: (error: Error) => void
}

type PackagerState = StreamingPresentationPackager["state"]

type WorkerOperationRequest =
	| { type: "commit-slide"; payload: StreamingCommitSlidePayload }
	| { type: "finalize" }

/**
 * Abort is a best-effort protocol handshake. A broken or suspended Worker must
 * not keep a user cancellation pending forever, so cleanup is force-terminated
 * after this grace period.
 */
const ABORT_CLEANUP_TIMEOUT_MS = 2_000

/**
 * Main-thread client for the Phase 4 Packaging Worker. Sink-proxy writes are
 * serialized and acknowledged only after the host destination has accepted the
 * chunk; a transferred WritableStream uses its native backpressure instead.
 */
export function createStreamingPresentationPackager(
	input: CreateStreamingPresentationPackagerInput,
): StreamingPresentationPackager {
	const worker = input.workerFactory
		? input.workerFactory()
		: createDefaultPackagingWorker(input.workerUrl)
	const destination = normalizeDestination(input.destination)
	const sink = destination.kind === "sink-proxy" ? destination.sink : null
	let state: PackagerState = "starting"
	let nextRequestId = 1
	let nextExpectedBatchIndex = 0
	let committedSlideCount = 0
	let disposed = false
	let workerTerminated = false
	let workerTerminal = false
	let workerAbortRequestId: number | undefined
	let workerAbortPromise: Promise<void> | null = null
	let resolveWorkerAbort: (() => void) | null = null
	let abortPromise: Promise<void> | null = null
	let sinkAbortPromise: Promise<void> | null = null
	let terminalError: Error | null = null
	let terminalSignalSettled = false
	let operationTail: Promise<void> = Promise.resolve()
	let sinkWriteTail: Promise<void> = Promise.resolve()
	const pending = new Map<number, PendingRequest>()
	let resolveReady!: () => void
	let rejectReady!: (error: Error) => void
	const ready = new Promise<void>((resolve, reject) => {
		resolveReady = resolve
		rejectReady = reject
	})
	let rejectTerminalSignal!: (error: Error) => void
	const terminalSignal = new Promise<never>((_resolve, reject) => {
		rejectTerminalSignal = reject
	})
	// The signal is primarily consumed by finalize races. Keep it handled even
	// when a failure happens before finalize starts.
	void terminalSignal.catch(() => undefined)

	const onMessage = (event: MessageEvent) => {
		try {
			handleWorkerResponse(parseWorkerResponse(event.data))
		} catch (error) {
			fail(toError(error))
		}
	}
	const onWorkerError = (event: Event) => {
		const errorEvent = event as ErrorEvent
		markWorkerTerminal()
		fail(
			new Error(errorEvent.message || "Packaging Worker failed", {
				cause: errorEvent.error,
			}),
		)
	}
	const onMessageError = () => {
		fail(new Error("Packaging Worker sent an unreadable message"))
	}
	attachWorkerListeners(worker, onMessage, onWorkerError, onMessageError)

	const abortFromSignal = () => {
		void abort(input.signal?.reason)
	}
	// Defer an already-aborted signal until the local abort function has been
	// initialized; constructors must not throw a temporal-dead-zone error.
	if (input.signal?.aborted) queueMicrotask(abortFromSignal)
	else input.signal?.addEventListener("abort", abortFromSignal, { once: true })

	if (!input.signal?.aborted) postStart()

	function postStart(): void {
		const workerDestination =
			destination.kind === "writable-stream"
				? {
						kind: "transferable-stream" as const,
						writable: destination.writable,
					}
				: {
						kind: "sink-proxy" as const,
						ackWindow: destination.ackWindow,
					}
		try {
			// Font resolvers commonly cache their ArrayBuffers. Transferring those caller-owned
			// buffers directly would detach the cache after the first export and make the next
			// Worker start fail with DataCloneError. Clone once per original reference so face
			// slots that share a font file still share one transferred copy.
			const clonedFonts = cloneEmbedFontsForWorker(input.embedFonts)
			const request: StreamingPackagingWorkerRequest = {
				type: "start",
				payload: {
					config: input.config,
					plan: input.plan,
					embedFonts: clonedFonts.fonts,
					compression: input.compression,
					destination: workerDestination,
				},
			}
			const transfer: Transferable[] = []
			if (workerDestination.kind === "transferable-stream") {
				transfer.push(workerDestination.writable)
			}
			transfer.push(...clonedFonts.transferables)
			worker.postMessage(request, transfer)
		} catch (error) {
			fail(toError(error))
		}
	}

	function handleWorkerResponse(response: StreamingPackagingWorkerResponse): void {
		if (terminalError) {
			if (response.type === "aborted" || response.type === "error") {
				markWorkerTerminal()
			}
			return
		}
		if (response.type === "ready") {
			if (state !== "starting") {
				fail(new Error(`Packaging Worker sent ready while packager is ${state}`))
				return
			}
			state = "accepting-slides"
			resolveReady()
			return
		}
		if (response.type === "sink-chunk") {
			handleSinkChunk(response.chunkId, response.data)
			return
		}
		if (response.type === "progress") {
			input.onProgress?.(response.progress)
			return
		}
		if (response.type === "aborted") {
			markWorkerTerminal()
			fail(new Error("Packaging Worker aborted unexpectedly"))
			return
		}
		if (response.type === "error") {
			markWorkerTerminal()
			const error = deserializeError(response.error)
			if (response.requestId !== undefined) {
				const request = pending.get(response.requestId)
				pending.delete(response.requestId)
				request?.reject(error)
			}
			fail(error)
			return
		}

		const request = pending.get(response.requestId)
		if (!request) {
			fail(
				new Error(
					`Packaging Worker ${response.type} response referenced unknown request ${response.requestId}`,
				),
			)
			return
		}
		const expectedRequestType =
			response.type === "slide-committed" ? "commit-slide" : "finalize"
		if (request.type !== expectedRequestType) {
			fail(
				new Error(
					`Packaging Worker ${response.type} response does not match pending ${request.type} request ${response.requestId}`,
				),
			)
			return
		}
		pending.delete(response.requestId)
		if (response.type === "slide-committed") {
			reportResourceErrors(response.summary.resourceErrors)
			request.resolve(response.summary)
			return
		}

		void settleCompleted(request, response.summary)
	}

	async function settleCompleted(request: PendingRequest, summary: StreamingExportSummary) {
		try {
			await raceTerminal(sinkWriteTail)
			if (terminalError) throw terminalError
			if (sink) await raceTerminal(Promise.resolve().then(() => sink.close()))
			if (terminalError) throw terminalError
			// The Worker has finished its own session, and all sink-proxy writes
			// have now been accepted by the destination. No abort handshake is
			// needed for a clean terminal completion.
			markWorkerTerminal()
			state = "completed"
			request.resolve(summary)
		} catch (error) {
			const normalized = terminalError ?? toError(error)
			request.reject(normalized)
			fail(normalized)
		}
	}

	function handleSinkChunk(chunkId: number, data: ArrayBuffer): void {
		if (terminalError || disposed) return
		if (!sink) {
			fail(new Error("Packaging Worker emitted a sink chunk without an active sink proxy"))
			return
		}
		// Preserve file byte order even when ACK window > 1. The Worker can prepare
		// another chunk, but the destination never observes concurrent writes.
		const write = sinkWriteTail.then(async () => {
			if (terminalError) throw terminalError
			await sink.write(new Uint8Array(data))
			worker.postMessage({
				type: "sink-ack",
				chunkId,
			} satisfies StreamingPackagingWorkerRequest)
		})
		sinkWriteTail = write.catch(() => undefined)
		void write.catch((error) => {
			fail(toError(error))
		})
	}

	function requestWorker(
		request: WorkerOperationRequest,
		transfer: Transferable[] = [],
	): Promise<StreamingSlideCommitSummary | StreamingExportSummary> {
		if (terminalError) return Promise.reject(terminalError)
		const requestId = nextRequestId++
		return new Promise((resolve, reject) => {
			pending.set(requestId, { type: request.type, resolve, reject })
			try {
				worker.postMessage({ ...request, requestId }, transfer)
			} catch (error) {
				pending.delete(requestId)
				const normalized = toError(error)
				reject(normalized)
				fail(normalized)
			}
		})
	}

	function enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const result = operationTail.then(operation, operation)
		operationTail = result.then(
			() => undefined,
			() => undefined,
		)
		return result
	}

	function commitSlide(
		payload: StreamingCommitSlidePayload,
	): Promise<StreamingSlideCommitSummary> {
		return enqueue(async () => {
			await ready
			assertState("accepting-slides", "commit a slide")
			state = "committing-slide"
			try {
				const planned = input.plan.slidePlan?.slides[committedSlideCount]
				const preparedPayload =
					planned && !payload.options?.slideKey
						? { ...payload, options: { ...payload.options, slideKey: planned.key } }
						: payload
				const summary = (await requestWorker(
					{ type: "commit-slide", payload: preparedPayload },
					collectSlideTransferables(preparedPayload),
				)) as StreamingSlideCommitSummary
				committedSlideCount += 1
				state = "accepting-slides"
				return summary
			} catch (error) {
				if (!terminalError) state = "accepting-slides"
				throw error
			}
		})
	}

	function commitSlides(
		batch: StreamingSlideBatch,
		batchIndex?: number,
	): Promise<readonly StreamingSlideCommitSummary[]> {
		if (batch.slides.length !== batch.slideBackgrounds.length) {
			return Promise.reject(new Error("Streaming slide backgrounds must align with slides"))
		}
		if (batchIndex !== undefined) {
			if (batchIndex !== nextExpectedBatchIndex) {
				return Promise.reject(
					new Error(
						`Streaming packaging batch ${batchIndex} is out of order; expected ${nextExpectedBatchIndex}`,
					),
				)
			}
			nextExpectedBatchIndex += 1
		}
		return Promise.all(
			batch.slides.map((nodes, index) =>
				commitSlide({ nodes, background: batch.slideBackgrounds[index] }),
			),
		)
	}

	function finalize(): Promise<StreamingExportSummary> {
		return enqueue(async () => {
			await ready
			assertState("accepting-slides", "finalize")
			state = "finalizing"
			return (await requestWorker({ type: "finalize" })) as StreamingExportSummary
		})
	}

	function abort(reason?: unknown): Promise<void> {
		if (state === "completed" && !terminalError) {
			finishDispose()
			return Promise.resolve()
		}
		if (abortPromise) return abortPromise

		const abortError = terminalError ?? toAbortError(reason)
		if (!terminalError) {
			terminalError = abortError
			signalTerminal(abortError)
			rejectReady(abortError)
			rejectPending(abortError)
		}
		if (state !== "failed") state = "aborted"

		abortPromise = settleAbortCleanup(
			Promise.all([ensureWorkerAbort(abortError), ensureSinkAbort(abortError)]),
		).then(() => {
			finishDispose()
		})
		return abortPromise
	}

	function fail(error: Error): void {
		if (terminalError || state === "completed") return
		terminalError = error
		state = "failed"
		signalTerminal(error)
		rejectReady(error)
		rejectPending(error)
		void ensureSinkAbort(error)
		void ensureWorkerAbort(error)
	}

	function dispose(): void {
		if (disposed) return
		disposed = true
		input.signal?.removeEventListener("abort", abortFromSignal)
		if (state === "completed" && workerTerminal) {
			finishDispose()
			return
		}
		void abort(new Error("Streaming presentation packager was disposed")).then(
			finishDispose,
			finishDispose,
		)
	}

	function finishDispose(): void {
		if (workerTerminated) return
		workerTerminated = true
		// A timeout can force termination without receiving the protocol ACK.
		// Marking the Worker terminal also releases the internal ACK promise and
		// prevents any later cleanup caller from waiting on a dead port.
		markWorkerTerminal()
		detachWorkerListeners(worker, onMessage, onWorkerError, onMessageError)
		worker.terminate?.()
	}

	function settleAbortCleanup(operation: PromiseLike<unknown>): Promise<void> {
		return new Promise((resolve) => {
			let settled = false
			const finish = () => {
				if (settled) return
				settled = true
				clearTimeout(timer)
				resolve()
			}
			const timer = setTimeout(finish, ABORT_CLEANUP_TIMEOUT_MS)
			Promise.resolve(operation).then(finish, finish)
		})
	}

	function ensureWorkerAbort(reason: Error): Promise<void> {
		if (workerTerminal) return Promise.resolve()
		if (workerAbortPromise) return workerAbortPromise

		workerAbortRequestId = nextRequestId++
		workerAbortPromise = new Promise<void>((resolve) => {
			resolveWorkerAbort = resolve
		})
		try {
			worker.postMessage({
				type: "abort",
				requestId: workerAbortRequestId,
				reason: reason.message,
			} satisfies StreamingPackagingWorkerRequest)
		} catch {
			// A Worker that can no longer receive messages is terminal from the
			// client's perspective; local sink cleanup remains authoritative.
			markWorkerTerminal()
		}
		return workerAbortPromise
	}

	function ensureSinkAbort(reason: Error): Promise<void> {
		if (sinkAbortPromise) return sinkAbortPromise
		sinkAbortPromise = Promise.resolve()
			.then(() => sink?.abort?.(reason))
			.catch(() => undefined)
		return sinkAbortPromise
	}

	function markWorkerTerminal(): void {
		workerTerminal = true
		resolveWorkerAbort?.()
		resolveWorkerAbort = null
	}

	function signalTerminal(error: Error): void {
		if (terminalSignalSettled) return
		terminalSignalSettled = true
		rejectTerminalSignal(error)
	}

	function rejectPending(error: Error): void {
		for (const request of pending.values()) request.reject(error)
		pending.clear()
	}

	function raceTerminal<T>(operation: PromiseLike<T>): Promise<T> {
		return Promise.race([Promise.resolve(operation), terminalSignal])
	}

	function assertState(expected: PackagerState, operation: string): void {
		if (terminalError) throw terminalError
		if (disposed) throw new Error(`Cannot ${operation}; packaging Worker is disposed`)
		if (state !== expected) throw new Error(`Cannot ${operation} while packager is ${state}`)
	}

	function reportResourceErrors(errors?: ResourceLoadError[]): void {
		for (const resourceError of errors ?? []) {
			try {
				input.onResourceError?.(resourceError)
			} catch {
				// Resource reporting must never turn a successful package into a failed export.
			}
			try {
				input.onExportIssue?.({
					code: "resource-error",
					message: `${resourceError.message || `${resourceError.kind} ${resourceError.reason}`}: ${resourceError.url}`,
					severity: "warning",
					details: {
						kind: resourceError.kind,
						reason: resourceError.reason,
						url: resourceError.url,
						...(resourceError.status === undefined ? {} : { status: resourceError.status }),
						...(resourceError.contentType ? { contentType: resourceError.contentType } : {}),
					},
				} satisfies ExportIssue)
			} catch {
				// Diagnostics are observational and must not affect a successful package.
			}
		}
	}

	return {
		get state() {
			return state
		},
		ready,
		commitSlide,
		commitSlides,
		finalize,
		abort,
		dispose,
	}
}

function createDefaultPackagingWorker(workerUrl?: string | URL): StreamingWorkerLike {
	if (typeof Worker === "undefined") {
		throw new Error(
			"Packaging Worker is unavailable; provide workerFactory in this environment",
		)
	}
	if (workerUrl) return new Worker(workerUrl, { type: "module" })
	return new Worker(defaultPackagingWorkerUrl, {
		type: "module",
	})
}

function normalizeDestination(
	destination: StreamingWorkerDestination,
):
	| { kind: "writable-stream"; writable: WritableStream<Uint8Array> }
	| Extract<StreamingWorkerDestination, { kind: "sink-proxy" }> {
	if (isWritableStream(destination)) return { kind: "writable-stream", writable: destination }
	if (destination.kind === "sink-proxy") return destination
	return { kind: "writable-stream", writable: destination.writable }
}

function isWritableStream(value: StreamingWorkerDestination): value is WritableStream<Uint8Array> {
	return typeof (value as WritableStream<Uint8Array>).getWriter === "function"
}

function collectSlideTransferables(payload: StreamingCommitSlidePayload): Transferable[] {
	const buffers = new Set<ArrayBuffer>()
	for (const node of payload.nodes) {
		if (node.type === "image") {
			for (const transferable of descriptorTransferables(node.source)) {
				if (transferable instanceof ArrayBuffer) buffers.add(transferable)
			}
		}
		if (node.type === "media") {
			for (const transferable of descriptorTransferables(node.source)) {
				if (transferable instanceof ArrayBuffer) buffers.add(transferable)
			}
			for (const transferable of descriptorTransferables(node.coverSource)) {
				if (transferable instanceof ArrayBuffer) buffers.add(transferable)
			}
		}
	}
	return Array.from(buffers)
}

function cloneEmbedFontsForWorker(embedFonts?: EmbedFontInput[]): {
	fonts?: EmbedFontInput[]
	transferables: ArrayBuffer[]
} {
	if (!embedFonts?.length) return { fonts: embedFonts, transferables: [] }

	const clonesByOriginal = new Map<ArrayBuffer, ArrayBuffer>()
	const cloneBuffer = (buffer: ArrayBuffer): ArrayBuffer => {
		const existing = clonesByOriginal.get(buffer)
		if (existing) return existing
		const cloned = buffer.slice(0)
		clonesByOriginal.set(buffer, cloned)
		return cloned
	}
	const cloneFace = (face: EmbedFontInput["regular"]): EmbedFontInput["regular"] => {
		// Keep compatibility with legacy callers that still pass a raw ArrayBuffer
		// even though the public descriptor contract now prefers `{ kind: "bytes" }`.
		if (face instanceof ArrayBuffer) return cloneBuffer(face) as unknown as EmbedFontInput["regular"]
		if (!face || face.kind !== "bytes") return face
		return { ...face, data: cloneBuffer(face.data) }
	}

	const fonts = embedFonts.map((font) => ({
		...font,
		regular: cloneFace(font.regular),
		bold: cloneFace(font.bold),
		italic: cloneFace(font.italic),
		boldItalic: cloneFace(font.boldItalic),
	}))

	return {
		fonts,
		transferables: Array.from(clonesByOriginal.values()),
	}
}

function attachWorkerListeners(
	worker: StreamingWorkerLike,
	onMessage: (event: MessageEvent) => void,
	onError: (event: Event) => void,
	onMessageError: (event: Event) => void,
): void {
	if (worker.addEventListener) {
		worker.addEventListener("message", onMessage)
		worker.addEventListener("error", onError as (event: MessageEvent) => void)
		worker.addEventListener("messageerror", onMessageError as (event: MessageEvent) => void)
		return
	}
	worker.onmessage = onMessage
	worker.onerror = onError as (event: ErrorEvent) => void
}

function detachWorkerListeners(
	worker: StreamingWorkerLike,
	onMessage: (event: MessageEvent) => void,
	onError: (event: Event) => void,
	onMessageError: (event: Event) => void,
): void {
	if (worker.removeEventListener) {
		worker.removeEventListener("message", onMessage)
		worker.removeEventListener("error", onError as (event: MessageEvent) => void)
		worker.removeEventListener("messageerror", onMessageError as (event: MessageEvent) => void)
		return
	}
	worker.onmessage = null
	worker.onerror = null
}

const VALID_PROGRESS_PHASES = new Set([
	"preflight",
	"prepare-page",
	"render-page",
	"stage-media",
	"package-page",
	"finalize",
	"completed",
])

function parseWorkerResponse(value: unknown): StreamingPackagingWorkerResponse {
	const response = requireRecord(value, "Packaging Worker response")
	if (typeof response.type !== "string") {
		throw new Error("Packaging Worker response type must be a string")
	}

		switch (response.type) {
		case "ready":
			return response as unknown as StreamingPackagingWorkerResponse
		case "slide-committed":
			requireRequestId(response.requestId)
			requireSlideCommitSummary(response.summary)
			return response as unknown as StreamingPackagingWorkerResponse
		case "sink-chunk":
			requirePositiveSafeInteger(response.chunkId, "sink chunk id")
			if (!(response.data instanceof ArrayBuffer)) {
				throw new Error("Packaging Worker sink chunk data must be an ArrayBuffer")
			}
			return response as unknown as StreamingPackagingWorkerResponse
		case "progress":
			requireProgress(response.progress)
			return response as unknown as StreamingPackagingWorkerResponse
		case "completed":
			requireRequestId(response.requestId)
			requireExportSummary(response.summary)
			return response as unknown as StreamingPackagingWorkerResponse
		case "aborted":
			requireOptionalRequestId(response.requestId)
			return response as unknown as StreamingPackagingWorkerResponse
		case "error":
			requireOptionalRequestId(response.requestId)
			requireSerializedError(response.error)
			return response as unknown as StreamingPackagingWorkerResponse
		default:
			throw new Error(`Packaging Worker returned an unknown response type: ${response.type}`)
	}
}

function requireSlideCommitSummary(value: unknown): void {
	const summary = requireRecord(value, "Packaging Worker slide summary")
	requireNonNegativeFiniteNumber(summary.bytesWritten, "slide summary bytesWritten")
	requireOptionalResourceErrors(summary.resourceErrors)
}

function requireExportSummary(value: unknown): void {
	const summary = requireRecord(value, "Packaging Worker export summary")
	requireNonNegativeSafeInteger(summary.slideCount, "export summary slideCount")
	requireNonNegativeSafeInteger(summary.mediaPartCount, "export summary mediaPartCount")
	requireNonNegativeFiniteNumber(summary.bytesWritten, "export summary bytesWritten")
}

function requireSerializedError(value: unknown): void {
	const serialized = requireRecord(value, "Packaging Worker error")
	if (typeof serialized.name !== "string" || typeof serialized.message !== "string") {
		throw new Error("Packaging Worker error must contain string name and message fields")
	}
	for (const field of ["code", "capability", "causeCode"] as const) {
		if (serialized[field] !== undefined && typeof serialized[field] !== "string") {
			throw new Error(`Packaging Worker error ${field} must be a string`)
		}
	}
	if (serialized.stack !== undefined && typeof serialized.stack !== "string") {
		throw new Error("Packaging Worker error stack must be a string")
	}
	if (serialized.cause !== undefined && typeof serialized.cause !== "string") {
		throw new Error("Packaging Worker error cause must be a string")
	}
}

function requireProgress(value: unknown): void {
	const progress = requireRecord(value, "Packaging Worker progress")
	if (typeof progress.phase !== "string" || !VALID_PROGRESS_PHASES.has(progress.phase)) {
		throw new Error("Packaging Worker progress phase is invalid")
	}
	for (const field of ["pageIndex", "pageCount", "resourceIndex", "resourceCount"] as const) {
		if (progress[field] !== undefined) {
			requireNonNegativeSafeInteger(progress[field], `progress ${field}`)
		}
	}
	for (const field of ["bytesRead", "bytesWritten", "estimatedTotalBytes"] as const) {
		if (progress[field] !== undefined) {
			requireNonNegativeFiniteNumber(progress[field], `progress ${field}`)
		}
	}
}

function requireOptionalResourceErrors(value: unknown): void {
	if (value === undefined) return
	if (!Array.isArray(value)) {
		throw new Error("Packaging Worker resourceErrors must be an array")
	}
	for (const item of value) {
		const resourceError = requireRecord(item, "Packaging Worker resource error")
		if (typeof resourceError.url !== "string" || typeof resourceError.kind !== "string") {
			throw new Error("Packaging Worker resource error must contain string url and kind fields")
		}
		if (resourceError.reason !== "timeout" && resourceError.reason !== "load-error") {
			throw new Error("Packaging Worker resource error reason is invalid")
		}
		for (const field of ["message", "contentType"] as const) {
			if (resourceError[field] !== undefined && typeof resourceError[field] !== "string") {
				throw new Error(`Packaging Worker resource error ${field} must be a string`)
			}
		}
		if (resourceError.status !== undefined && !Number.isSafeInteger(resourceError.status)) {
			throw new Error("Packaging Worker resource error status must be a safe integer")
		}
	}
}

function requireOptionalRequestId(value: unknown): void {
	if (value !== undefined) requireRequestId(value)
}

function requireRequestId(value: unknown): void {
	requirePositiveSafeInteger(value, "request id")
}

function requirePositiveSafeInteger(value: unknown, label: string): void {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
		throw new Error(`Packaging Worker ${label} must be a positive safe integer`)
	}
}

function requireNonNegativeSafeInteger(value: unknown, label: string): void {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
		throw new Error(`Packaging Worker ${label} must be a non-negative safe integer`)
	}
}

function requireNonNegativeFiniteNumber(value: unknown, label: string): void {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw new Error(`Packaging Worker ${label} must be a non-negative finite number`)
	}
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object`)
	}
	return value as Record<string, unknown>
}

function deserializeError(error: SerializedStreamingError): Error {
	const value = new Error(error.message, { cause: error.cause })
	value.name = error.name || "Error"
	if (error.code !== undefined)
		Object.defineProperty(value, "code", { value: error.code, enumerable: true })
	if (error.capability !== undefined) {
		Object.defineProperty(value, "capability", { value: error.capability, enumerable: true })
	}
	if (error.causeCode !== undefined) {
		Object.defineProperty(value, "causeCode", { value: error.causeCode, enumerable: true })
	}
	if (error.stack) value.stack = error.stack
	return value
}

function toAbortError(reason?: unknown): Error {
	if (reason instanceof Error) return reason
	const error = new Error(reason === undefined ? "Export aborted" : String(reason))
	error.name = "AbortError"
	return error
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}
