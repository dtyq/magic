import { describe, expect, it, vi } from "vitest"
import type { PPTNode } from "../src/ir/node"
import type { SerializablePPTNode } from "../src/ir/serialize"
import type { MediaSourceDescriptor } from "../src/media/source-descriptor"
import type { CreateStreamingPresentationPackagerInput } from "../src/packaging/streaming-types"
import type { StreamingStagingStore } from "../src/runtime"
import { runStreamingExport } from "../src/pipeline/streaming-export"
import type { StreamingExportTaskInput } from "../src"
import { ExportFidelityError } from "../src/errors"
import { MAX_PPT_PAGE_PX } from "../src/shared/unit"

const config = {
	htmlWidth: 1280,
	htmlHeight: 720,
	slideWidth: 13.333,
	slideHeight: 7.5,
}

function createSandboxStub() {
	return {
		iframe: {} as HTMLIFrameElement,
		window: {} as Window,
		document: {} as Document,
		render: vi.fn(),
		destroy: vi.fn(),
	}
}

function createSinkDestination() {
	return {
		kind: "sink-proxy" as const,
		sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
		replayPolicy: "buffered" as const,
	}
}

function createShapeNode(): PPTNode {
	return {
		type: "shape",
		x: 0,
		y: 0,
		w: 1,
		h: 1,
		zOrder: 0,
		shapeType: "rect",
		fill: null,
		line: null,
		shadow: null,
	} as PPTNode
}

function createImageNode(
	source: MediaSourceDescriptor,
	assetKey?: string,
	intrinsicSize?: { width: number; height: number },
): PPTNode {
	return {
		type: "image",
		x: 0,
		y: 0,
		w: 1,
		h: 1,
		zOrder: 0,
		sizing: "stretch",
		source,
		assetKey,
		intrinsicSize,
	} as PPTNode
}

function createMediaNodeWithCoverSource(): PPTNode {
	return {
		type: "media",
		x: 0,
		y: 0,
		w: 1,
		h: 1,
		zOrder: 0,
		mediaType: "video",
		source: {
			kind: "url",
			url: "https://example.test/video.mp4",
			key: "video-source",
			contentType: "video/mp4",
			extn: "mp4",
		},
		coverSource: {
			kind: "bytes",
			data: new Uint8Array([7, 8, 9]).buffer,
			key: "video-cover",
			contentType: "image/png",
			extn: "png",
		},
	} as PPTNode
}

function createPackagerFactory(options: {
	finalize?: () => Promise<{ slideCount: number; mediaPartCount: number; bytesWritten: number }>
	commit?: (nodes: SerializablePPTNode[]) => void | Promise<void>
}) {
	const commitSlide = vi.fn(async ({ nodes }: { nodes: SerializablePPTNode[] }) => {
		await options.commit?.(nodes)
		return { bytesWritten: 1, manifest: {} }
	})
	const packager = {
		state: "accepting-slides" as const,
		ready: Promise.resolve(),
		commitSlide,
		commitSlides: vi.fn(),
		finalize:
			options.finalize ??
			(async () => ({
				slideCount: commitSlide.mock.calls.length,
				mediaPartCount: 0,
				bytesWritten: 1,
			})),
		abort: vi.fn(async () => undefined),
		dispose: vi.fn(),
	}
	return { factory: vi.fn(() => packager), packager, commitSlide }
}

function createBaseInput(
	overrides: Partial<StreamingExportTaskInput> = {},
): StreamingExportTaskInput {
	return {
		config,
		fileName: "streaming.pptx",
		pages: (async function* () {
			yield { index: 0, html: "page" }
		})(),
		pageCount: 1,
		sandbox: createSandboxStub(),
		signal: new AbortController().signal,
		skipFailedPages: false,
		autoSize: false,
		destination: createSinkDestination(),
		pipeline: {},
		...overrides,
	}
}

function cloneJson<T>(value: T): T {
	if (value === undefined) return value
	return JSON.parse(JSON.stringify(value)) as T
}

class FakeStagingStore implements StreamingStagingStore {
	readonly stageCalls: string[] = []
	readonly cleanupCalls: string[] = []
	readonly operationSignals: AbortSignal[] = []
	private readonly slideRecords = new Map<number, unknown>()

