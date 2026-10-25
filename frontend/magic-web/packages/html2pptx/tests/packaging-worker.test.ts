import { describe, expect, it, vi } from "vitest"
import { createSinkProxyWritable, createStreamingPackagingWorkerHandler } from "../src/packaging"
import { createStreamingPresentationPackager } from "../src/packaging/streaming-package-presentation"
import type {
	StreamingPackagingWorkerRequest,
	StreamingPackagingWorkerResponse,
	StreamingPresentationPlan,
	StreamingWorkerLike,
} from "../src/packaging/streaming-types"

const config = {
	htmlWidth: 1280,
	htmlHeight: 720,
	slideWidth: 13.333,
	slideHeight: 7.5,
}

const plan: StreamingPresentationPlan = {
	finalSlideCount: 2,
	slidePlan: {
		slides: [
			{
				key: "first",
				ordinal: 1,
				slideId: 256,
				presentationRelId: 2,
				partName: "ppt/slides/slide1.xml",
			},
			{
				key: "second",
				ordinal: 2,
				slideId: 257,
				presentationRelId: 3,
				partName: "ppt/slides/slide2.xml",
			},
		],
	},
}

type ReadyResponse = Extract<StreamingPackagingWorkerResponse, { type: "ready" }>

function readyResponse(): ReadyResponse {
	return { type: "ready" }
}

function startPayload(
	overrides: Partial<Extract<StreamingPackagingWorkerRequest, { type: "start" }>["payload"]> = {},
) {
	return {
		config,
		plan: { finalSlideCount: 1 },
		destination: { kind: "sink-proxy" as const, ackWindow: 1 },
		...overrides,
	}
}

describe("packaging sink proxy", () => {
	it("bounds outstanding transferable chunks and waits for close ACKs", async () => {
		const messages: StreamingPackagingWorkerResponse[] = []
		const proxy = createSinkProxyWritable({
			ackWindow: 2,
			transport: {
				postMessage(message) {
					messages.push(message)
				},
			},
		})
		const writer = proxy.writable.getWriter()

		const first = writer.write(new Uint8Array([1]))
		const second = writer.write(new Uint8Array([2]))
		const third = writer.write(new Uint8Array([3]))
		await Promise.all([first, second])
		await Promise.resolve()
		expect(messages.filter((message) => message.type === "sink-chunk")).toHaveLength(2)

		const firstChunk = messages.find(
			(message) => message.type === "sink-chunk" && new Uint8Array(message.data)[0] === 1,
		)
		expect(firstChunk?.type).toBe("sink-chunk")
		if (firstChunk?.type === "sink-chunk") proxy.acknowledge(firstChunk.chunkId)
		await third
		const chunks = messages.filter((message) => message.type === "sink-chunk")
		expect(chunks).toHaveLength(3)

		const close = writer.close()
		for (const chunk of chunks) proxy.acknowledge(chunk.chunkId)
		await close
	})

	it("rejects pending writes when aborted", async () => {
		const proxy = createSinkProxyWritable({
			ackWindow: 1,
			transport: { postMessage: vi.fn() },
		})
		const writer = proxy.writable.getWriter()
		void writer.closed.catch(() => undefined)
		await writer.write(new Uint8Array([1]))
		const blocked = writer.write(new Uint8Array([2]))
		await proxy.abort(new Error("disk full"))
		await expect(blocked).rejects.toThrow("disk full")
	})
})

