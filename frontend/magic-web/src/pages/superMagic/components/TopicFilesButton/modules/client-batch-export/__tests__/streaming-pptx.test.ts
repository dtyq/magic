import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	loadJSZip: vi.fn(),
	supportsFileStreaming: vi.fn(),
	openPptxDestination: vi.fn(),
	startFromFactory: vi.fn(),
	iterateSingleExportSlide: vi.fn(),
	iterateExportSlides: vi.fn(),
	documentRuntime: vi.fn(),
	resolvedOptions: [] as Array<Record<string, any>>,
	activeExports: 0,
	maxActiveExports: 0,
	emitExportIssue: false,
}))

vi.mock("@/lib/jszip", () => ({ loadJSZip: mocks.loadJSZip }))
vi.mock("@/utils/htmlExportPrepare", () => ({ prepareHtmlPagesForExport: vi.fn() }))
vi.mock("@/pages/superMagic/services/pptService", () => ({
	prepareExportSlides: vi.fn(),
	resolvePptExportSlides: vi.fn(async (input) => ({ ...input, configResolved: true })),
	prepareSingleSlideExport: vi.fn(),
	iterateSingleExportSlide: mocks.iterateSingleExportSlide,
	iterateExportSlides: mocks.iterateExportSlides,
}))
vi.mock("@/pages/superMagic/services/documentExport", () => ({
	documentExportService: { get: mocks.documentRuntime },
}))
vi.mock("@/pages/superMagic/services/pptxStreamingExport", () => ({
	createPptxDestinationLease: (writable: {
		write: (chunk: Uint8Array) => Promise<void>
		close: () => Promise<void>
		abort: (reason?: unknown) => Promise<void>
	}) => ({
		destination: { kind: "sink-proxy" as const, sink: writable },
		abort: writable.abort,
	}),
	ensurePptxFileName: (fileName: string) =>
		/\.pptx$/i.test(fileName) ? fileName : `${fileName}.pptx`,
	iteratePreparedPptxPages: (pages: AsyncIterable<unknown>) => pages,
	openPptxDestination: mocks.openPptxDestination,
	startPptxStreamingExportFromFactory: mocks.startFromFactory,
	supportsPptxExport: mocks.supportsFileStreaming,
	supportsPptxFileStreaming: mocks.supportsFileStreaming,
}))
vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils/slide-dimensions", () => ({
	resolvePptScaleContentDimensions: (html: string) => {
		const width = Number(html.match(/data-width=["'](\d+)/)?.[1] || 1920)
		const height = Number(html.match(/data-height=["'](\d+)/)?.[1] || 1080)
		return { width, height }
	},
	createPptxSlideConfig: ({ width, height }: { width: number; height: number }) => ({
		htmlWidth: width,
		htmlHeight: height,
		slideWidth: width / 96,
		slideHeight: height / 96,
	}),
}))

import { runClientBatchDocumentExport } from "../index"
import type { ClientBatchExportTarget } from "../types"

function target(fileId: string, fileName = "Deck.html"): ClientBatchExportTarget {
	return {
		item: { file_id: fileId, file_name: fileName },
		isSlideProject: false,
	}
}

function asyncPages(fileId: string) {
	return (async function* () {
		const portrait = fileId === "portrait"
		yield {
			index: 0,
			html: portrait
				? '<div class="slide-container" data-width="1080" data-height="1920"></div>'
				: '<div class="slide-container" data-width="1600" data-height="900"></div>',
		}
	})()
}

function createSinkLease() {
	const write = vi.fn(async () => undefined)
	const close = vi.fn(async () => undefined)
	const abort = vi.fn(async () => undefined)
	return {
		lease: {
			destination: { kind: "sink-proxy" as const, sink: { write, close, abort } },
			abort,
		},
		write,
		close,
		abort,
	}
}

beforeEach(() => {
	vi.clearAllMocks()
	mocks.resolvedOptions.length = 0
	mocks.activeExports = 0
	mocks.maxActiveExports = 0
	mocks.emitExportIssue = false
	mocks.documentRuntime.mockReturnValue({ getPptFontResolver: () => undefined })
	mocks.iterateSingleExportSlide.mockImplementation(({ fileId }: { fileId: string }) =>
		asyncPages(fileId),
	)
	mocks.startFromFactory.mockImplementation(
		(
			createPages: (signal: AbortSignal) => AsyncIterable<any>,
			resolveOptions: (firstPage: any) => Record<string, any>,
		) => {
			const controller = new AbortController()
			const promise = (async () => {
				mocks.activeExports += 1
				mocks.maxActiveExports = Math.max(mocks.maxActiveExports, mocks.activeExports)
				const iterator = createPages(controller.signal)[Symbol.asyncIterator]()
				try {
					const first = await iterator.next()
					if (first.done) throw new Error("empty source")
					const options = await resolveOptions(first.value)
					mocks.resolvedOptions.push(options)
					if (mocks.emitExportIssue) {
						options.onExportIssue?.({
							pageIndex: 3,
							pageName: "page-04.html",
							code: "render-error",
							message: "Unable to inspect media resource",
							severity: "error",
						})
					}
					const destination = options.destination
					if (destination?.kind === "sink-proxy") {
						await destination.sink.write(Uint8Array.of(1))
						await destination.sink.close()
					}
				} finally {
					await iterator.return?.()
					mocks.activeExports -= 1
				}
			})()
			return { promise, cancel: () => controller.abort() }
		},
	)
})

afterEach(() => {
	Reflect.deleteProperty(globalThis, "showDirectoryPicker")
})

describe("client batch PPTX streaming", () => {
	it("streams a single target to one file and derives portrait dimensions from the first page", async () => {
		const sink = createSinkLease()
		mocks.supportsFileStreaming.mockReturnValue(true)
		mocks.openPptxDestination.mockResolvedValue(sink.lease)

		const result = await runClientBatchDocumentExport({
			format: "pptx",
			targets: [target("portrait", "Portrait.html")],
			attachments: [],
		})

		expect(result).toMatchObject({
			streamedToDisk: true,
			successCount: 1,
			failureCount: 0,
		})
		expect(result.artifact).toBeUndefined()
		expect(mocks.openPptxDestination).toHaveBeenCalledBefore(mocks.iterateSingleExportSlide)
		expect(mocks.resolvedOptions[0]?.config).toMatchObject({
			htmlWidth: 1080,
			htmlHeight: 1920,
		})
		expect(sink.write).toHaveBeenCalledOnce()
		expect(sink.close).toHaveBeenCalledOnce()
		expect(mocks.loadJSZip).not.toHaveBeenCalled()
	})

	it("forwards recoverable page issues to the batch export caller", async () => {
		const sink = createSinkLease()
		const issues: unknown[] = []
		mocks.emitExportIssue = true
		mocks.supportsFileStreaming.mockReturnValue(true)
		mocks.openPptxDestination.mockResolvedValue(sink.lease)

		await runClientBatchDocumentExport({
			format: "pptx",
			targets: [target("one")],
			attachments: [],
			onExportIssue: (issue) => issues.push(issue),
		})

		expect(issues).toEqual([
			expect.objectContaining({
				pageIndex: 3,
				pageName: "page-04.html",
				code: "render-error",
			}),
		])
	})

	it("writes multiple targets serially into one selected directory without Blob aggregation", async () => {
		mocks.supportsFileStreaming.mockReturnValue(false)
		const createdNames: string[] = []
		const close = vi.fn(async () => undefined)
		const abort = vi.fn(async () => undefined)
		const directory = {
			getFileHandle: vi.fn(async (fileName: string) => {
				createdNames.push(fileName)
				return {
					createWritable: vi.fn(async () => ({
						write: vi.fn(async () => undefined),
						close,
						abort,
					})),
				}
			}),
		}
		const directoryPicker = vi.fn(async () => directory)
		Object.defineProperty(globalThis, "showDirectoryPicker", {
			configurable: true,
			value: directoryPicker,
		})

		const result = await runClientBatchDocumentExport({
			format: "pptx",
			targets: [target("one"), target("two")],
			attachments: [],
		})

		expect(result).toMatchObject({
			streamedToDisk: true,
			successCount: 2,
			failureCount: 0,
		})
		expect(createdNames).toEqual(["Deck.pptx", "Deck (2).pptx"])
		expect(directoryPicker).toHaveBeenCalledOnce()
		expect(mocks.maxActiveExports).toBe(1)
		expect(close).toHaveBeenCalledTimes(2)
		expect(mocks.loadJSZip).not.toHaveBeenCalled()
	})

	it("treats a cancelled single-file picker as no export", async () => {
		mocks.supportsFileStreaming.mockReturnValue(true)
		mocks.openPptxDestination.mockResolvedValue(null)

		const result = await runClientBatchDocumentExport({
			format: "pptx",
			targets: [target("one")],
			attachments: [],
		})

		expect(result).toMatchObject({ cancelled: true, successCount: 0, failureCount: 0 })
		expect(mocks.openPptxDestination).toHaveBeenCalledOnce()
		expect(mocks.startFromFactory).not.toHaveBeenCalled()
	})

	it("reports multi-target PPTX as unavailable instead of falling back to memory", async () => {
		mocks.supportsFileStreaming.mockReturnValue(true)

		const result = await runClientBatchDocumentExport({
			format: "pptx",
			targets: [target("one"), target("two")],
			attachments: [],
		})

		expect(result).toMatchObject({
			unavailable: true,
			successCount: 0,
		})
		expect(result.streamedToDisk).toBeUndefined()
		expect(mocks.startFromFactory).not.toHaveBeenCalled()
		expect(mocks.loadJSZip).not.toHaveBeenCalled()
	})

	it("cancels the active streaming target and aborts its destination", async () => {
		const sink = createSinkLease()
		const controller = new AbortController()
		let rejectExport: ((reason?: unknown) => void) | undefined
		const cancel = vi.fn(() => {
			rejectExport?.(new DOMException("cancelled", "AbortError"))
		})
		mocks.supportsFileStreaming.mockReturnValue(true)
		mocks.openPptxDestination.mockResolvedValue(sink.lease)
		mocks.startFromFactory.mockReturnValue({
			cancel,
			promise: new Promise((_, reject) => {
				rejectExport = reject
			}),
		})

		const resultPromise = runClientBatchDocumentExport({
			format: "pptx",
			targets: [target("one")],
			attachments: [],
			signal: controller.signal,
		})
		await vi.waitFor(() => expect(mocks.startFromFactory).toHaveBeenCalledOnce())

		controller.abort()
		const result = await resultPromise

		expect(result).toMatchObject({ cancelled: true, successCount: 0, failureCount: 0 })
		expect(cancel).toHaveBeenCalledOnce()
		expect(sink.abort).toHaveBeenCalledOnce()
	})

	it("does not start later directory targets after cancellation", async () => {
		mocks.supportsFileStreaming.mockReturnValue(false)
		const controller = new AbortController()
		const abort = vi.fn(async () => undefined)
		const directory = {
			getFileHandle: vi.fn(async () => ({
				createWritable: vi.fn(async () => ({
					write: vi.fn(async () => undefined),
					close: vi.fn(async () => undefined),
					abort,
				})),
			})),
		}
		Object.defineProperty(globalThis, "showDirectoryPicker", {
			configurable: true,
			value: vi.fn(async () => directory),
		})
		let rejectExport: ((reason?: unknown) => void) | undefined
		const cancel = vi.fn(() => {
			rejectExport?.(new DOMException("cancelled", "AbortError"))
		})
		mocks.startFromFactory.mockReturnValue({
			cancel,
			promise: new Promise((_, reject) => {
				rejectExport = reject
			}),
		})

		const resultPromise = runClientBatchDocumentExport({
			format: "pptx",
			targets: [target("one"), target("two")],
			attachments: [],
			signal: controller.signal,
		})
		await vi.waitFor(() => expect(mocks.startFromFactory).toHaveBeenCalledOnce())

		controller.abort()
		const result = await resultPromise

		expect(result).toMatchObject({ cancelled: true, successCount: 0 })
		expect(cancel).toHaveBeenCalledOnce()
		expect(abort).toHaveBeenCalledOnce()
		expect(directory.getFileHandle).toHaveBeenCalledOnce()
		expect(mocks.startFromFactory).toHaveBeenCalledOnce()
	})
})
