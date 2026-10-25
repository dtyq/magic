import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PptxDestination } from "@magic/html2pptx"

const mocks = vi.hoisted(() => ({
	exportPPTXLegacy: vi.fn(),
	exportPPTXStreaming: vi.fn(),
	imagePolicyRequiresReplay: vi.fn(
		(policy: { maxPixels?: number } | undefined) => policy?.maxPixels !== undefined,
	),
}))

vi.mock("@magic/html2pptx", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@magic/html2pptx")>()
	const createBufferedPptxSink = () => {
		const chunks: Uint8Array[] = []
		let closed = false
		return {
			sink: {
				write: async (chunk: Uint8Array) => chunks.push(chunk.slice()),
				close: async () => {
					closed = true
				},
				abort: async () => {
					chunks.length = 0
				},
			},
			getBlob: () => new Blob(closed ? chunks : []),
			getBytesWritten: () => chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
		}
	}
	return {
		...actual,
		createBufferedPptxSink,
		PPTX_MIME_TYPE: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		exportPPTXLegacy: mocks.exportPPTXLegacy,
		exportPPTXStreaming: mocks.exportPPTXStreaming,
		imagePolicyRequiresReplay: mocks.imagePolicyRequiresReplay,
	}
})

import {
	createPptxSlideConfig,
	resolvePptScaleContentDimensions,
} from "@/pages/superMagic/components/Detail/contents/HTML/utils/slide-dimensions"
import {
	assertPptxExportAvailable,
	createPptxBufferedDestinationLease,
	ensurePptxFileName,
	formatPptxStreamingProgress,
	openPptxDestination,
	peekAndReplayAsyncIterable,
	peekStreamingPage,
	PptxExportUnavailableError,
	startPptxStreamingExportFromFactory,
	supportsPptxFileStreaming,
	supportsPptxExport,
} from "../pptxStreamingExport"

const originalPicker = Object.getOwnPropertyDescriptor(globalThis, "showSaveFilePicker")

function createDestination(): PptxDestination {
	return {
		kind: "sink-proxy",
		sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
	}
}

beforeEach(() => {
	mocks.exportPPTXLegacy.mockReset()
	mocks.exportPPTXStreaming.mockReset()
})

afterEach(() => {
	vi.restoreAllMocks()
	if (originalPicker) {
		Object.defineProperty(globalThis, "showSaveFilePicker", originalPicker)
	} else {
		Reflect.deleteProperty(globalThis, "showSaveFilePicker")
	}
})

