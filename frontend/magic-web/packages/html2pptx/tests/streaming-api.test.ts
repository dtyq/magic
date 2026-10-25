import { describe, expect, it, vi } from "vitest"
import type { SandboxInstance } from "../src/sandbox"
import {
	createPptxStreamingExporter,
	type ExportProgress,
	type PptxDestination,
	type StreamingExportTaskInput,
} from "../src"

function createSandboxStub() {
	return {
		iframe: {} as HTMLIFrameElement,
		window: {} as Window,
		document: {} as Document,
		render: vi.fn(),
		destroy: vi.fn(),
	} satisfies SandboxInstance
}

function createDestination(): PptxDestination {
	return {
		kind: "sink-proxy",
		sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
	}
}

describe("streaming export API", () => {
	it("normalizes compatibility inputs lazily for the injected streaming runtime", async () => {
		const sandbox = createSandboxStub()
		const progress: ExportProgress[] = []
		const workerUrl = new URL("https://cdn.example.test/html2pptx/packaging-worker.js")
		const destination = createDestination()
		let task: StreamingExportTaskInput | undefined
		const exportStreaming = vi.fn(async (input: StreamingExportTaskInput) => {
			task = input
			const pages = []
			for await (const page of input.pages) pages.push(page)
			expect(pages).toEqual([
				{ index: 0, html: "first" },
				{ index: 7, html: "second", key: "business-page" },
			])
			return {
				fileName: input.fileName,
				pageCount: pages.length,
				mediaPartCount: 1,
				bytesWritten: 4096,
				durationMs: 25,
			}
		})
		const exporter = createPptxStreamingExporter({
			createSandbox: () => sandbox,
			pipeline: { exportStreaming },
		})

		const handle = exporter(["first", { index: 7, html: "second", key: "business-page" }], {
			fileName: "large.pptx",
			outputPolicy: "file-stream",
			destination,
			workerUrl,
			onProgress: (value) => progress.push(value),
		})

		await expect(handle.promise).resolves.toEqual({
			fileName: "large.pptx",
			pageCount: 2,
			mediaPartCount: 1,
			bytesWritten: 4096,
			durationMs: 25,
		})
		expect(exportStreaming).toHaveBeenCalledOnce()
		expect(task?.pageCount).toBe(2)
		expect(task?.outputPolicy).toBe("file-stream")
		expect(task?.destination).toBe(destination)
		expect(task?.workerUrl).toBe(workerUrl)
		expect(progress).toEqual([
			{ phase: "preflight", pageCount: 2 },
			{ phase: "completed", pageCount: 2, bytesWritten: 4096 },
		])
		expect(sandbox.destroy).toHaveBeenCalledOnce()
	})

	it("uses the default streaming runner when only the packager is injected", async () => {
		const sandbox = createSandboxStub()
		const workerUrl = new URL("https://cdn.example.test/html2pptx/packaging-worker.js")
		const packager = {
			state: "accepting-slides" as const,
			ready: Promise.resolve(),
			commitSlide: vi.fn(async () => ({ bytesWritten: 1, manifest: {} })),
			commitSlides: vi.fn(),
			finalize: vi.fn(async () => ({ slideCount: 1, mediaPartCount: 0, bytesWritten: 1 })),
			abort: vi.fn(async () => undefined),
			dispose: vi.fn(),
		}
		const createPackager = vi.fn(() => packager)
		const exporter = createPptxStreamingExporter({
			createSandbox: () => sandbox,
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: createPackager,
			},
		})

		const handle = exporter(["page"], {
			workerUrl,
			destination: createDestination(),
		})
		await expect(handle.promise).resolves.toMatchObject({ pageCount: 1, bytesWritten: 1 })
		expect(createPackager).toHaveBeenCalledWith(expect.objectContaining({ workerUrl }))
		expect(packager.commitSlide).toHaveBeenCalledOnce()
		expect(sandbox.destroy).toHaveBeenCalledOnce()
	})

	it("forwards cancellation and destroys the sandbox", async () => {
		const sandbox = createSandboxStub()
		const exporter = createPptxStreamingExporter({
			createSandbox: () => sandbox,
			pipeline: {
				exportStreaming: ({ signal }) =>
					new Promise((_, reject) => {
						signal.addEventListener(
							"abort",
							() => reject(new DOMException("Export aborted", "AbortError")),
							{ once: true },
						)
					}),
			},
		})

		const handle = exporter(["page"], { destination: createDestination() })
		handle.cancel()

		await expect(handle.promise).rejects.toMatchObject({ name: "AbortError" })
		expect(sandbox.destroy).toHaveBeenCalledOnce()
	})

	it("rejects before an injected runner can bypass the destination gate", async () => {
		const exportStreaming = vi.fn(async (_input: StreamingExportTaskInput) => ({
			fileName: "should-not-complete.pptx",
			pageCount: 1,
			mediaPartCount: 0,
			bytesWritten: 1,
			durationMs: 1,
		}))
		const exporter = createPptxStreamingExporter({ pipeline: { exportStreaming } })
		const optionsWithoutDestination = {
			fileName: "missing-destination.pptx",
			outputPolicy: "file-stream",
		} as unknown as Parameters<typeof exporter>[1]

		const handle = exporter(["page"], optionsWithoutDestination)

		await expect(handle.promise).rejects.toMatchObject({
			name: "PptxExportError",
			code: "preflight-rejected",
			diagnostic: {
				details: {
					issues: expect.arrayContaining([
						expect.objectContaining({ code: "destination-required" }),
					]),
				},
			},
		})
		expect(exportStreaming).not.toHaveBeenCalled()
	})

	it("aborts the selected destination when setup fails before the runner starts", async () => {
		const setupError = new Error("sandbox setup failed")
		const abort = vi.fn(async () => undefined)
		const exporter = createPptxStreamingExporter({
			createSandbox: () => {
				throw setupError
			},
		})

		const handle = exporter(["page"], {
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close: vi.fn(), abort },
			},
		})

		await expect(handle.promise).rejects.toBe(setupError)
		expect(abort).toHaveBeenCalledWith(setupError)
	})

	it("keeps a completed export successful when cancel races with the resolved runner", async () => {
		const sandbox = createSandboxStub()
		const summary = {
			fileName: "completed.pptx",
			pageCount: 1,
			mediaPartCount: 0,
			bytesWritten: 1024,
			durationMs: 10,
		}
		const exporter = createPptxStreamingExporter({
			createSandbox: () => sandbox,
			pipeline: {
				exportStreaming: vi.fn(() => Promise.resolve(summary)),
			},
		})

		const handle = exporter(["page"], { destination: createDestination() })
		handle.cancel()

		await expect(handle.promise).resolves.toEqual(summary)
		expect(sandbox.destroy).toHaveBeenCalledOnce()
	})
})