	async createSession(_sessionId: string, options: { signal?: AbortSignal } = {}): Promise<void> {
		if (options.signal) this.operationSignals.push(options.signal)
	}

	async stage(
		source: Parameters<StreamingStagingStore["stage"]>[0],
		options: Parameters<StreamingStagingStore["stage"]>[1] = {},
	) {
		this.stageCalls.push(source.key)
		if (options.signal) this.operationSignals.push(options.signal)
		return {
			kind: "opfs" as const,
			sessionId: "test-session",
			path: `media/${source.key}.bin`,
			size: 12,
			key: source.key,
			contentType: source.contentType,
			extn: source.extn,
		}
	}

	async putSlideIr(
		index: number,
		value: unknown,
		options: { signal?: AbortSignal } = {},
	): Promise<void> {
		if (options.signal) this.operationSignals.push(options.signal)
		this.slideRecords.set(index, cloneJson(value))
	}

	async getSlideIr<T>(index: number, options: { signal?: AbortSignal } = {}): Promise<T> {
		if (options.signal) this.operationSignals.push(options.signal)
		return cloneJson(this.slideRecords.get(index)) as T
	}

	async deleteSlideIr(index: number, options: { signal?: AbortSignal } = {}): Promise<void> {
		if (options.signal) this.operationSignals.push(options.signal)
		this.slideRecords.delete(index)
	}

	async cleanupSession(sessionId: string): Promise<void> {
		this.cleanupCalls.push(sessionId)
	}
}

function createDeferred<T = void>() {
	let resolve!: (value: T | PromiseLike<T>) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve
		reject = promiseReject
	})
	return { promise, resolve, reject }
}

class BlockingPutStagingStore extends FakeStagingStore {
	readonly putStarted = createDeferred<void>()
	readonly releasePut = createDeferred<void>()

	override async putSlideIr(
		_index: number,
		_value: unknown,
		options: { signal?: AbortSignal } = {},
	): Promise<void> {
		if (options.signal) this.operationSignals.push(options.signal)
		this.putStarted.resolve()
		await this.releasePut.promise
	}
}

class FailingCleanupStagingStore extends FakeStagingStore {
	constructor(private readonly failures: number) {
		super()
	}

	override async cleanupSession(sessionId: string): Promise<void> {
		this.cleanupCalls.push(sessionId)
		if (this.cleanupCalls.length <= this.failures) {
			throw new Error(`cleanup failed ${this.cleanupCalls.length}`)
		}
	}
}

