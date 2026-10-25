import { describe, expect, it, vi } from "vitest"
import {
	createPptxStreamingExporter,
	getPptxExportDiagnostic,
	isOpfsUnavailableError,
	type PptxDestination,
} from "../src"
import type { SandboxInstance } from "../src/sandbox"

function createSandboxStub(): SandboxInstance {
	return {
		iframe: {} as HTMLIFrameElement,
		window: {} as Window,
		document: {} as Document,
		render: vi.fn(),
		destroy: vi.fn(),
	}
}

function createDestination(): PptxDestination {
	return {
		kind: "sink-proxy",
		sink: { write: vi.fn(), close: vi.fn(), abort: vi.fn() },
	}
}

describe("streaming export diagnostics", () => {
	it("returns the resolved execution path in ExportSummary", async () => {
		const packager = {
			state: "accepting-slides" as const,
			ready: Promise.resolve(),
			commitSlide: vi.fn(async () => ({ bytesWritten: 1, manifest: {} })),
			commitSlides: vi.fn(),
			finalize: vi.fn(async () => ({ slideCount: 1, mediaPartCount: 0, bytesWritten: 64 })),
			abort: vi.fn(async () => undefined),
			dispose: vi.fn(),
		}
		const exporter = createPptxStreamingExporter({
			createSandbox: createSandboxStub,
			pipeline: {
				prepareSlideNodes: vi.fn(async () => ({
					pptNodes: [],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				})),
				createStreamingPresentationPackager: vi.fn(() => packager),
			},
		})

		const summary = await exporter(["page"], {
			destination: createDestination(),
			mediaPolicy: { mode: "auto" },
		}).promise

		expect(summary.execution).toEqual({
			outputPolicy: "file-stream",
			mediaPolicyMode: "direct-stream",
			zipMode: "classic",
			pipeline: "direct",
		})
	})

	it("attaches structured preflight issues without parsing the message", async () => {
		const exporter = createPptxStreamingExporter({
			createSandbox: createSandboxStub,
			pipeline: {
				createStreamingPresentationPackager: vi.fn(),
			},
		})

		const missingDestinationOptions = undefined as unknown as Parameters<typeof exporter>[1]
		const error = await exporter(["page"], missingDestinationOptions).promise.catch(
			(value) => value,
		)
		const diagnostic = getPptxExportDiagnostic(error)

		expect(diagnostic).toMatchObject({
			phase: "preflight",
			code: "preflight-rejected",
			cancelled: false,
		})
		expect(diagnostic?.details?.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "destination-required" })]),
		)
	})

	it("classifies an unavailable OPFS staging capability structurally", async () => {
		vi.stubGlobal("navigator", {})
		const exporter = createPptxStreamingExporter({
			createSandbox: createSandboxStub,
			pipeline: {
				createStreamingPresentationPackager: vi.fn(),
			},
		})

		const error = await exporter(["page"], {
			destination: createDestination(),
			stagingPolicy: { mode: "opfs" },
		}).promise.catch((value) => value)

		expect(error).toMatchObject({
			name: "PptxExportError",
			code: "opfs-unavailable",
			diagnostic: {
				phase: "preflight",
				code: "opfs-unavailable",
				details: {
					issues: expect.arrayContaining([
						expect.objectContaining({
							code: "opfs-unavailable",
							details: {
								capability: "opfs-staging",
								detection: "navigator.storage.getDirectory",
							},
						}),
					]),
				},
			},
		})
	})

	it("recognizes an OPFS capability code carried by a wrapped Worker error", () => {
		const error = Object.assign(new Error("Central-directory metadata spill failed"), {
			name: "CentralDirectoryMetadataBudgetError",
			code: "CENTRAL_DIRECTORY_METADATA_BUDGET_EXCEEDED",
			causeCode: "OPFS_WRITE_UNAVAILABLE",
		})

		expect(isOpfsUnavailableError(error)).toBe(true)
	})

	it("classifies a Worker metadata spill cause as unavailable OPFS", async () => {
		const workerError = Object.assign(
			new Error("Central-directory metadata spill target could not be used"),
			{
				name: "CentralDirectoryMetadataBudgetError",
				code: "CENTRAL_DIRECTORY_METADATA_BUDGET_EXCEEDED",
				causeCode: "OPFS_WRITE_UNAVAILABLE",
			},
		)
		const packager = {
			state: "starting" as const,
			ready: Promise.reject(workerError),
			commitSlide: vi.fn(),
			commitSlides: vi.fn(),
			finalize: vi.fn(),
			abort: vi.fn(async () => undefined),
			dispose: vi.fn(),
		}
		const exporter = createPptxStreamingExporter({
			createSandbox: createSandboxStub,
			pipeline: {
				createStreamingPresentationPackager: vi.fn(() => packager),
			},
		})

		const error = await exporter(["page"], {
			destination: createDestination(),
		}).promise.catch((value) => value)

		expect(getPptxExportDiagnostic(error)).toMatchObject({
			phase: "worker",
			code: "opfs-unavailable",
			message: workerError.message,
		})
		expect(packager.abort).toHaveBeenCalledWith(workerError)
	})

	it("classifies a lazy page provider failure as source-failed", async () => {
		const sourceError = new Error("page provider failed")
		const packager = {
			state: "accepting-slides" as const,
			ready: Promise.resolve(),
			commitSlide: vi.fn(),
			commitSlides: vi.fn(),
			finalize: vi.fn(),
			abort: vi.fn(async () => undefined),
			dispose: vi.fn(),
		}
		const exporter = createPptxStreamingExporter({
			createSandbox: createSandboxStub,
			pipeline: {
				createStreamingPresentationPackager: vi.fn(() => packager),
			},
		})
		const pages: AsyncIterable<string> = {
			[Symbol.asyncIterator]() {
				return {
					next: async () => {
						throw sourceError
					},
				}
			},
		}

		const error = await exporter(pages, { destination: createDestination() }).promise.catch(
			(value) => value,
		)

		expect(getPptxExportDiagnostic(error)).toMatchObject({
			phase: "source",
			code: "source-failed",
			message: "page provider failed",
		})
		expect(packager.abort).toHaveBeenCalled()
	})
})