describe("pptxStreamingExport", () => {
	it("normalizes a suggested PPTX file name", () => {
		expect(ensurePptxFileName("deck")).toBe("deck.pptx")
		expect(ensurePptxFileName("deck.PPTX")).toBe("deck.PPTX")
		expect(ensurePptxFileName("   ")).toBe("export.pptx")
	})

	it("selects the legacy route when a browser lacks the file picker", async () => {
		Reflect.deleteProperty(globalThis, "showSaveFilePicker")
		expect(supportsPptxFileStreaming()).toBe(false)
		expect(supportsPptxExport()).toBe(true)
		const createObjectURL = vi.fn(() => "blob:pptx")
		const revokeObjectURL = vi.fn()
		vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectURL)
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectURL)
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => undefined)

		const lease = await openPptxDestination({ suggestedName: "deck" })
		expect(lease?.route).toBe("legacy-blob")
		expect(createObjectURL).not.toHaveBeenCalled()
		expect(click).not.toHaveBeenCalled()
	})

	it("routes browsers without a picker through the independent legacy exporter", async () => {
		Reflect.deleteProperty(globalThis, "showSaveFilePicker")
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:legacy-pptx")
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => undefined)
		mocks.exportPPTXLegacy.mockReturnValue({
			cancel: vi.fn(),
			promise: Promise.resolve({
				data: new Blob([new Uint8Array([1, 2, 3])]),
				fileName: "legacy.pptx",
				pageCount: 1,
				bytesWritten: 3,
			}),
		})
		const lease = await openPptxDestination({ suggestedName: "legacy" })
		if (!lease) throw new Error("Expected a legacy destination")

		const handle = startPptxStreamingExportFromFactory(
			async function* () {
				yield "<main>legacy</main>"
			},
			{
				fileName: "legacy",
				destination: lease.destination,
				outputPolicy: "file-stream",
			},
		)
		await handle.promise

		expect(mocks.exportPPTXLegacy).toHaveBeenCalledOnce()
		expect(mocks.exportPPTXStreaming).not.toHaveBeenCalled()
		expect(click).toHaveBeenCalledOnce()
	})

	it("uses the legacy exporter when the browser lacks a file picker", async () => {
		Reflect.deleteProperty(globalThis, "showSaveFilePicker")
		mocks.exportPPTXLegacy.mockReturnValue({
			cancel: vi.fn(),
			promise: Promise.resolve({
				data: new Blob([new Uint8Array([1, 2, 3])]),
				fileName: "deck.pptx",
				pageCount: 1,
				bytesWritten: 0,
			}),
		})
		const lease = await openPptxDestination({ suggestedName: "deck" })
		if (!lease) throw new Error("Expected a buffered destination")

		const handle = startPptxStreamingExportFromFactory(
			async function* () {
				yield "<main>buffered</main>"
			},
			{
				fileName: "deck",
				destination: lease.destination,
				outputPolicy: "file-stream",
				autoSize: true,
			},
		)
		await handle.promise

		expect(mocks.exportPPTXLegacy).toHaveBeenCalledOnce()
		expect(mocks.exportPPTXStreaming).not.toHaveBeenCalled()
	})

	it("falls back to a buffered destination when createWritable is rejected", async () => {
		const createWritable = vi.fn(async () => {
			throw new DOMException("unsupported", "NotSupportedError")
		})
		Object.defineProperty(globalThis, "showSaveFilePicker", {
			configurable: true,
			value: vi.fn(async () => ({ createWritable })),
		})

		const lease = await openPptxDestination({ suggestedName: "fallback" })

		expect(createWritable).toHaveBeenCalledOnce()
		expect(lease?.route).toBe("buffered-download")
	})

	it("throws a structured unavailable error when no client download exists", () => {
		Reflect.deleteProperty(globalThis, "showSaveFilePicker")

		expect(() =>
			assertPptxExportAvailable({ pageCount: 1, bufferedDownloadAvailable: false }),
		).toThrow(PptxExportUnavailableError)
		try {
			assertPptxExportAvailable({ pageCount: 1, bufferedDownloadAvailable: false })
		} catch (error) {
			expect(error).toMatchObject({
				name: "PptxExportUnavailableError",
				code: "file-stream-unavailable",
				decision: { route: "unavailable" },
			})
		}
	})

	it("opens one final file destination and adapts it to an ACK sink", async () => {
		const write = vi.fn(async () => undefined)
		const close = vi.fn(async () => undefined)
		const abort = vi.fn(async () => undefined)
		const createWritable = vi.fn(async () => ({ write, close, abort }))
		const picker = vi.fn(async () => ({ createWritable }))
		Object.defineProperty(globalThis, "showSaveFilePicker", {
			configurable: true,
			value: picker,
		})

		expect(supportsPptxFileStreaming()).toBe(true)
		const lease = await openPptxDestination({ suggestedName: "Quarterly report" })
		expect(lease).not.toBeNull()
		expect(picker).toHaveBeenCalledWith(
			expect.objectContaining({ suggestedName: "Quarterly report.pptx" }),
		)
		expect(createWritable).toHaveBeenCalledOnce()

		const destination = lease?.destination
		if (!destination || !("kind" in destination) || destination.kind !== "sink-proxy") {
			throw new Error("Expected a sink-proxy destination")
		}

		const chunk = new Uint8Array([1, 2, 3])
		await destination.sink.write(chunk)
		await destination.sink.close()
		await lease.abort(new Error("late abort"))

		expect(write).toHaveBeenCalledWith(chunk)
		expect(close).toHaveBeenCalledOnce()
		expect(abort).not.toHaveBeenCalled()
	})

	it("buffers chunks and aborts without starting a download", async () => {
		const createObjectURL = vi.fn(() => "blob:pptx")
		vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectURL)
		const lease = createPptxBufferedDestinationLease("deck")
		const destination = lease.destination
		if (!("kind" in destination) || destination.kind !== "sink-proxy") {
			throw new Error("Expected a sink-proxy destination")
		}
		await destination.sink.write(Uint8Array.of(1, 2, 3))
		await lease.abort(new Error("cancelled"))
		expect(createObjectURL).not.toHaveBeenCalled()
	})

	it("can abort the partial destination after close fails", async () => {
		const closeError = new Error("disk commit failed")
		const write = vi.fn(async () => undefined)
		const close = vi.fn(async () => {
			throw closeError
		})
		const abort = vi.fn(async () => undefined)
		const createWritable = vi.fn(async () => ({ write, close, abort }))
		Object.defineProperty(globalThis, "showSaveFilePicker", {
			configurable: true,
			value: vi.fn(async () => ({ createWritable })),
		})

		const lease = await openPptxDestination({ suggestedName: "deck" })
		const destination = lease?.destination
		if (!destination || !("kind" in destination) || destination.kind !== "sink-proxy") {
			throw new Error("Expected a sink-proxy destination")
		}

		await expect(destination.sink.close()).rejects.toBe(closeError)
		await lease.abort(closeError)

		expect(close).toHaveBeenCalledOnce()
		expect(abort).toHaveBeenCalledWith(closeError)
	})

	it("allows cancellation to abort while destination close is still pending", async () => {
		let resolveClose: (() => void) | undefined
		const close = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveClose = resolve
				}),
		)
		const abort = vi.fn(async () => undefined)
		const createWritable = vi.fn(async () => ({ write: vi.fn(), close, abort }))
		Object.defineProperty(globalThis, "showSaveFilePicker", {
			configurable: true,
			value: vi.fn(async () => ({ createWritable })),
		})
		const lease = await openPptxDestination({ suggestedName: "deck" })
		const destination = lease?.destination
		if (!destination || !("kind" in destination) || destination.kind !== "sink-proxy") {
			throw new Error("Expected a sink-proxy destination")
		}

		const closeOperation = destination.sink.close()
		const cancelReason = new DOMException("cancelled", "AbortError")
		await lease.abort(cancelReason)

		expect(abort).toHaveBeenCalledWith(cancelReason)
		resolveClose?.()
		await closeOperation
		await expect(destination.sink.write(Uint8Array.of(1))).rejects.toThrow(
			"already closing or closed",
		)
	})

	it("treats picker cancellation as no export", async () => {
		Object.defineProperty(globalThis, "showSaveFilePicker", {
			configurable: true,
			value: vi.fn(async () => {
				throw new DOMException("cancelled", "AbortError")
			}),
		})

		await expect(openPptxDestination({ suggestedName: "deck" })).resolves.toBeNull()
	})

	it("formats page progress without exposing the internal export phase", () => {
		expect(
			formatPptxStreamingProgress("Exporting", {
				phase: "package-page",
				pageIndex: 8,
				pageCount: 300,
			}),
		).toBe("Exporting (9/300)")
		expect(
			formatPptxStreamingProgress("Exporting", {
				phase: "stage-media",
				pageIndex: 0,
				pageCount: 6,
			}),
		).toBe("Exporting (1/6)")
	})

	it("peeks the first page once and replays the source in order", async () => {
		const pulled: string[] = []
		async function* createPages() {
			pulled.push("first")
			yield "<main>first</main>"
			pulled.push("second")
			yield { index: 8, key: "second", html: "<main>second</main>" }
		}

		const controller = new AbortController()
		const peeked = await peekStreamingPage(createPages(), controller.signal)

		expect(peeked.firstPage).toEqual({ index: 0, html: "<main>first</main>" })
		expect(pulled).toEqual(["first"])

		const replayed = []
		for await (const page of peeked.pages) replayed.push(page)

		expect(replayed).toEqual([
			{ index: 0, html: "<main>first</main>" },
			{ index: 8, key: "second", html: "<main>second</main>" },
		])
		expect(pulled).toEqual(["first", "second"])
	})

	it("passes the normalized first page to the options resolver and keeps portrait sizing", async () => {
		const consumedPages: Array<{ index: number; html: string }> = []
		mocks.exportPPTXStreaming.mockImplementation(
			(
				pages: AsyncIterable<{ index: number; html: string }>,
				options: Record<string, unknown>,
			) => ({
				cancel: vi.fn(),
				promise: (async () => {
					for await (const page of pages) consumedPages.push(page)
					return { pageCount: consumedPages.length, bytesWritten: 0, options }
				})(),
			}),
		)
		const portraitHtml =
			'<main class="ft-canvas" style="width: 1080px; height: 1920px">portrait</main>'
		const resolver = vi.fn((firstPage: { html: string }) => ({
			fileName: "portrait",
			destination: createDestination(),
			outputPolicy: "file-stream" as const,
			config: createPptxSlideConfig(resolvePptScaleContentDimensions(firstPage.html)),
		}))

		const handle = startPptxStreamingExportFromFactory(async function* () {
			yield portraitHtml
			yield "<main>second</main>"
		}, resolver)
		await handle.promise

		expect(resolver).toHaveBeenCalledOnce()
		expect(resolver).toHaveBeenCalledWith({ index: 0, html: portraitHtml })
		expect(mocks.exportPPTXStreaming).toHaveBeenCalledOnce()
		expect(mocks.exportPPTXStreaming.mock.calls[0][1]).toEqual(
			expect.objectContaining({
				mediaPolicy: expect.objectContaining({ mode: "direct-stream" }),
				config: {
					htmlWidth: 1080,
					htmlHeight: 1920,
					slideWidth: 11.25,
					slideHeight: 20,
				},
			}),
		)
		expect(consumedPages).toEqual([
			{ index: 0, html: portraitHtml },
			{ index: 1, html: "<main>second</main>" },
		])
	})

	it("keeps image-policy replay on rolling-stage media mode", async () => {
		mocks.exportPPTXStreaming.mockImplementation(
			(_pages: AsyncIterable<unknown>, options: Record<string, unknown>) => ({
				cancel: vi.fn(),
				promise: Promise.resolve({ pageCount: 1, bytesWritten: 0, options }),
			}),
		)

		const handle = startPptxStreamingExportFromFactory(
			async function* () {
				yield "<main>image</main>"
			},
			{
				destination: createDestination(),
				outputPolicy: "file-stream",
				imagePolicy: { maxPixels: 100 },
			},
		)
		await handle.promise

		expect(mocks.exportPPTXStreaming.mock.calls[0][1]).toEqual(
			expect.objectContaining({
				mediaPolicy: expect.objectContaining({ mode: "rolling-stage" }),
			}),
		)
	})

	it("rejects an empty page source before starting html2pptx", async () => {
		const handle = startPptxStreamingExportFromFactory(
			() => ({
				[Symbol.asyncIterator]: () => ({
					next: async () => ({ done: true, value: undefined }),
				}),
			}),
			{ destination: createDestination(), outputPolicy: "file-stream" },
		)

		await expect(handle.promise).rejects.toThrow("PPTX page source did not yield any pages")
		expect(mocks.exportPPTXStreaming).not.toHaveBeenCalled()
	})

	it("cancels immediately while the page provider is waiting", async () => {
		let providerAbortObserved = false
		let markProviderStarted: (() => void) | undefined
		const providerStarted = new Promise<void>((resolve) => {
			markProviderStarted = resolve
		})
		const handle = startPptxStreamingExportFromFactory(
			(signal) => {
				const waitingSource: AsyncIterable<string> = {
					[Symbol.asyncIterator]() {
						return {
							next: () => {
								markProviderStarted?.()
								return new Promise<IteratorResult<string>>((_, reject) => {
									signal.addEventListener(
										"abort",
										() => {
											providerAbortObserved = true
											reject(signal.reason)
										},
										{ once: true },
									)
								})
							},
						}
					},
				}
				return waitingSource
			},
			{
				destination: createDestination(),
				outputPolicy: "file-stream",
			},
		)
		const rejection = expect(handle.promise).rejects.toMatchObject({ name: "AbortError" })
		await providerStarted

		handle.cancel()

		await rejection
		expect(providerAbortObserved).toBe(true)
		expect(mocks.exportPPTXStreaming).not.toHaveBeenCalled()
	})

	it("closes the source when cancellation races with the first resolved page", async () => {
		const controller = new AbortController()
		const iterator = {
			next: vi.fn(async () => ({ done: false as const, value: "first" })),
			return: vi.fn(async () => ({ done: true as const, value: undefined })),
		}
		const peekPromise = peekAndReplayAsyncIterable(
			{ [Symbol.asyncIterator]: () => iterator },
			controller.signal,
		)
		queueMicrotask(() => controller.abort())

		await expect(peekPromise).rejects.toMatchObject({ name: "AbortError" })
		expect(iterator.return).toHaveBeenCalledOnce()
	})

	it("propagates cancellation after the inner streaming handle starts", async () => {
		let rejectInner: ((reason?: unknown) => void) | undefined
		const innerCancel = vi.fn(() => {
			rejectInner?.(new DOMException("cancelled", "AbortError"))
		})
		mocks.exportPPTXStreaming.mockImplementation(() => ({
			cancel: innerCancel,
			promise: new Promise((_, reject) => {
				rejectInner = reject
			}),
		}))
		const handle = startPptxStreamingExportFromFactory(
			async function* () {
				yield "<main>first</main>"
			},
			{
				destination: createDestination(),
				outputPolicy: "file-stream",
			},
		)
		await vi.waitFor(() => expect(mocks.exportPPTXStreaming).toHaveBeenCalledOnce())
		const rejection = expect(handle.promise).rejects.toMatchObject({ name: "AbortError" })

		handle.cancel()

		expect(innerCancel).toHaveBeenCalledOnce()
		await rejection
	})
})
