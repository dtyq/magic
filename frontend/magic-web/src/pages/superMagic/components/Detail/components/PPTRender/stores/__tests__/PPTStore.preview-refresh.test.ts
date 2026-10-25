import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PPT_FILE_UPDATE_DEBOUNCE_MS, PPTStore } from "../PPTStore"
import { SlideScreenshotService } from "../../services/SlideScreenshotService"

const mockState = vi.hoisted(() => ({
	downloadFileContent: vi.fn(),
	getTemporaryDownloadUrl: vi.fn(),
	processHtmlContent: vi.fn(),
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	downloadFileContent: mockState.downloadFileContent,
	getTemporaryDownloadUrl: mockState.getTemporaryDownloadUrl,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor", () => ({
	processHtmlContent: mockState.processHtmlContent,
	collectFileIdsFromHtml: vi.fn(() => new Set()),
}))

vi.mock("../../../../contents/HTML/utils/full-content", () => ({
	decodeHTMLEntities: (content: string) => content,
	fallbackImageBase64: "data:image/png;base64,",
	getFullContent: (content: string) => content,
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			warn: vi.fn(),
			error: vi.fn(),
		}),
	},
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

function createFinishedDeckAttachments(updatedAt = "1") {
	return [
		{
			file_id: "finished-folder",
			file_name: "SLIDE-finished",
			is_directory: true,
			relative_file_path: "SLIDE-finished",
			updated_at: updatedAt,
			children: [
				{
					file_id: "finished-slide",
					file_name: "1.html",
					relative_file_path: "SLIDE-finished/slides/1.html",
					updated_at: updatedAt,
				},
				{
					file_id: "finished-spec",
					file_name: "visual-spec.md",
					relative_file_path: "SLIDE-finished/visual-spec.md",
					updated_at: updatedAt,
				},
			],
		},
		{
			file_id: "making-folder",
			file_name: "SLIDE-making",
			is_directory: true,
			relative_file_path: "SLIDE-making",
			updated_at: updatedAt,
			children: [
				{
					file_id: "making-slide",
					file_name: "1.html",
					relative_file_path: "SLIDE-making/slides/1.html",
					updated_at: updatedAt,
				},
			],
		},
	]
}

describe("PPTStore preview refresh isolation", () => {
	let store: PPTStore

	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(SlideScreenshotService.prototype, "generateScreenshot").mockResolvedValue(
			"blob:regenerated",
		)
		mockState.processHtmlContent.mockImplementation(async ({ content }) => ({
			processedContent: content,
		}))
		mockState.downloadFileContent.mockResolvedValue("<div>finished</div>")
		mockState.getTemporaryDownloadUrl.mockImplementation(
			async ({ file_ids }: { file_ids: string[] }) =>
				file_ids.map((fileId) => ({
					file_id: fileId,
					url: `https://example.com/${fileId}.html`,
				})),
		)
		store = new PPTStore({
			attachments: [],
			attachmentList: createFinishedDeckAttachments(),
			mainFileId: "finished-folder",
			mainFileName: "SLIDE-finished",
			autoLoadAndGenerate: false,
			displayConfig: { slides: ["slides/1.html"] },
			logger: { enabled: false },
		})
		store.pathMappingService.setPathFileIdMapping("slides/1.html", "finished-slide")
		store.pathMappingService.setPathUrlMapping(
			"slides/1.html",
			"https://example.com/finished-slide.html",
		)
		store.setSlides(
			[
				{
					id: "slide-finished",
					path: "slides/1.html",
					url: "https://example.com/finished-slide.html",
					index: 0,
					loadingState: "loaded",
					content: "<div>finished</div>",
					thumbnailUrl: "blob:finished",
				},
			],
			true,
		)
	})

	afterEach(() => {
		store.dispose()
	})

	it("preserves the loaded preview when visibility metadata and attachments are reconciled", async () => {
		const slide = store.slides[0]
		for (const hiddenSlides of [["slides/1.html"], []]) {
			await store.updateConfig({
				displayConfig: { slides: ["slides/1.html"], hidden_slides: hiddenSlides },
			})
			await store.updateConfig({ attachmentList: createFinishedDeckAttachments() })
			expect(store.slides[0]).toBe(slide)
			expect(store.slides[0].content).toBe("<div>finished</div>")
			expect(store.slides[0].thumbnailUrl).toBe("blob:finished")
			expect(store.getConfigForExport().displayConfig?.hidden_slides).toEqual(hiddenSlides)
		}
		expect(mockState.downloadFileContent).not.toHaveBeenCalled()
	})

	it("does not reload a finished deck when the sibling template is rewritten", async () => {
		const nextAttachments = createFinishedDeckAttachments()
		nextAttachments[1] = {
			...nextAttachments[1],
			updated_at: "2",
			children: [
				{
					...nextAttachments[1].children[0],
					updated_at: "2",
				},
			],
		}

		await store.updateConfig({
			attachmentList: nextAttachments,
			displayConfig: { slides: ["slides/1.html"] },
		})

		expect(mockState.downloadFileContent).not.toHaveBeenCalled()
		expect(store.slides[0]?.content).toBe("<div>finished</div>")
		expect(store.slides[0]?.thumbnailUrl).toBe("blob:finished")
		expect(store.slides[0]?.loadingState).toBe("loaded")
	})

	it("does not reload slides when only a spec file in this folder changes", async () => {
		vi.useFakeTimers()
		try {
			const nextAttachments = createFinishedDeckAttachments()
			nextAttachments[0] = {
				...nextAttachments[0],
				children: [
					nextAttachments[0].children[0],
					{
						...nextAttachments[0].children[1],
						updated_at: "2",
					},
				],
			}

			const updatePromise = store.updateConfig({
				attachmentList: nextAttachments,
				displayConfig: { slides: ["slides/1.html"] },
			})
			await vi.advanceTimersByTimeAsync(PPT_FILE_UPDATE_DEBOUNCE_MS)
			await vi.runAllTimersAsync()
			await updatePromise
		} finally {
			vi.useRealTimers()
		}

		expect(mockState.downloadFileContent).not.toHaveBeenCalled()
		expect(store.slides[0]?.content).toBe("<div>finished</div>")
	})

	it("waits for slide writes to settle before reloading content", async () => {
		vi.useFakeTimers()
		try {
			const firstWrite = createFinishedDeckAttachments("2")
			const secondWrite = createFinishedDeckAttachments("3")
			const firstUpdate = store.updateConfig({
				attachmentList: firstWrite,
				displayConfig: { slides: ["slides/1.html"] },
			})
			await vi.advanceTimersByTimeAsync(PPT_FILE_UPDATE_DEBOUNCE_MS / 2)
			expect(mockState.downloadFileContent).not.toHaveBeenCalled()

			const secondUpdate = store.updateConfig({
				attachmentList: secondWrite,
				displayConfig: { slides: ["slides/1.html"] },
			})
			await Promise.all([firstUpdate, secondUpdate])
			await vi.advanceTimersByTimeAsync(PPT_FILE_UPDATE_DEBOUNCE_MS)
			await vi.runAllTimersAsync()
		} finally {
			vi.useRealTimers()
		}

		expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1)
	})
})