describe("packaging Worker protocol", () => {
	it("keeps ACK out of the serialized queue and commits a slide", async () => {
		const responses: StreamingPackagingWorkerResponse[] = []
		let writer: WritableStreamDefaultWriter<Uint8Array> | undefined
		const session = {
			addSlide: vi.fn(() => ({})),
			commitSlide: vi.fn(async () => {
				await writer?.write(new Uint8Array([42]))
				return { bytesWritten: 1, manifest: { slideKey: "first" } }
			}),
			finalize: vi.fn(async () => {
				await writer?.close()
				return { slideCount: 1, mediaPartCount: 0, bytesWritten: 1 }
			}),
			abort: vi.fn(async () => {
				await writer?.abort()
			}),
		}
		const presentation = {
			beginStreaming: vi.fn(
				async ({ destination }: { destination: WritableStream<Uint8Array> }) => {
					writer = destination.getWriter()
					return session
				},
			),
		}
		const handler = createStreamingPackagingWorkerHandler({
			createPresentation: () => presentation as never,
			postMessage: (message) => responses.push(message),
		})

		handler.handle({
			type: "start",
			payload: startPayload(),
		})
		await eventually(() =>
			expect(responses.some((message) => message.type === "ready")).toBe(true),
		)

		handler.handle({
			type: "commit-slide",
			requestId: 1,
			payload: { nodes: [], background: "FFFFFF" },
		})
		await eventually(() =>
			expect(responses.some((message) => message.type === "sink-chunk")).toBe(true),
		)
		const chunk = responses.find((message) => message.type === "sink-chunk")
		expect(chunk?.type).toBe("sink-chunk")
		if (chunk?.type === "sink-chunk")
			handler.handle({ type: "sink-ack", chunkId: chunk.chunkId })
		await eventually(() =>
			expect(responses.some((message) => message.type === "slide-committed")).toBe(true),
		)
		handler.handle({ type: "finalize", requestId: 2 })
		await eventually(() =>
			expect(responses.some((message) => message.type === "completed")).toBe(true),
		)
		expect(session.addSlide).toHaveBeenCalledWith(undefined)
		expect(session.commitSlide).toHaveBeenCalledOnce()
		expect(responses.filter((message) => message.type === "progress")).toHaveLength(0)
	})

	it("normalizes PptxGenJS bigint byte counts at the Worker boundary", async () => {
		const responses: StreamingPackagingWorkerResponse[] = []
		const session = {
			addSlide: vi.fn(() => ({})),
			commitSlide: vi.fn(async () => ({ bytesWritten: 42n, manifest: {} })),
			finalize: vi.fn(async () => ({
				slideCount: 1,
				mediaPartCount: 0,
				bytesWritten: 84n,
			})),
			abort: vi.fn(async () => undefined),
		}
		const presentation = {
			beginStreaming: vi.fn(async () => session),
		}
		const handler = createStreamingPackagingWorkerHandler({
			createPresentation: () => presentation as never,
			postMessage: (message) => responses.push(message),
		})

		handler.handle({
			type: "start",
			payload: startPayload(),
		})
		await eventually(() =>
			expect(responses.some((message) => message.type === "ready")).toBe(true),
		)

		handler.handle({
			type: "commit-slide",
			requestId: 1,
			payload: { nodes: [] },
		})
		await eventually(() => {
			const response = responses.find((message) => message.type === "slide-committed")
			expect(response?.type).toBe("slide-committed")
			if (response?.type === "slide-committed") expect(response.summary.bytesWritten).toBe(42)
		})

		handler.handle({ type: "finalize", requestId: 2 })
		await eventually(() => {
			const response = responses.find((message) => message.type === "completed")
			expect(response?.type).toBe("completed")
			if (response?.type === "completed") expect(response.summary.bytesWritten).toBe(84)
		})
	})

	it("preserves structured capability fields on Worker errors", async () => {
		const responses: StreamingPackagingWorkerResponse[] = []
		const failure = Object.assign(new Error("OPFS write unavailable"), {
			name: "OpfsCapabilityError",
			code: "OPFS_WRITE_UNAVAILABLE",
			capability: "file.createWritable",
			causeCode: "OPFS_PARTIAL_IMPLEMENTATION",
		})
		const presentation = {
			beginStreaming: vi.fn(async () => {
				throw failure
			}),
		}
		const handler = createStreamingPackagingWorkerHandler({
			createPresentation: () => presentation as never,
			postMessage: (message) => responses.push(message),
		})

		handler.handle({
			type: "start",
			payload: startPayload(),
		})
		await eventually(() => {
			const response = responses.find((message) => message.type === "error")
			expect(response?.type).toBe("error")
			if (response?.type === "error") {
				expect(response.error).toMatchObject({
					name: "OpfsCapabilityError",
					code: "OPFS_WRITE_UNAVAILABLE",
					capability: "file.createWritable",
					causeCode: "OPFS_PARTIAL_IMPLEMENTATION",
				})
			}
		})
	})

})

