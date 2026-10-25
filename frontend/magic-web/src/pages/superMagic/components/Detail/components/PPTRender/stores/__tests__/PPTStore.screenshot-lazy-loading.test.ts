import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runInAction } from "mobx"
import { createPPTStore } from "../PPTStore"
import type { PPTStore } from "../PPTStore"
import type { SlideItem } from "../../PPTSidebar/types"

const mockState = vi.hoisted(() => ({
	downloadFileContent: vi.fn(),
	getTemporaryDownloadUrl: vi.fn(),
	processHtmlContent: vi.fn(),
	screenshotService: {
		generateScreenshot: vi.fn(async (key: string) => `blob:${key}`),
		cancelPreviewGenerations: vi.fn(),
		releaseScreenshot: vi.fn(),
		clearCache: vi.fn(),
		getCacheStats: vi.fn(() => ({ size: 0, urls: [] })),
		reset: vi.fn(),
		dispose: vi.fn(),
	},
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

vi.mock("../../services/SlideScreenshotService", () => ({
	createScreenshotService: () => mockState.screenshotService,
	getScreenshotService: () => mockState.screenshotService,
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

function createDeck(count: number) {
	const paths = Array.from({ length: count }, (_, index) => `slide-${index}.html`)
	const attachmentList = [
		{
			file_id: "main-file",
			file_name: "index.html",
			relative_file_path: "deck/index.html",
		},
		...paths.map((path, index) => ({
			file_id: `file-${index}`,
			file_name: path,
			relative_file_path: `deck/${path}`,
		})),
	]
	return { paths, attachmentList }
}

function createStore(count: number, config: { autoLoadAndGenerate?: boolean } = {}) {
	const deck = createDeck(count)
	const store = createPPTStore({
		attachments: [],
		attachmentList: deck.attachmentList,
		mainFileId: "main-file",
		mainFileName: "index.html",
		logger: { enabled: false },
		enableCache: false,
		fileUpdateDebounceMs: 0,
		...config,
	})
	return { store, ...deck }
}

function setIdleSlides(store: PPTStore, count: number): SlideItem[] {
	const slides = Array.from({ length: count }, (_, index) => {
		const path = `slide-${index}.html`
		store.pathMappingService.setPathFileIdMapping(path, `file-${index}`)
		return {
			id: `slide-${index}`,
			path,
			url: `https://example.com/file-${index}.html`,
			index,
			loadingState: "idle" as const,
		}
	})
	store.setSlides(slides, true)
	return slides
}

describe("PPTStore screenshot demand", () => {
	const stores: PPTStore[] = []

	beforeEach(() => {
		vi.clearAllMocks()
		mockState.getTemporaryDownloadUrl.mockImplementation(async ({ file_ids }) =>
			file_ids.map((fileId: string) => ({
				file_id: fileId,
				url: `https://example.com/${fileId}.html`,
			})),
		)
		mockState.downloadFileContent.mockImplementation(
			async (url: string) => `<main>${url}</main>`,
		)
		mockState.processHtmlContent.mockImplementation(async ({ content }) => ({
			processedContent: content,
		}))
	})

	afterEach(() => {
		stores.splice(0).forEach((store) => store.dispose())
	})

	describe("autoLoadAndGenerate", () => {
		it("enables automatic preview by default", () => {
			const { store } = createStore(1)
			stores.push(store)
			expect(store.isAutomaticLoadingEnabled).toBe(true)
		})

		it("disables automatic preview when autoLoadAndGenerate is false", () => {
			const { store } = createStore(1, { autoLoadAndGenerate: false })
			stores.push(store)
			expect(store.isAutomaticLoadingEnabled).toBe(false)
		})
	})

	describe("initialize does not generate every thumbnail", () => {
		it("only screenshots the active slide on init", async () => {
			const { store, paths } = createStore(3)
			stores.push(store)

			await store.initializeSlides(paths)

			expect(mockState.screenshotService.generateScreenshot).toHaveBeenCalledTimes(1)
			expect(store.slides[0]?.thumbnailUrl).toBeDefined()
			expect(store.slides[1]?.thumbnailUrl).toBeUndefined()
			expect(store.slides[2]?.thumbnailUrl).toBeUndefined()
		})

		it("does not screenshot on init when automatic loading is disabled", async () => {
			const { store, paths } = createStore(3, { autoLoadAndGenerate: false })
			stores.push(store)

			await store.initializeSlides(paths)

			expect(mockState.screenshotService.generateScreenshot).not.toHaveBeenCalled()
			expect(store.slides.every((slide) => !slide.thumbnailUrl)).toBe(true)
		})
	})

	describe("on-demand screenshot generation", () => {
		it("generates a screenshot for a loaded slide", async () => {
			const { store } = createStore(3, { autoLoadAndGenerate: false })
			stores.push(store)
			setIdleSlides(store, 3)

			runInAction(() => {
				if (store.slides[0]) {
					store.slides[0].content = "<div>Test content</div>"
					store.slides[0].loadingState = "loaded"
				}
			})

			await store.generateSlideScreenshot(0)

			expect(mockState.screenshotService.generateScreenshot).toHaveBeenCalledTimes(1)
			expect(store.slides[0]?.thumbnailUrl).toBe("blob:https://example.com/file-0.html")
			expect(store.slides[0]?.thumbnailLoading).toBe(false)
		})

		it("generates only the requested slide screenshot", async () => {
			const { store } = createStore(3, { autoLoadAndGenerate: false })
			stores.push(store)
			setIdleSlides(store, 3)

			runInAction(() => {
				store.slides.forEach((slide, index) => {
					slide.content = `<div>Slide ${index + 1}</div>`
					slide.loadingState = "loaded"
				})
			})

			await store.generateSlideScreenshot(1)

			expect(mockState.screenshotService.generateScreenshot).toHaveBeenCalledTimes(1)
			expect(store.slides[0]?.thumbnailUrl).toBeUndefined()
			expect(store.slides[1]?.thumbnailUrl).toBe("blob:https://example.com/file-1.html")
			expect(store.slides[2]?.thumbnailUrl).toBeUndefined()
		})

		it("screenshots only the visible sidebar range", async () => {
			const { store } = createStore(5, { autoLoadAndGenerate: false })
			stores.push(store)
			setIdleSlides(store, 5)

			store.updateVisibleSlidePreviews([1, 2])

			await vi.waitFor(() => {
				expect(store.slides[1]?.thumbnailUrl).toBeDefined()
				expect(store.slides[2]?.thumbnailUrl).toBeDefined()
			})
			expect(store.slides[0]?.thumbnailUrl).toBeUndefined()
			expect(store.slides[3]?.thumbnailUrl).toBeUndefined()
			expect(store.slides[4]?.thumbnailUrl).toBeUndefined()
		})
	})

	describe("new slide insertion", () => {
		it("does not screenshot a newly inserted idle slide", async () => {
			const { store } = createStore(2, { autoLoadAndGenerate: false })
			stores.push(store)
			setIdleSlides(store, 2)

			await store.insertSlide(0, "after", {
				path: "slide-2.html",
				url: "https://example.com/file-2.html",
				fileId: "file-2",
			})

			expect(mockState.screenshotService.generateScreenshot).not.toHaveBeenCalled()
			expect(store.slides).toHaveLength(3)
			expect(store.slides[1]?.thumbnailUrl).toBeUndefined()
		})

		it("does not generate all thumbnails after inserting a slide", async () => {
			const { store } = createStore(2)
			stores.push(store)
			setIdleSlides(store, 2)

			await store.insertSlide(0, "after", {
				path: "slide-2.html",
				url: "https://example.com/file-2.html",
				fileId: "file-2",
			})

			expect(store.slides).toHaveLength(3)
			expect(store.slides[1]?.thumbnailUrl).toBeUndefined()
			expect(store.slides[2]?.thumbnailUrl).toBeUndefined()
		})
	})
})
