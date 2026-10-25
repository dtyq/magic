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

function createProjectAttachments(options?: {
	coverUpdatedAt?: string
	page2?: { fileId?: string; updatedAt?: string }
	notesUpdatedAt?: string
}) {
	const files = [
		{
			file_id: "magic-project",
			file_name: "magic.project.js",
			relative_file_path: "deck/magic.project.js",
			updated_at: "1",
		},
		{
			file_id: "cover-file",
			file_name: "cover.html",
			relative_file_path: "deck/cover.html",
			updated_at: options?.coverUpdatedAt || "1",
		},
		{
			file_id: "notes-file",
			file_name: "notes.md",
			relative_file_path: "deck/notes.md",
			updated_at: options?.notesUpdatedAt || "1",
		},
	]
	if (options?.page2 !== undefined) {
		files.splice(2, 0, {
			file_id: options.page2.fileId || "page-2-file",
			file_name: "page-2.html",
			relative_file_path: "deck/page-2.html",
			updated_at: options.page2.updatedAt || "1",
		})
	}
	return files
}

describe("PPTStore original project refresh", () => {
	let store: PPTStore

	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(SlideScreenshotService.prototype, "generateScreenshot").mockResolvedValue(
			"blob:regenerated",
		)
		mockState.processHtmlContent.mockImplementation(async ({ content }) => ({
			processedContent: content,
		}))
		mockState.downloadFileContent.mockImplementation(async (url: string) => `<div>${url}</div>`)
		mockState.getTemporaryDownloadUrl.mockImplementation(
			async ({ file_ids }: { file_ids: string[] }) =>
				file_ids.map((fileId) => ({
					file_id: fileId,
					url: `https://example.com/${fileId}.html`,
				})),
		)
		store = new PPTStore({
			attachments: [],
			attachmentList: createProjectAttachments({ page2: {} }),
			mainFileId: "magic-project",
			mainFileName: "magic.project.js",
			autoLoadAndGenerate: false,
			displayConfig: { slides: ["cover.html", "page-2.html"] },
			logger: { enabled: false },
			fileUpdateDebounceMs: 0,
		})
		store.pathMappingService.setPathFileIdMapping("cover.html", "cover-file")
		store.pathMappingService.setPathFileIdMapping("page-2.html", "page-2-file")
		store.pathMappingService.setPathUrlMapping(
			"cover.html",
			"https://example.com/cover-file.html",
		)
		store.pathMappingService.setPathUrlMapping(
			"page-2.html",
			"https://example.com/page-2-file.html",
		)
		store.setSlides(
			[
				{
					id: "slide-cover",
					path: "cover.html",
					url: "https://example.com/cover-file.html",
					index: 0,
					loadingState: "loaded",
					content: "<div>cover</div>",
					thumbnailUrl: "blob:cover",
				},
				{
					id: "slide-page-2",
					path: "page-2.html",
					url: "https://example.com/page-2-file.html",
					index: 1,
					loadingState: "idle",
					thumbnailUrl: "blob:page-2",
				},
			],
			true,
		)
	})

	afterEach(() => {
		store.dispose()
	})

	it("reloads the active slide and refreshes its thumbnail in place when that HTML file changes", async () => {
		const generateScreenshot = vi
			.spyOn(
				(store as unknown as { screenshotService: SlideScreenshotService })
					.screenshotService,
				"generateScreenshot",
			)
			.mockResolvedValue("blob:regenerated")
		await store.updateConfig({
			attachmentList: createProjectAttachments({
				page2: {},
				coverUpdatedAt: "2",
			}),
			displayConfig: { slides: ["cover.html", "page-2.html"] },
		})

		expect(mockState.downloadFileContent).toHaveBeenCalledWith(
			"https://example.com/cover-file.html",
			expect.anything(),
		)
		expect(store.slides[0]?.content).toContain("cover-file")
		expect(generateScreenshot.mock.calls[0]?.[1]).toContain("cover-file")
		expect(store.slides[0]?.thumbnailUrl).toBe("blob:regenerated")
	})

	it("keeps the current HTML visible while a slide file is refreshing", async () => {
		let resolveDownload: ((content: string) => void) | undefined
		mockState.downloadFileContent.mockImplementation(
			() =>
				new Promise<string>((resolve) => {
					resolveDownload = resolve
				}),
		)

		const updatePromise = store.updateConfig({
			attachmentList: createProjectAttachments({
				page2: {},
				coverUpdatedAt: "2",
			}),
			displayConfig: { slides: ["cover.html", "page-2.html"] },
		})

		await vi.waitFor(() => expect(mockState.downloadFileContent).toHaveBeenCalled())
		expect(store.slides[0]?.content).toBe("<div>cover</div>")
		expect(store.slides[0]?.loadingState).toBe("loaded")

		resolveDownload?.("<div>updated-cover</div>")
		await updatePromise

		expect(store.slides[0]?.content).toBe("<div>updated-cover</div>")
		expect(store.slides[0]?.loadingState).toBe("loaded")
	})

	it("does not reload slides when only a non-slide file in the same folder changes", async () => {
		await store.updateConfig({
			attachmentList: createProjectAttachments({
				page2: {},
				notesUpdatedAt: "2",
			}),
			displayConfig: { slides: ["cover.html", "page-2.html"] },
		})

		expect(mockState.downloadFileContent).not.toHaveBeenCalled()
		expect(store.slides[0]?.content).toBe("<div>cover</div>")
		expect(store.slides[0]?.thumbnailUrl).toBe("blob:cover")
	})

	it("loads a visible idle slide after its HTML file settles", async () => {
		store.updateVisibleSlidePreviews([0, 1])
		mockState.downloadFileContent.mockClear()
		const generateScreenshot = vi
			.spyOn(
				(store as unknown as { screenshotService: SlideScreenshotService })
					.screenshotService,
				"generateScreenshot",
			)
			.mockResolvedValue("blob:regenerated")

		await store.updateConfig({
			attachmentList: createProjectAttachments({
				page2: { updatedAt: "2" },
			}),
			displayConfig: { slides: ["cover.html", "page-2.html"] },
		})

		await vi.waitFor(() => expect(store.slides[1]?.content).toContain("page-2-file"))
		await vi.waitFor(() => expect(generateScreenshot).toHaveBeenCalled())
		expect(generateScreenshot.mock.calls[0]?.[1]).toContain("page-2-file")
		expect(store.slides[1]?.thumbnailUrl).toBe("blob:regenerated")
	})

	it("waits for slide writes to settle before reloading project HTML", async () => {
		store.dispose()
		store = new PPTStore({
			attachments: [],
			attachmentList: createProjectAttachments({ page2: {} }),
			mainFileId: "magic-project",
			mainFileName: "magic.project.js",
			autoLoadAndGenerate: false,
			displayConfig: { slides: ["cover.html"] },
			logger: { enabled: false },
		})
		store.pathMappingService.setPathFileIdMapping("cover.html", "cover-file")
		store.pathMappingService.setPathUrlMapping(
			"cover.html",
			"https://example.com/cover-file.html",
		)
		store.setSlides(
			[
				{
					id: "slide-cover",
					path: "cover.html",
					url: "https://example.com/cover-file.html",
					index: 0,
					loadingState: "loaded",
					content: "<div>cover</div>",
					thumbnailUrl: "blob:cover",
				},
			],
			true,
		)

		vi.spyOn(
			(store as unknown as { screenshotService: SlideScreenshotService }).screenshotService,
			"generateScreenshot",
		).mockResolvedValue("blob:regenerated")
		vi.useFakeTimers()
		try {
			const firstUpdate = store.updateConfig({
				attachmentList: createProjectAttachments({
					coverUpdatedAt: "2",
				}),
				displayConfig: { slides: ["cover.html"] },
			})
			await vi.advanceTimersByTimeAsync(PPT_FILE_UPDATE_DEBOUNCE_MS / 2)
			expect(mockState.downloadFileContent).not.toHaveBeenCalled()

			const secondUpdate = store.updateConfig({
				attachmentList: createProjectAttachments({
					coverUpdatedAt: "3",
				}),
				displayConfig: { slides: ["cover.html"] },
			})
			await Promise.all([firstUpdate, secondUpdate])
			await vi.advanceTimersByTimeAsync(PPT_FILE_UPDATE_DEBOUNCE_MS)
			await vi.runAllTimersAsync()
		} finally {
			vi.useRealTimers()
		}

		expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1)
	})

	it("loads a missing visible slide once its HTML file appears", async () => {
		store.dispose()
		store = new PPTStore({
			attachments: [],
			attachmentList: createProjectAttachments(),
			mainFileId: "magic-project",
			mainFileName: "magic.project.js",
			autoLoadAndGenerate: false,
			displayConfig: { slides: ["cover.html", "page-2.html"] },
			logger: { enabled: false },
			fileUpdateDebounceMs: 0,
		})
		store.pathMappingService.setPathFileIdMapping("cover.html", "cover-file")
		store.pathMappingService.setPathUrlMapping(
			"cover.html",
			"https://example.com/cover-file.html",
		)
		store.setSlides(
			[
				{
					id: "slide-cover",
					path: "cover.html",
					url: "https://example.com/cover-file.html",
					index: 0,
					loadingState: "loaded",
					content: "<div>cover</div>",
					thumbnailUrl: "blob:cover",
				},
				{
					id: "slide-page-2",
					path: "page-2.html",
					url: "",
					index: 1,
					loadingState: "idle",
				},
			],
			true,
		)
		store.updateVisibleSlidePreviews([0, 1])
		mockState.downloadFileContent.mockClear()

		await store.updateConfig({
			attachmentList: createProjectAttachments({ page2: { updatedAt: "1" } }),
			displayConfig: { slides: ["cover.html", "page-2.html"] },
		})

		await vi.waitFor(() =>
			expect(store.slides[1]?.url).toBe("https://example.com/page-2-file.html"),
		)
		await vi.waitFor(() => expect(store.slides[1]?.content).toContain("page-2-file"))
		expect(store.slides[0]?.content).toBe("<div>cover</div>")
	})

	it("does not download a missing off-screen slide until sidebar demand arrives", async () => {
		store.dispose()
		store = new PPTStore({
			attachments: [],
			attachmentList: createProjectAttachments(),
			mainFileId: "magic-project",
			mainFileName: "magic.project.js",
			autoLoadAndGenerate: false,
			displayConfig: { slides: ["cover.html", "page-2.html"] },
			logger: { enabled: false },
			fileUpdateDebounceMs: 0,
		})
		store.pathMappingService.setPathFileIdMapping("cover.html", "cover-file")
		store.pathMappingService.setPathUrlMapping(
			"cover.html",
			"https://example.com/cover-file.html",
		)
		store.setSlides(
			[
				{
					id: "slide-cover",
					path: "cover.html",
					url: "https://example.com/cover-file.html",
					index: 0,
					loadingState: "loaded",
					content: "<div>cover</div>",
					thumbnailUrl: "blob:cover",
				},
				{
					id: "slide-page-2",
					path: "page-2.html",
					url: "",
					index: 1,
					loadingState: "idle",
				},
			],
			true,
		)
		mockState.downloadFileContent.mockClear()

		await store.updateConfig({
			attachmentList: createProjectAttachments({ page2: { updatedAt: "1" } }),
			displayConfig: { slides: ["cover.html", "page-2.html"] },
		})

		await vi.waitFor(() =>
			expect(store.slides[1]?.url).toBe("https://example.com/page-2-file.html"),
		)
		expect(store.slides[1]?.content).toBeUndefined()
		expect(mockState.downloadFileContent).not.toHaveBeenCalled()

		store.updateVisibleSlidePreviews([1])
		await vi.waitFor(() => expect(store.slides[1]?.content).toContain("page-2-file"))
	})
})