describe("streaming packager client", () => {
	it("deserializes structured OPFS capability fields from Worker errors", async () => {
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				if (request.type !== "start") return
				worker.emit({
					type: "error",
					error: {
						name: "CentralDirectoryMetadataBudgetError",
						message: "Central-directory metadata spill failed",
						code: "CENTRAL_DIRECTORY_METADATA_BUDGET_EXCEEDED",
						capability: "file.createWritable",
						causeCode: "OPFS_WRITE_UNAVAILABLE",
					},
				})
			},
		}
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			workerFactory: () => worker,
		})

		const error = await packager.ready.catch((value) => value)

		expect(error).toMatchObject({
			name: "CentralDirectoryMetadataBudgetError",
			code: "CENTRAL_DIRECTORY_METADATA_BUDGET_EXCEEDED",
			capability: "file.createWritable",
			causeCode: "OPFS_WRITE_UNAVAILABLE",
		})
		expect(packager.state).toBe("failed")
		packager.dispose()
	})

	it("forwards per-slide resource errors without failing the commit", async () => {
		const worker = new LoopbackWorker()
		const resourceError = {
			url: "https://example.test/chart.webp",
			kind: "image" as const,
			reason: "load-error" as const,
		}
		worker.handler = {
			handle(request) {
				if (request.type === "start") worker.emit({ type: "ready" })
				if (request.type === "commit-slide") {
					worker.emit({
						type: "slide-committed",
						requestId: request.requestId,
						summary: { bytesWritten: 0, resourceErrors: [resourceError] },
					})
				}
				if (request.type === "abort")
					worker.emit({ type: "aborted", requestId: request.requestId })
			},
		}
		const onResourceError = vi.fn()
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 1 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			workerFactory: () => worker,
			onResourceError,
		})

		await packager.ready
		await expect(packager.commitSlide({ nodes: [] })).resolves.toMatchObject({
			bytesWritten: 0,
		})
		expect(onResourceError).toHaveBeenCalledWith(resourceError)
		packager.dispose()
	})

	it("rejects malformed per-slide resource errors from the Worker", async () => {
		const requests: StreamingPackagingWorkerRequest[] = []
		const sinkAbort = vi.fn(async () => undefined)
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				requests.push(request)
				if (request.type === "start") worker.emit({ type: "ready" })
				if (request.type === "commit-slide") {
					worker.emit({
						type: "slide-committed",
						requestId: request.requestId,
						summary: {
							bytesWritten: 0,
							resourceErrors: [
								{
									url: "https://example.test/chart.webp",
									kind: "image",
									reason: "invalid" as never,
								},
							],
						},
					})
				}
				if (request.type === "abort") {
					worker.emit({ type: "aborted", requestId: request.requestId })
				}
			},
		}
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 1 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: sinkAbort },
			},
			workerFactory: () => worker,
		})

		await packager.ready
		await expect(packager.commitSlide({ nodes: [] })).rejects.toThrow(
			"resource error reason is invalid",
		)
		await eventually(() => expect(packager.state).toBe("failed"))
		expect(sinkAbort).toHaveBeenCalledOnce()
		await eventually(() =>
			expect(requests.filter((request) => request.type === "abort")).toHaveLength(1),
		)
		packager.dispose()
	})

	it("keeps cached font buffers reusable across consecutive Worker starts", async () => {
		const cachedFontBuffer = Uint8Array.from([1, 2, 3, 4]).buffer
		const workers = [
			new TransferSimulatingWorker([cachedFontBuffer]),
			new TransferSimulatingWorker([cachedFontBuffer]),
		]

		for (const worker of workers) {
			const packager = createStreamingPresentationPackager({
				config,
				plan: { finalSlideCount: 0 },
				embedFonts: [{ typeface: "Cached Font", regular: cachedFontBuffer }],
				destination: {
					kind: "sink-proxy",
					sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
				},
				workerFactory: () => worker,
			})

			await packager.ready
			expect(cachedFontBuffer.byteLength).toBe(4)
			expect(Array.from(new Uint8Array(cachedFontBuffer))).toEqual([1, 2, 3, 4])
			expect(worker.startChecks).toEqual([
				expect.objectContaining({
					fontTransferCount: 1,
					payloadUsesTransferredClones: true,
					payloadUsesCallerBuffers: false,
				}),
			])
			await packager.abort(new Error("test complete"))
			packager.dispose()
		}
	})

	it("reuses one cloned transfer when multiple font face slots share a buffer", async () => {
		const sharedFaceBuffer = Uint8Array.from([9, 8, 7]).buffer
		const worker = new TransferSimulatingWorker([sharedFaceBuffer])
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			embedFonts: [
				{
					typeface: "Shared Faces",
					regular: sharedFaceBuffer,
					bold: sharedFaceBuffer,
					boldItalic: sharedFaceBuffer,
				},
			],
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			workerFactory: () => worker,
		})

		await packager.ready
		expect(sharedFaceBuffer.byteLength).toBe(3)
		expect(worker.startChecks).toEqual([
			expect.objectContaining({
				fontTransferCount: 1,
				fontSlotCount: 3,
				allFontSlotsShareOneClone: true,
				payloadUsesTransferredClones: true,
				payloadUsesCallerBuffers: false,
			}),
		])
		await packager.abort(new Error("test complete"))
		packager.dispose()
	})

	it("uses an explicit module URL when constructing the default Packaging Worker", async () => {
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				if (request.type === "start") worker.emit({ type: "ready" })
				if (request.type === "abort") {
					worker.emit({ type: "aborted", requestId: request.requestId })
				}
			},
		}
		const WorkerMock = vi.fn(function () {
			return worker
		})
		vi.stubGlobal("Worker", WorkerMock)
		const workerUrl = new URL("https://cdn.example.test/html2pptx/packaging-worker.js")
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			workerUrl,
		})

		try {
			await packager.ready
			expect(WorkerMock).toHaveBeenCalledWith(workerUrl, { type: "module" })
			await packager.abort(new Error("test complete"))
		} finally {
			packager.dispose()
			vi.unstubAllGlobals()
		}
	})

	it("uses planned slide keys and closes the destination after finalize", async () => {
		const sinkChunks: number[] = []
		const responses: StreamingPackagingWorkerResponse[] = []
		const sessionWriter = {
			current: undefined as WritableStreamDefaultWriter<Uint8Array> | undefined,
		}
		const session = {
			addSlide: vi.fn(() => ({})),
			commitSlide: vi.fn(async () => {
				await sessionWriter.current?.write(
					new Uint8Array([session.addSlide.mock.calls.length]),
				)
				return { bytesWritten: 1, manifest: {} }
			}),
			finalize: vi.fn(async () => {
				await sessionWriter.current?.close()
				return { slideCount: 2, mediaPartCount: 0, bytesWritten: 2 }
			}),
			abort: vi.fn(async () => sessionWriter.current?.abort()),
		}
		const presentation = {
			beginStreaming: vi.fn(
				async ({ destination }: { destination: WritableStream<Uint8Array> }) => {
					sessionWriter.current = destination.getWriter()
					return session
				},
			),
		}
		const worker = new LoopbackWorker((message) => responses.push(message))
		worker.handler = createStreamingPackagingWorkerHandler({
			createPresentation: () => presentation as never,
			postMessage: worker.emit,
		})

		let closed = false
		const packager = createStreamingPresentationPackager({
			config,
			plan,
			destination: {
				kind: "sink-proxy",
				sink: {
					write: (chunk) => {
						sinkChunks.push(...chunk)
					},
					close: () => {
						closed = true
					},
					abort: vi.fn(),
				},
			},
			workerFactory: () => worker,
		})
		await packager.ready
		await packager.commitSlide({ nodes: [] })
		await packager.commitSlide({ nodes: [] })
		await expect(packager.finalize()).resolves.toMatchObject({
			slideCount: 2,
			mediaPartCount: 0,
		})
		expect(session.addSlide).toHaveBeenNthCalledWith(1, { slideKey: "first" })
		expect(session.addSlide).toHaveBeenNthCalledWith(2, { slideKey: "second" })
		expect(sinkChunks).toEqual([1, 2])
		expect(closed).toBe(true)
		expect(responses.filter((message) => message.type === "slide-committed")).toHaveLength(2)
		packager.dispose()
	})

	it("rejects finalize when a sink write fails as the Worker reports completion", async () => {
		const requests: StreamingPackagingWorkerRequest[] = []
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				requests.push(request)
				if (request.type === "start") {
					worker.emit({ type: "ready" })
					return
				}
				if (request.type === "finalize") {
					worker.emit({
						type: "sink-chunk",
						chunkId: 1,
						data: Uint8Array.of(7).buffer,
					})
					worker.emit({
						type: "completed",
						requestId: request.requestId,
						summary: { slideCount: 0, mediaPartCount: 0, bytesWritten: 1 },
					})
				}
			},
		}

		let rejectWrite!: (error: Error) => void
		let markWriteStarted!: () => void
		const writeStarted = new Promise<void>((resolve) => {
			markWriteStarted = resolve
		})
		const close = vi.fn()
		const abortSink = vi.fn(async () => undefined)
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			destination: {
				kind: "sink-proxy",
				sink: {
					write: vi.fn(
						() =>
							new Promise<void>((_resolve, reject) => {
								rejectWrite = reject
								markWriteStarted()
							}),
					),
					close,
					abort: abortSink,
				},
			},
			workerFactory: () => worker,
		})

		await packager.ready
		const finalize = packager.finalize()
		await writeStarted
		rejectWrite(new Error("disk full"))

		await expect(finalize).rejects.toThrow("disk full")
		await eventually(() => expect(packager.state).toBe("failed"))
		expect(close).not.toHaveBeenCalled()
		expect(abortSink).toHaveBeenCalledWith(expect.objectContaining({ message: "disk full" }))
		expect(requests).toContainEqual(
			expect.objectContaining({ type: "abort", reason: "disk full" }),
		)
		packager.dispose()
	})

	it("does not complete after abort races a deferred sink close", async () => {
		const requests: StreamingPackagingWorkerRequest[] = []
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				requests.push(request)
				if (request.type === "start") {
					worker.emit({ type: "ready" })
					return
				}
				if (request.type === "finalize") {
					worker.emit({
						type: "completed",
						requestId: request.requestId,
						summary: { slideCount: 0, mediaPartCount: 0, bytesWritten: 0 },
					})
					return
				}
				if (request.type === "abort") {
					worker.emit({ type: "aborted", requestId: request.requestId })
				}
			},
		}

		let resolveClose!: () => void
		let markCloseStarted!: () => void
		const closeStarted = new Promise<void>((resolve) => {
			markCloseStarted = resolve
		})
		const close = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveClose = resolve
					markCloseStarted()
				}),
		)
		const abortSink = vi.fn(async () => undefined)
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			destination: {
				kind: "sink-proxy",
				sink: {
					write: vi.fn(),
					close,
					abort: abortSink,
				},
			},
			workerFactory: () => worker,
		})

		await packager.ready
		const finalize = packager.finalize()
		await closeStarted
		const abort = packager.abort(new Error("cancelled"))
		await expect(finalize).rejects.toThrow("cancelled")
		await abort
		resolveClose()
		expect(packager.state).toBe("aborted")
		expect(close).toHaveBeenCalledOnce()
		expect(abortSink).toHaveBeenCalledWith(expect.objectContaining({ message: "cancelled" }))
		expect(requests).toContainEqual(
			expect.objectContaining({ type: "abort", reason: "cancelled" }),
		)
		packager.dispose()
	})

	it("waits for the Worker aborted acknowledgement before terminating", async () => {
		const requests: StreamingPackagingWorkerRequest[] = []
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				requests.push(request)
				if (request.type === "start") worker.emit({ type: "ready" })
			},
		}
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			workerFactory: () => worker,
		})

		await packager.ready
		packager.dispose()
		expect(worker.terminate).not.toHaveBeenCalled()
		const abortRequest = requests.find((request) => request.type === "abort")
		expect(abortRequest?.type).toBe("abort")
		if (abortRequest?.type === "abort") {
			worker.emit({ type: "aborted", requestId: abortRequest.requestId })
		}
		await eventually(() => expect(worker.terminate).toHaveBeenCalledOnce())
	})

	it("terminates after the abort cleanup timeout when the Worker never acknowledges", async () => {
		const requests: StreamingPackagingWorkerRequest[] = []
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				requests.push(request)
				if (request.type === "start") worker.emit({ type: "ready" })
			},
		}
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			workerFactory: () => worker,
		})

		await packager.ready
		vi.useFakeTimers()
		try {
			const abort = packager.abort(new Error("cancelled"))
			await vi.advanceTimersByTimeAsync(2_000)
			await abort

			expect(requests).toContainEqual(expect.objectContaining({ type: "abort" }))
			expect(worker.terminate).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
	})

	it("makes abort idempotent and sends one Worker cleanup request", async () => {
		const requests: StreamingPackagingWorkerRequest[] = []
		const sinkAbort = vi.fn(async () => undefined)
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				requests.push(request)
				if (request.type === "start") worker.emit({ type: "ready" })
			},
		}
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: sinkAbort },
			},
			workerFactory: () => worker,
		})

		await packager.ready
		const first = packager.abort(new Error("cancelled"))
		const second = packager.abort(new Error("different reason"))
		expect(second).toBe(first)
		await eventually(() =>
			expect(requests.filter((request) => request.type === "abort")).toHaveLength(1),
		)
		const abortRequest = requests.find((request) => request.type === "abort")
		if (abortRequest?.type === "abort") {
			worker.emit({ type: "aborted", requestId: abortRequest.requestId })
		}
		await Promise.all([first, second])
		expect(sinkAbort).toHaveBeenCalledOnce()
		packager.dispose()
	})

	it.each([
		{
			label: "missing error payload",
			response: { type: "error" },
		},
		{
			label: "missing sink chunk data",
			response: { type: "sink-chunk", chunkId: 1 },
		},
		{
			label: "invalid completed request id",
			response: {
				type: "completed",
				requestId: 0,
				summary: { slideCount: 0, mediaPartCount: 0, bytesWritten: 0 },
			},
		},
	])("fails instead of hanging on a malformed Worker response ($label)", async ({ response }) => {
		const requests: StreamingPackagingWorkerRequest[] = []
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				requests.push(request)
				if (request.type === "start") worker.emit({ type: "ready" })
				if (request.type === "finalize") worker.emit(response as never)
				if (request.type === "abort")
					worker.emit({ type: "aborted", requestId: request.requestId })
			},
		}
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			workerFactory: () => worker,
		})

		await packager.ready
		const finalize = packager.finalize()
		await expect(finalize).rejects.toThrow()
		expect(packager.state).toBe("failed")
		await eventually(() =>
			expect(requests.filter((request) => request.type === "abort")).toHaveLength(1),
		)
		packager.dispose()
	})

	it("rejects a response whose type does not match the pending request", async () => {
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				if (request.type === "start") worker.emit({ type: "ready" })
				if (request.type === "commit-slide") {
					worker.emit({
						type: "completed",
						requestId: request.requestId,
						summary: { slideCount: 1, mediaPartCount: 0, bytesWritten: 0 },
					})
				}
				if (request.type === "abort")
					worker.emit({ type: "aborted", requestId: request.requestId })
			},
		}
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 1 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			workerFactory: () => worker,
		})

		await packager.ready
		await expect(packager.commitSlide({ nodes: [] })).rejects.toThrow(
			"does not match pending commit-slide",
		)
		expect(packager.state).toBe("failed")
		packager.dispose()
	})

	it("rejects a terminal response with an unknown request id", async () => {
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				if (request.type === "start") worker.emit({ type: "ready" })
				if (request.type === "finalize") {
					worker.emit({
						type: "completed",
						requestId: request.requestId + 1,
						summary: { slideCount: 0, mediaPartCount: 0, bytesWritten: 0 },
					})
				}
				if (request.type === "abort")
					worker.emit({ type: "aborted", requestId: request.requestId })
			},
		}
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 0 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			workerFactory: () => worker,
		})

		await packager.ready
		await expect(packager.finalize()).rejects.toThrow("referenced unknown request")
		expect(packager.state).toBe("failed")
		packager.dispose()
	})

	it("fails and cleans up when onProgress throws", async () => {
		const requests: StreamingPackagingWorkerRequest[] = []
		const sinkAbort = vi.fn(async () => undefined)
		const worker = new LoopbackWorker()
		worker.handler = {
			handle(request) {
				requests.push(request)
				if (request.type === "start") worker.emit({ type: "ready" })
				if (request.type === "commit-slide") {
					worker.emit({
						type: "progress",
						progress: { phase: "package-page", pageIndex: 0, pageCount: 1 },
					})
				}
				if (request.type === "abort")
					worker.emit({ type: "aborted", requestId: request.requestId })
			},
		}
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 1 },
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: sinkAbort },
			},
			workerFactory: () => worker,
			onProgress: () => {
				throw new Error("progress callback failed")
			},
		})

		await packager.ready
		await expect(packager.commitSlide({ nodes: [] })).rejects.toThrow(
			"progress callback failed",
		)
		await eventually(() => expect(packager.state).toBe("failed"))
		expect(sinkAbort).toHaveBeenCalledWith(
			expect.objectContaining({ message: "progress callback failed" }),
		)
		await eventually(() =>
			expect(requests.filter((request) => request.type === "abort")).toHaveLength(1),
		)
		packager.dispose()
	})

	it("accepts a raw WritableStream and transfers byte media descriptors", async () => {
		const output: number[] = []
		const sessionWriter = {
			current: undefined as WritableStreamDefaultWriter<Uint8Array> | undefined,
		}
		const session = {
			addSlide: vi.fn(() => ({ addImage: vi.fn(), addMedia: vi.fn() })),
			commitSlide: vi.fn(async () => {
				await sessionWriter.current?.write(new Uint8Array([9]))
				return { bytesWritten: 1, manifest: {} }
			}),
			finalize: vi.fn(async () => {
				await sessionWriter.current?.close()
				return { slideCount: 1, mediaPartCount: 2, bytesWritten: 1 }
			}),
			abort: vi.fn(async () => sessionWriter.current?.abort()),
		}
		const presentation = {
			beginStreaming: vi.fn(
				async ({ destination }: { destination: WritableStream<Uint8Array> }) => {
					sessionWriter.current = destination.getWriter()
					return session
				},
			),
		}
		const worker = new LoopbackWorker()
		worker.handler = createStreamingPackagingWorkerHandler({
			createPresentation: () => presentation as never,
			postMessage: worker.emit,
		})
		const writable = new WritableStream<Uint8Array>({
			write: (chunk) => {
				output.push(...chunk)
			},
		})
		const imageBytes = new ArrayBuffer(4)
		const mediaBytes = new ArrayBuffer(5)
		const coverBuffer = new ArrayBuffer(6)
		const packager = createStreamingPresentationPackager({
			config,
			plan: { finalSlideCount: 1 },
			destination: writable,
			workerFactory: () => worker,
		})

		await packager.ready
		await packager.commitSlide({
			nodes: [
				{
					type: "image",
					x: 0,
					y: 0,
					w: 1,
					h: 1,
					zOrder: 0,
					sizing: "stretch",
					source: {
						kind: "bytes",
						data: imageBytes,
						key: "image",
						contentType: "image/png",
						extn: "png",
					},
				},
				{
					type: "media",
					x: 0,
					y: 0,
					w: 1,
					h: 1,
					zOrder: 1,
					mediaType: "video",
					source: {
						kind: "bytes",
						data: mediaBytes,
						key: "video",
						contentType: "video/mp4",
						extn: "mp4",
					},
					coverSource: {
						kind: "bytes",
					data: coverBuffer,
						key: "cover",
						contentType: "image/jpeg",
						extn: "jpg",
					},
				},
			],
		})
		await packager.finalize()
		expect(output).toEqual([9])
		expect(worker.transfers[0]).toContain(writable)
		expect(worker.transfers[1]).toEqual(
				expect.arrayContaining([imageBytes, mediaBytes, coverBuffer]),
		)
		packager.dispose()
	})
})