describe("runStreamingExport", () => {
	it("uses the in-memory replay store for a sink-proxy when OPFS is unavailable", async () => {
		vi.stubGlobal("navigator", {})
		const { factory, packager } = createPackagerFactory({})
		const input = createBaseInput({
			autoSize: true,
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createShapeNode()],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
			},
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		expect(factory).toHaveBeenCalledOnce()
		expect(packager.commitSlide).toHaveBeenCalledOnce()
		expect(input.destination).toBeDefined()
	})

	it("does not use an unbounded memory fallback for a raw writable stream", async () => {
		vi.stubGlobal("navigator", {})
		const factory = vi.fn()
		const writable = new WritableStream<Uint8Array>()
		const input = createBaseInput({
			autoSize: true,
			destination: { kind: "writable-stream", writable },
			pipeline: { createStreamingPresentationPackager: factory },
		})

		await expect(runStreamingExport(input)).rejects.toMatchObject({
			name: "PptxExportError",
			code: "opfs-unavailable",
		})
		expect(factory).not.toHaveBeenCalled()
	})

	it("requires an explicit buffered replay policy for a sink-proxy", async () => {
		vi.stubGlobal("navigator", {})
		const factory = vi.fn()
		const input = createBaseInput({
			autoSize: true,
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
			},
			pipeline: { createStreamingPresentationPackager: factory },
		})

		await expect(runStreamingExport(input)).rejects.toMatchObject({
			name: "PptxExportError",
			code: "opfs-unavailable",
		})
		expect(factory).not.toHaveBeenCalled()
	})

	it("rolling-stages URL media by default during two-pass SlideIR collection", async () => {
		const store = new FakeStagingStore()
		const source: MediaSourceDescriptor = {
			kind: "url" as const,
			url: "https://example.test/shared.png",
			key: "shared-image",
			contentType: "image/png",
			extn: "png",
		}
		const prepared = vi.fn(async () => ({
			pptNodes: [createImageNode(source)],
			totalWidth: 1280,
			totalHeight: 720,
			bodyBackground: null,
		}))
		const committedKinds: string[] = []
		const { factory, packager } = createPackagerFactory({
			commit: (nodes) => {
				const image = nodes.find((node) => node.type === "image")
				if (image?.type === "image") committedKinds.push(image.source?.kind ?? "")
			},
			finalize: async () => ({ slideCount: 3, mediaPartCount: 1, bytesWritten: 3 }),
		})
		const input = createBaseInput({
			pageCount: 3,
			pages: (async function* () {
				for (let index = 0; index < 3; index += 1) yield { index, html: `page-${index}` }
			})(),
			pipeline: {
				prepareSlideNodes: prepared,
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs", cleanup: "on-success" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 3 })
		expect(prepared).toHaveBeenCalledTimes(3)
		expect(store.stageCalls).toEqual(["shared-image"])
		expect(committedKinds).toEqual(["opfs", "opfs", "opfs"])
		expect(store.cleanupCalls).toHaveLength(1)
		expect(packager.dispose).toHaveBeenCalledOnce()
		const capacityPlan = (
			factory.mock.calls[0]?.[0] as {
				plan?: { capacityPlan?: Record<string, unknown> }
			}
		)?.plan?.capacityPlan
		expect(capacityPlan).toMatchObject({
			hasUnknownLengthSource: false,
			maxEntryBytesMayReachZip32Limit: false,
			archiveBytesMayReachZip32Limit: false,
		})
	})

	it("keeps unknown-source and aggregate archive capacity flags distinct on the direct path", async () => {
		const { factory } = createPackagerFactory({
			finalize: async () => ({ slideCount: 1, mediaPartCount: 0, bytesWritten: 1 }),
		})
		const input = createBaseInput({
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createShapeNode()],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
			},
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		const capacityPlan = (
			factory.mock.calls[0]?.[0] as {
				plan?: { capacityPlan?: Record<string, unknown> }
			}
		)?.plan?.capacityPlan
		expect(capacityPlan).toMatchObject({
			confidence: "streaming-unknown",
			zipMode: "classic",
			hasUnknownLengthSource: true,
			unknownLengthSourceMayReachZip32Limit: false,
			maxEntryBytesMayReachZip32Limit: false,
			archiveBytesMayReachZip32Limit: false,
		})
		expect(capacityPlan?.knownInputBytes).toBe(0n)
	})

	it("keeps URL media direct only when direct-stream is explicitly requested", async () => {
		const store = new FakeStagingStore()
		const source: MediaSourceDescriptor = {
			kind: "url",
			url: "https://example.test/replayable.png",
			key: "replayable-image",
			contentType: "image/png",
			extn: "png",
		}
		const committedKinds: string[] = []
		const { factory } = createPackagerFactory({
			commit: (nodes) => {
				const image = nodes.find((node) => node.type === "image")
				if (image?.type === "image") committedKinds.push(image.source?.kind ?? "")
			},
			finalize: async () => ({ slideCount: 1, mediaPartCount: 1, bytesWritten: 1 }),
		})
		const input = createBaseInput({
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createImageNode(source)],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs" },
			mediaPolicy: { mode: "direct-stream" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		expect(store.stageCalls).toEqual([])
		expect(committedKinds).toEqual(["url"])
	})

	it("stages a signed URL before it expires during fontResolver two-pass collection", async () => {
		const store = new FakeStagingStore()
		const source: MediaSourceDescriptor = {
			kind: "url",
			url: "https://example.test/signed.png?expires=soon",
			key: "expiring-image",
			contentType: "image/png",
			extn: "png",
		}
		let signedUrlValid = true
		const committedKinds: string[] = []
		const { factory, packager } = createPackagerFactory({
			commit: (nodes) => {
				const image = nodes.find((node) => node.type === "image")
				if (image?.type === "image") {
					if (image.source?.kind === "url" && !signedUrlValid) {
						throw new Error("signed URL expired before replay")
					}
					committedKinds.push(image.source?.kind ?? "")
				}
			},
			finalize: async () => ({ slideCount: 2, mediaPartCount: 1, bytesWritten: 2 }),
		})
		const input = createBaseInput({
			pageCount: 2,
			pages: (async function* () {
				yield { index: 0, html: "page-0" }
				// Simulate the short-lived URL expiring while later pages are collected.
				signedUrlValid = false
				yield { index: 1, html: "page-1" }
			})(),
			fontResolver: vi.fn(async () => []),
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createImageNode(source)],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs", cleanup: "always" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 2 })
		expect(store.stageCalls).toEqual(["expiring-image"])
		expect(committedKinds).toEqual(["opfs", "opfs"])
		expect(packager.abort).not.toHaveBeenCalled()
		expect(store.cleanupCalls).toHaveLength(1)
	})

	it("passes the export AbortSignal through every SlideIR staging operation", async () => {
		const store = new FakeStagingStore()
		const controller = new AbortController()
		const { factory } = createPackagerFactory({})
		const input = createBaseInput({
			signal: controller.signal,
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createShapeNode()],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		expect(store.operationSignals).toHaveLength(4)
		expect(store.operationSignals.every((signal) => signal === controller.signal)).toBe(true)
	})

	it("does not wait forever when SlideIR staging ignores cancellation", async () => {
		const store = new BlockingPutStagingStore()
		const controller = new AbortController()
		const { factory } = createPackagerFactory({})
		const exportPromise = runStreamingExport(
			createBaseInput({
				signal: controller.signal,
				pipeline: {
					prepareSlideNodes: vi.fn(async () => ({
						pptNodes: [createShapeNode()],
						totalWidth: 1280,
						totalHeight: 720,
						bodyBackground: null,
					})),
					createStreamingPresentationPackager: factory,
					createStreamingStagingStore: () => store,
				},
				stagingPolicy: { mode: "opfs" },
			}),
		)
		await store.putStarted.promise
		controller.abort()

		const outcome = await Promise.race([
			exportPromise.then(
				() => "resolved",
				(error) => error,
			),
			new Promise<"timed-out">((resolve) => setTimeout(() => resolve("timed-out"), 250)),
		])
		expect(outcome).not.toBe("timed-out")
		expect(outcome).toMatchObject({ name: "AbortError" })

		store.releasePut.resolve()
		await expect(exportPromise).rejects.toMatchObject({ name: "AbortError" })
	})

	it("stages a repeated URL key once when the media policy explicitly requests it", async () => {
		const store = new FakeStagingStore()
		const source: MediaSourceDescriptor = {
			kind: "url",
			url: "https://example.test/shared.png",
			key: "shared-image",
			contentType: "image/png",
			extn: "png",
		}
		const committedKinds: string[] = []
		const { factory } = createPackagerFactory({
			commit: (nodes) => {
				const image = nodes.find((node) => node.type === "image")
				if (image?.type === "image") committedKinds.push(image.source?.kind ?? "")
			},
			finalize: async () => ({ slideCount: 3, mediaPartCount: 1, bytesWritten: 3 }),
		})
		const input = createBaseInput({
			pageCount: 3,
			pages: (async function* () {
				for (let index = 0; index < 3; index += 1) yield { index, html: `page-${index}` }
			})(),
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createImageNode(source)],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs" },
			mediaPolicy: { mode: "full-stage" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 3 })
		expect(store.stageCalls).toEqual(["shared-image"])
		expect(committedKinds).toEqual(["opfs", "opfs", "opfs"])
	})

	it("stages 300 signed URL variants once when their assetKey is stable", async () => {
		const store = new FakeStagingStore()
		const stableAssetKey = "asset:image:assets/shared.png"
		const committedKeys: string[] = []
		const { factory } = createPackagerFactory({
			commit: (nodes) => {
				const image = nodes.find((node) => node.type === "image")
				if (image?.type === "image") committedKeys.push(image.source?.key ?? "")
			},
			finalize: async () => ({ slideCount: 300, mediaPartCount: 1, bytesWritten: 300 }),
		})
		const input = createBaseInput({
			pageCount: 300,
			pages: (async function* () {
				for (let index = 0; index < 300; index += 1) {
					yield { index, html: `page-${index}` }
				}
			})(),
			pipeline: {
				prepareSlideNodes: vi.fn(async ({ html }: { html: string }) => {
					const index = Number(html.slice("page-".length))
					return {
						pptNodes: [
							createImageNode(
								{
									kind: "url",
									url: `https://cdn.example.test/shared.png?token=${index}`,
									key: `signed-url:${index}`,
									contentType: "image/png",
									extn: "png",
								},
								stableAssetKey,
							),
						],
						totalWidth: 1280,
						totalHeight: 720,
						bodyBackground: null,
					}
				}),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({
			pageCount: 300,
			mediaPartCount: 1,
		})
		expect(store.stageCalls).toEqual([stableAssetKey])
		expect(committedKeys).toHaveLength(300)
		expect(new Set(committedKeys)).toEqual(new Set([stableAssetKey]))
	})

	it.each([
		[
			"blob",
			() =>
				({
					kind: "blob",
					blob: new Blob([new Uint8Array([1, 2, 3])]),
					size: 3,
					key: "blob-image",
					contentType: "image/png",
					extn: "png",
				}) satisfies MediaSourceDescriptor,
		],
		[
			"bytes",
			() =>
				({
					kind: "bytes",
					data: new Uint8Array([1, 2, 3]).buffer,
					key: "bytes-image",
					contentType: "image/png",
					extn: "png",
				}) satisfies MediaSourceDescriptor,
		],
	] as const)("stages %s media before JSON SlideIR replay", async (_kind, createSource) => {
		const store = new FakeStagingStore()
		const source = createSource()
		const committedKinds: string[] = []
		const { factory } = createPackagerFactory({
			commit: (nodes) => {
				const image = nodes.find((node) => node.type === "image")
				if (image?.type === "image") committedKinds.push(image.source?.kind ?? "")
			},
			finalize: async () => ({ slideCount: 1, mediaPartCount: 1, bytesWritten: 1 }),
		})
		const input = createBaseInput({
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createImageNode(source)],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		expect(store.stageCalls).toEqual([source.key])
		expect(committedKinds).toEqual(["opfs"])
	})

	it("stages descriptor image and media bytes before JSON SlideIR replay", async () => {
		const store = new FakeStagingStore()
		const committedKinds: string[] = []
		const { factory } = createPackagerFactory({
			commit: (nodes) => {
				const image = nodes.find((node) => node.type === "image")
				const media = nodes.find((node) => node.type === "media")
				if (image?.type === "image")
					committedKinds.push(`image:${image.source?.kind ?? ""}`)
				if (media?.type === "media") {
					committedKinds.push(`cover:${media.coverSource?.kind ?? ""}`)
				}
			},
			finalize: async () => ({ slideCount: 1, mediaPartCount: 2, bytesWritten: 1 }),
		})
		const input = createBaseInput({
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [
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
								data: new Uint8Array([1, 2, 3]).buffer,
								key: "image-source",
								contentType: "image/png",
								extn: "png",
							},
						} as PPTNode,
						createMediaNodeWithCoverSource(),
					],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		expect(store.stageCalls).toHaveLength(3)
		expect(store.stageCalls).toContain("video-source")
		expect(committedKinds).toEqual(["image:opfs", "cover:opfs"])
	})

	it.each([
		["on-success", 0],
		["on-error", 1],
	] as const)(
		"applies %s cleanup after a late finalize failure",
		async (cleanup, expectedCleanupCalls) => {
			const store = new FakeStagingStore()
			const { factory, packager } = createPackagerFactory({
				finalize: async () => {
					throw new Error("finalize failed")
				},
			})
			const input = createBaseInput({
				pipeline: {
					prepareSlideNodes: vi.fn(async () => ({
						pptNodes: [createShapeNode()],
						totalWidth: 1280,
						totalHeight: 720,
						bodyBackground: null,
					})),
					createStreamingPresentationPackager: factory,
					createStreamingStagingStore: () => store,
				},
				stagingPolicy: { mode: "opfs", cleanup },
			})

			await expect(runStreamingExport(input)).rejects.toThrow("finalize failed")
			expect(store.cleanupCalls).toHaveLength(expectedCleanupCalls)
			expect(packager.abort).toHaveBeenCalledOnce()
		},
	)

	it("retries staging cleanup and preserves the primary export error", async () => {
		const store = new FailingCleanupStagingStore(2)
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const { factory, packager } = createPackagerFactory({
			finalize: async () => {
				throw new Error("finalize failed")
			},
		})
		const input = createBaseInput({
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createShapeNode()],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs", cleanup: "always" },
		})

		try {
			await expect(runStreamingExport(input)).rejects.toThrow("finalize failed")
			expect(store.cleanupCalls).toHaveLength(2)
			expect(warning).toHaveBeenCalledOnce()
			expect(packager.abort).toHaveBeenCalledOnce()
		} finally {
			warning.mockRestore()
		}
	})

	it("keeps staged data after success when cleanup is on-error", async () => {
		const store = new FakeStagingStore()
		const { factory } = createPackagerFactory({
			finalize: async () => ({ slideCount: 1, mediaPartCount: 0, bytesWritten: 1 }),
		})
		const input = createBaseInput({
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createShapeNode()],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs", cleanup: "on-error" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		expect(store.cleanupCalls).toEqual([])
	})

	it("aborts the destination when staged page preparation fails before packaging", async () => {
		const destination = createSinkDestination()
		const store = new FakeStagingStore()
		const createPackager = vi.fn()
		const input = createBaseInput({
			destination,
			pipeline: {
				prepareSlideNodes: vi.fn(async () => {
					throw new Error("prepare failed")
				}),
				createStreamingPresentationPackager: createPackager,
				createStreamingStagingStore: () => store,
			},
			stagingPolicy: { mode: "opfs" },
		})

		await expect(runStreamingExport(input)).rejects.toThrow("prepare failed")
		expect(createPackager).not.toHaveBeenCalled()
		expect(destination.sink.abort).toHaveBeenCalledOnce()
		expect(store.cleanupCalls).toHaveLength(1)
	})

	it("keeps a placeholder slide when an auto-size page exceeds the PowerPoint width limit", async () => {
		const destination = createSinkDestination()
		const store = new FakeStagingStore()
		const issues: unknown[] = []
		const { factory, packager } = createPackagerFactory({})
		const tooWide = MAX_PPT_PAGE_PX + 1
		const input = createBaseInput({
			pageCount: 2,
			pages: (async function* () {
				yield { index: 0, html: "valid-page" }
				yield { index: 1, html: "too-wide-page" }
			})(),
			autoSize: true,
			skipFailedPages: true,
			destination,
			pipeline: {
				prepareSlideNodes: vi.fn(async ({ html }: { html: string }) => ({
					pptNodes: [createShapeNode()],
					totalWidth: html === "too-wide-page" ? tooWide : 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
			onExportIssue: (issue) => issues.push(issue),
			stagingPolicy: { mode: "opfs", cleanup: "always" },
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 2 })
		expect(factory).toHaveBeenCalledOnce()
		expect(packager.commitSlide).toHaveBeenCalledTimes(2)
		expect(issues).toEqual([
			expect.objectContaining({
				code: "render-error",
				pageIndex: 1,
				message: expect.stringContaining("exceeds PowerPoint"),
			}),
		])
		expect(destination.sink.abort).not.toHaveBeenCalled()
		expect(store.cleanupCalls).toHaveLength(1)
	})

	it.each(["script", "render-timeout", "capture"] as const)(
		"keeps exporting when a page has a %s fidelity failure",
		async (kind) => {
			const destination = createSinkDestination()
			const issues: unknown[] = []
			const { factory, packager } = createPackagerFactory({})
			const input = createBaseInput({
				pageCount: 2,
				pages: (async function* () {
					yield { index: 0, html: "broken-page" }
					yield { index: 1, html: "valid-page" }
				})(),
				skipFailedPages: true,
				destination,
				pipeline: {
					prepareSlideNodes: vi.fn(async ({ html }: { html: string }) => {
						if (html === "broken-page") {
							throw new ExportFidelityError(
								`page failed during ${kind}`,
								kind,
							)
						}
						return {
							pptNodes: [createShapeNode()],
							totalWidth: 1280,
							totalHeight: 720,
							bodyBackground: null,
						}
					}),
					createStreamingPresentationPackager: factory,
				},
				onExportIssue: (issue) => issues.push(issue),
			})

			await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 2 })
			expect(packager.commitSlide).toHaveBeenCalledTimes(2)
			expect(packager.abort).not.toHaveBeenCalled()
			expect(destination.sink.abort).not.toHaveBeenCalled()
			expect(issues).toEqual([
				expect.objectContaining({
					code: "render-error",
					pageIndex: 0,
					message: `page failed during ${kind}`,
				}),
			])
		},
	)

	it("aborts the destination when the staging store cannot be created", async () => {
		const destination = createSinkDestination()
		const createPackager = vi.fn()
		const input = createBaseInput({
			destination,
			pipeline: {
				createStreamingPresentationPackager: createPackager,
				createStreamingStagingStore: () => {
					throw new Error("staging unavailable")
				},
			},
			stagingPolicy: { mode: "opfs" },
		})

		await expect(runStreamingExport(input)).rejects.toThrow("staging unavailable")
		expect(createPackager).not.toHaveBeenCalled()
		expect(destination.sink.abort).toHaveBeenCalledOnce()
	})

	it("aborts the destination when direct packager creation fails", async () => {
		const destination = createSinkDestination()
		const createPackager = vi.fn(() => {
			throw new Error("packager creation failed")
		})
		const input = createBaseInput({
			destination,
			pipeline: {
				createStreamingPresentationPackager: createPackager,
			},
		})

		await expect(runStreamingExport(input)).rejects.toThrow("packager creation failed")
		expect(createPackager).toHaveBeenCalledOnce()
		expect(destination.sink.abort).toHaveBeenCalledOnce()
	})

	it("clears each committed page node array before accepting the next page", async () => {
		const retainedArrays: SerializablePPTNode[][] = []
		const { factory, packager, commitSlide } = createPackagerFactory({
			commit: (nodes) => {
				expect(retainedArrays.every((array) => array.length === 0)).toBe(true)
				retainedArrays.push(nodes)
			},
			finalize: async () => ({ slideCount: 300, mediaPartCount: 0, bytesWritten: 300 }),
		})
		const input = createBaseInput({
			pageCount: 300,
			pages: (async function* () {
				for (let index = 0; index < 300; index += 1) yield { index, html: `page-${index}` }
			})(),
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createShapeNode()],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
			},
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 300 })
		expect(commitSlide).toHaveBeenCalledTimes(300)
		expect(retainedArrays).toHaveLength(300)
		expect(retainedArrays.every((array) => array.length === 0)).toBe(true)
		expect(packager.dispose).toHaveBeenCalledOnce()
	})

	it("keeps an explicitly passthrough image policy on the direct path without reading payloads", async () => {
		const source: MediaSourceDescriptor = {
			kind: "opfs",
			sessionId: "image-session",
			path: "media/one-gib.png",
			size: 1024 * 1024 * 1024,
			key: "one-gib-image",
			contentType: "image/png",
			extn: "png",
		}
		const committedSources: MediaSourceDescriptor[] = []
		const { factory } = createPackagerFactory({
			commit: (nodes) => {
				const image = nodes.find((node) => node.type === "image")
				if (image?.type === "image" && image.source) committedSources.push(image.source)
			},
		})
		const input = createBaseInput({
			imagePolicy: {
				unknownDimensionsAction: "passthrough",
				unsupportedFormatAction: "passthrough",
				oversizedAction: "passthrough",
			},
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [createImageNode(source, undefined, { width: 4096, height: 2160 })],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
			},
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		expect(factory).toHaveBeenCalledOnce()
		expect(committedSources).toEqual([source])
	})

	it("fails before creating a packager when transform is required without a runtime hook", async () => {
		const store = new FakeStagingStore()
		const destination = createSinkDestination()
		const factory = vi.fn()
		const input = createBaseInput({
			destination,
			imagePolicy: { maxPixels: 100, oversizedAction: "transform" },
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [
						createImageNode(
							{
								kind: "url",
								url: "https://example.test/large.png",
								key: "large-image",
								contentType: "image/png",
								extn: "png",
							},
							undefined,
							{ width: 1000, height: 1000 },
						),
					],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
		})

		await expect(runStreamingExport(input)).rejects.toMatchObject({
			name: "PptxExportError",
			diagnostic: {
				phase: "transform-media",
				code: "media-transform-failed",
			},
		})
		expect(factory).not.toHaveBeenCalled()
		expect(store.stageCalls).toEqual([])
		expect(destination.sink.abort).toHaveBeenCalledOnce()
	})

	it("uses transformImageDescriptor only after metadata preflight and stages the replacement", async () => {
		const store = new FakeStagingStore()
		const transformedSource: MediaSourceDescriptor = {
			kind: "opfs",
			sessionId: "transformed-session",
			path: "transformed/small.png",
			size: 10,
			key: "transformed-image",
			contentType: "image/png",
			extn: "png",
		}
		const transform = vi.fn(async () => ({
			source: transformedSource,
			intrinsicSize: { width: 10, height: 10 },
		}))
		const committedSources: MediaSourceDescriptor[] = []
		const { factory } = createPackagerFactory({
			commit: (nodes) => {
				const image = nodes.find((node) => node.type === "image")
				if (image?.type === "image" && image.source) committedSources.push(image.source)
			},
		})
		const input = createBaseInput({
			imagePolicy: { maxPixels: 100, oversizedAction: "transform" },
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [
						createImageNode(
							{
								kind: "url",
								url: "https://example.test/large.png",
								key: "large-image",
								contentType: "image/png",
								extn: "png",
							},
							"business-image",
							{ width: 1000, height: 1000 },
						),
					],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				transformImageDescriptor: transform,
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		expect(transform).toHaveBeenCalledOnce()
		expect(transform.mock.calls[0]?.[0]).toMatchObject({
			assetKey: "business-image",
			decision: { action: "transform", reason: "pixel-limit-exceeded" },
		})
		expect(store.stageCalls).toEqual([])
		expect(committedSources).toEqual([{ ...transformedSource, key: "business-image" }])
	})

	it("omits rejected images when rejectAction is explicitly omit", async () => {
		const store = new FakeStagingStore()
		const committedImageCounts: number[] = []
		const { factory } = createPackagerFactory({
			commit: (nodes) =>
				committedImageCounts.push(nodes.filter((node) => node.type === "image").length),
		})
		const input = createBaseInput({
			imagePolicy: {
				maxPixels: 100,
				oversizedAction: "reject",
				rejectAction: "omit",
			},
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [
						createImageNode(
							{
								kind: "url",
								url: "https://example.test/large.png",
								key: "large-image",
								contentType: "image/png",
								extn: "png",
							},
							undefined,
							{ width: 1000, height: 1000 },
						),
					],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
		})

		await expect(runStreamingExport(input)).resolves.toMatchObject({ pageCount: 1 })
		expect(committedImageCounts).toEqual([0])
		expect(store.stageCalls).toEqual([])
	})

	it("fails with a structured diagnostic when rejectAction is explicitly error", async () => {
		const store = new FakeStagingStore()
		const factory = vi.fn()
		const input = createBaseInput({
			imagePolicy: {
				maxPixels: 100,
				oversizedAction: "reject",
				rejectAction: "error",
			},
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [
						createImageNode(
							{
								kind: "url",
								url: "https://example.test/large.png",
								key: "large-image",
								contentType: "image/png",
								extn: "png",
							},
							undefined,
							{ width: 1000, height: 1000 },
						),
					],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: factory,
				createStreamingStagingStore: () => store,
			},
		})

		await expect(runStreamingExport(input)).rejects.toMatchObject({
			name: "PptxExportError",
			diagnostic: {
				phase: "preflight",
				code: "preflight-rejected",
				details: { action: "reject", reason: "pixel-limit-exceeded" },
			},
		})
		expect(factory).not.toHaveBeenCalled()
		expect(store.stageCalls).toEqual([])
	})
})
