import { beforeEach, describe, expect, it, vi } from "vitest"
import { PPTStore } from "../PPTStore"

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

vi.mock("@/utils/log", () => ({
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

describe("PPTStore identity-based slide loading", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockState.processHtmlContent.mockImplementation(async ({ content }) => ({
			processedContent: content,
		}))
	})

	it("writes async loaded content back to the same file after an insertion shifts indices", async () => {
		let resolveOldSlide: (content: string) => void = () => undefined
		mockState.downloadFileContent.mockImplementation((url: string) => {
			if (url === "https://example.com/old-slide") {
				return new Promise<string>((resolve) => {
					resolveOldSlide = resolve
				})
			}
			return Promise.resolve(`<div>${url}</div>`)
		})

		const store = new PPTStore({
			attachments: [],
			attachmentList: [
				{
					file_id: "main-file",
					file_name: "index.html",
					relative_file_path: "deck/index.html",
				},
				{
					file_id: "before-file",
					file_name: "08.html",
					relative_file_path: "deck/08.html",
				},
				{
					file_id: "old-file",
					file_name: "09.html",
					relative_file_path: "deck/09.html",
				},
				{
					file_id: "new-file",
					file_name: "new.html",
					relative_file_path: "deck/new.html",
				},
			],
			mainFileId: "main-file",
			mainFileName: "index.html",
			autoLoadAndGenerate: false,
			logger: { enabled: false },
		})

		store.pathMappingService.setPathFileIdMapping("08.html", "before-file")
		store.pathMappingService.setPathFileIdMapping("09.html", "old-file")
		store.pathMappingService.setPathFileIdMapping("new.html", "new-file")

		store.setSlides(
			[
				{
					id: "slide-before",
					path: "08.html",
					url: "https://example.com/before-slide",
					index: 0,
					loadingState: "loaded",
				},
				{
					id: "slide-old",
					path: "09.html",
					url: "https://example.com/old-slide",
					index: 1,
					loadingState: "idle",
				},
			],
			true,
		)

		const loadPromise = store.loadSlideContent("https://example.com/old-slide", 1)

		store.setSlides(
			[
				store.slides[0],
				{
					id: "slide-new",
					path: "new.html",
					url: "https://example.com/new-slide",
					index: 1,
					loadingState: "idle",
				},
				{ ...store.slides[1], index: 2 },
			],
			true,
		)

		resolveOldSlide("<div>old-slide-content</div>")
		await loadPromise

		expect(store.slides[1]?.path).toBe("new.html")
		expect(store.slides[1]?.content).toBeUndefined()
		expect(store.slides[2]?.path).toBe("09.html")
		expect(store.slides[2]?.content).toBe("<div>old-slide-content</div>")
	})

	it("does not reload an optimistically inserted slide when its file appears in attachmentList", async () => {
		const initialAttachmentList = [
			{
				file_id: "main-file",
				file_name: "index.html",
				relative_file_path: "deck/index.html",
			},
			{
				file_id: "old-file",
				file_name: "09.html",
				relative_file_path: "deck/09.html",
			},
		]
		const nextAttachmentList = [
			...initialAttachmentList,
			{
				file_id: "new-file",
				file_name: "new.html",
				relative_file_path: "deck/new.html",
			},
		]

		const store = new PPTStore({
			attachments: [],
			attachmentList: initialAttachmentList,
			mainFileId: "main-file",
			mainFileName: "index.html",
			autoLoadAndGenerate: false,
			displayConfig: {
				slides: ["09.html"],
			},
			logger: { enabled: false },
		})

		store.pathMappingService.setPathFileIdMapping("09.html", "old-file")
		store.pathMappingService.setPathFileIdMapping("new.html", "new-file")
		store.pathMappingService.setPathUrlMapping("new.html", "https://example.com/new-slide")
		store.setSlides(
			[
				{
					id: "slide-old",
					path: "09.html",
					url: "https://example.com/old-slide",
					index: 0,
					loadingState: "loaded",
					content: "<div>old</div>",
				},
				{
					id: "slide-new",
					path: "new.html",
					url: "https://example.com/new-slide",
					index: 1,
					loadingState: "loaded",
					content: "<div>new</div>",
				},
			],
			true,
		)

		mockState.downloadFileContent.mockClear()

		await store.updateConfig({
			attachmentList: nextAttachmentList,
			displayConfig: {
				slides: ["09.html", "new.html"],
			},
		})

		expect(mockState.downloadFileContent).not.toHaveBeenCalled()
		expect(store.slides[1]?.content).toBe("<div>new</div>")
	})

	it("keeps loadAllSlides writes anchored after an insertion shifts indices", async () => {
		let resolveOldSlide: (content: string) => void = () => undefined
		mockState.downloadFileContent.mockImplementation((url: string) => {
			if (url === "https://example.com/old-slide") {
				return new Promise<string>((resolve) => {
					resolveOldSlide = resolve
				})
			}
			return Promise.resolve(`<div>${url}</div>`)
		})

		const store = new PPTStore({
			attachments: [],
			attachmentList: [
				{
					file_id: "main-file",
					file_name: "index.html",
					relative_file_path: "deck/index.html",
				},
				{
					file_id: "before-file",
					file_name: "08.html",
					relative_file_path: "deck/08.html",
				},
				{
					file_id: "old-file",
					file_name: "09.html",
					relative_file_path: "deck/09.html",
				},
				{
					file_id: "new-file",
					file_name: "new.html",
					relative_file_path: "deck/new.html",
				},
			],
			mainFileId: "main-file",
			mainFileName: "index.html",
			autoLoadAndGenerate: false,
			logger: { enabled: false },
		})

		store.pathMappingService.setPathFileIdMapping("08.html", "before-file")
		store.pathMappingService.setPathFileIdMapping("09.html", "old-file")
		store.pathMappingService.setPathFileIdMapping("new.html", "new-file")

		store.setSlides(
			[
				{
					id: "slide-before",
					path: "08.html",
					url: "https://example.com/before-slide",
					index: 0,
					loadingState: "idle",
				},
				{
					id: "slide-old",
					path: "09.html",
					url: "https://example.com/old-slide",
					index: 1,
					loadingState: "idle",
				},
			],
			true,
		)

		const loadPromise = store.loadAllSlides()

		store.setSlides(
			[
				store.slides[0],
				{
					id: "slide-new",
					path: "new.html",
					url: "https://example.com/new-slide",
					index: 1,
					loadingState: "idle",
				},
				{ ...store.slides[1], index: 2 },
			],
			true,
		)

		resolveOldSlide("<div>old-slide-content</div>")
		await loadPromise
		await Promise.resolve()
		await Promise.resolve()

		expect(store.slides[1]?.path).toBe("new.html")
		expect(store.slides[1]?.content).toBeUndefined()
		expect(store.slides[2]?.path).toBe("09.html")
		expect(store.slides[2]?.content).toBe("<div>old-slide-content</div>")
	})

	it("keeps refreshSlideByFileId URL and content writes anchored after indices shift", async () => {
		let resolveUrlFetch: (value: Array<{ file_id: string; url: string }>) => void = () =>
			undefined
		mockState.getTemporaryDownloadUrl.mockImplementation(
			() =>
				new Promise<Array<{ file_id: string; url: string }>>((resolve) => {
					resolveUrlFetch = resolve
				}),
		)
		mockState.downloadFileContent.mockResolvedValue("<div>refreshed-old</div>")

		const store = new PPTStore({
			attachments: [],
			attachmentList: [
				{
					file_id: "main-file",
					file_name: "index.html",
					relative_file_path: "deck/index.html",
				},
				{
					file_id: "before-file",
					file_name: "08.html",
					relative_file_path: "deck/08.html",
				},
				{
					file_id: "old-file",
					file_name: "09.html",
					relative_file_path: "deck/09.html",
				},
				{
					file_id: "new-file",
					file_name: "new.html",
					relative_file_path: "deck/new.html",
				},
			],
			mainFileId: "main-file",
			mainFileName: "index.html",
			autoLoadAndGenerate: false,
			logger: { enabled: false },
		})

		store.pathMappingService.setPathFileIdMapping("08.html", "before-file")
		store.pathMappingService.setPathFileIdMapping("09.html", "old-file")
		store.pathMappingService.setPathFileIdMapping("new.html", "new-file")
		store.setSlides(
			[
				{
					id: "slide-before",
					path: "08.html",
					url: "https://example.com/before-slide",
					index: 0,
					loadingState: "loaded",
					content: "<div>before</div>",
				},
				{
					id: "slide-old",
					path: "09.html",
					url: "https://example.com/old-slide",
					index: 1,
					loadingState: "loaded",
					content: "<div>old</div>",
				},
			],
			true,
		)

		const refreshPromise = store.refreshSlideByFileId("old-file")

		store.setSlides(
			[
				store.slides[0],
				{
					id: "slide-new",
					path: "new.html",
					url: "https://example.com/new-slide",
					index: 1,
					loadingState: "loaded",
					content: "<div>new</div>",
				},
				{ ...store.slides[1], index: 2 },
			],
			true,
		)

		resolveUrlFetch([{ file_id: "old-file", url: "https://example.com/refreshed-old" }])
		await refreshPromise

		expect(store.slides[1]?.path).toBe("new.html")
		expect(store.slides[1]?.url).toBe("https://example.com/new-slide")
		expect(store.slides[1]?.content).toBe("<div>new</div>")
		expect(store.slides[2]?.path).toBe("09.html")
		expect(store.slides[2]?.url).toBe("https://example.com/refreshed-old")
		expect(store.slides[2]?.content).toBe("<div>refreshed-old</div>")
	})
})