class LoopbackWorker implements StreamingWorkerLike {
	handler!: { handle(request: StreamingPackagingWorkerRequest): void }
	readonly transfers: Transferable[][] = []
	readonly terminate = vi.fn()
	private listener?: (event: MessageEvent) => void

	constructor(
		private readonly emitResponse: (message: StreamingPackagingWorkerResponse) => void = () =>
			undefined,
	) {}

	postMessage(message: unknown, transfer: Transferable[] = []): void {
		this.transfers.push(transfer)
		this.handler.handle(message as StreamingPackagingWorkerRequest)
	}
	emit = (message: StreamingPackagingWorkerResponse): void => {
		this.emitResponse(message)
		queueMicrotask(() => this.listener?.({ data: message } as MessageEvent))
	}

	addEventListener(type: "message", listener: (event: MessageEvent) => void): void {
		if (type === "message") this.listener = listener
	}

	removeEventListener(): void {
		this.listener = undefined
	}
}

class TransferSimulatingWorker implements StreamingWorkerLike {
	readonly startChecks: Array<{
		fontTransferCount: number
		fontSlotCount: number
		allFontSlotsShareOneClone: boolean
		payloadUsesTransferredClones: boolean
		payloadUsesCallerBuffers: boolean
	}> = []
	readonly terminate = vi.fn()
	private listener?: (event: MessageEvent) => void

	constructor(private readonly callerBuffers: readonly ArrayBuffer[]) {}

	postMessage(message: unknown, transfer: Transferable[] = []): void {
		const request = message as StreamingPackagingWorkerRequest
		if (request.type === "start") {
			const fontSlots = (request.payload.embedFonts ?? []).flatMap((font) =>
				[font.regular, font.bold, font.italic, font.boldItalic].filter(
					(buffer): buffer is ArrayBuffer => Boolean(buffer),
				),
			)
			const transferredFontBuffers = transfer.filter(
				(item): item is ArrayBuffer => item instanceof ArrayBuffer,
			)
			this.startChecks.push({
				fontTransferCount: transferredFontBuffers.length,
				fontSlotCount: fontSlots.length,
				allFontSlotsShareOneClone:
					fontSlots.length > 0 && fontSlots.every((buffer) => buffer === fontSlots[0]),
				payloadUsesTransferredClones: fontSlots.every((buffer) =>
					transferredFontBuffers.includes(buffer),
				),
				payloadUsesCallerBuffers: fontSlots.some((buffer) =>
					this.callerBuffers.includes(buffer),
				),
			})
		}

		// Match browser Worker transfer semantics: this detaches every transferred buffer
		// on the sender side and throws if a detached buffer is reused.
		structuredClone(message, { transfer })

		if (request.type === "start") this.emit(readyResponse())
		if (request.type === "abort") {
			this.emit({ type: "aborted", requestId: request.requestId })
		}
	}

	private emit(message: StreamingPackagingWorkerResponse): void {
		queueMicrotask(() => this.listener?.({ data: message } as MessageEvent))
	}

	addEventListener(type: "message", listener: (event: MessageEvent) => void): void {
		if (type === "message") this.listener = listener
	}

	removeEventListener(): void {
		this.listener = undefined
	}
}

async function eventually(assertion: () => void): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		try {
			assertion()
			return
		} catch (error) {
			if (attempt === 99) throw error
			await new Promise((resolve) => setTimeout(resolve, 0))
		}
	}
}
