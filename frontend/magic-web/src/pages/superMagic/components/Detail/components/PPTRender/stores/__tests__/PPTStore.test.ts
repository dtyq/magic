import { reaction, isObservable, isObservableProp } from "mobx"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PPTStore } from "../PPTStore"
import type { SlideItem } from "../../PPTSidebar/types"

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

vi.mock("../../services/SlideScreenshotService", () => ({
	createScreenshotService: () => ({
		generateScreenshot: vi.fn(async () => "blob:mock-thumbnail"),
		cancelPreviewGenerations: vi.fn(),
		releaseScreenshot: vi.fn(),
		clearCache: vi.fn(),
		getCacheStats: vi.fn(() => ({ size: 0, urls: [] })),
		reset: vi.fn(),
		dispose: vi.fn(),
	}),
	getScreenshotService: () => ({
		generateScreenshot: vi.fn(),
		cancelPreviewGenerations: vi.fn(),
		releaseScreenshot: vi.fn(),
		clearCache: vi.fn(),
		getCacheStats: vi.fn(() => ({ size: 0, urls: [] })),
		reset: vi.fn(),
		dispose: vi.fn(),
	}),
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

function createSlide(index: number, extras: Partial<SlideItem> = {}): SlideItem {
	return {
		id: `slide-${index}`,
		path: `slide-${index}.html`,
		url: `https://example.com/slide-${index}.html`,
		index,
		loadingState: "idle",
		...extras,
	}
}

function createStore() {
	return new PPTStore({
		attachments: [],
		attachmentList: [
			{
				file_id: "main-id",
				file_name: "index.html",
				relative_file_path: "deck/index.html",
			},
			{
				file_id: "file1",
				file_name: "slide-0.html",
				relative_file_path: "deck/slide-0.html",
			},
			{
				file_id: "file2",
				file_name: "slide-1.html",
				relative_file_path: "deck/slide-1.html",
			},
		],
		mainFileId: "main-id",
		mainFileName: "index.html",
		displayConfig: {},
		autoLoadAndGenerate: false,
		enableCache: false,
		logger: { enabled: false },
		fileUpdateDebounceMs: 0,
	})
}

describe("PPTStore", () => {
	let store: PPTStore

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
		store = createStore()
	})

	afterEach(() => {
		store?.dispose()
	})

	describe("speaker notes save completion", () => {
		it.each(["reorder", "delete", "replace"])(
			"uses file identity after slides %s while saving",
			async (change) => {
				store.setSlides(
					[
						createSlide(0, { rawContent: "First" }),
						createSlide(1, { rawContent: "Second" }),
					],
					true,
				)
				let finishSave!: () => void
				const save = new Promise<void>((resolve) => {
					finishSave = resolve
				})
				const completion = save.then(() => store.updateSlideNotes("file1", "Saved notes"))
				if (change === "reorder") {
					store.setSlides([store.slides[1], store.slides[0]], true)
				} else if (change === "delete") {
					store.setSlides([store.slides[1]], true)
				} else {
					store.setSlides([createSlide(2, { rawContent: "Other deck" })], true)
				}
				finishSave()
				await completion
				expect(store.slides[0].rawContent).toBe(
					change === "replace" ? "Other deck" : "Second",
				)
				if (change === "reorder") {
					expect(store.slides[1].rawContent).toBe("Saved notes")
					expect(store.slides[1].rawRevision).toBe(1)
				}
			},
		)

		it("keeps visual load state when only notes change", () => {
			store.setSlides(
				[
					createSlide(0, {
						rawContent: "<main>Slide</main>",
						content: "<main>Processed</main>",
						lastLoadedAt: 100,
						resourceVersionSignature: "sig-1",
						thumbnailUrl: "blob:thumb",
					}),
				],
				true,
			)
			store.updateSlideNotes(
				"file1",
				"<main>Slide</main><template data-magic-slide-notes>Talk</template>",
			)
			expect(store.slides[0].lastLoadedAt).toBe(100)
			expect(store.slides[0].content).toBe("<main>Processed</main>")
			expect(store.slides[0].resourceVersionSignature).toBe("sig-1")
			expect(store.slides[0].thumbnailUrl).toBe("blob:thumb")
			expect(store.isSlideManuallySaved("file1")).toBe(true)
		})
	})

	describe("initialization", () => {
		it("should initialize with default values", () => {
			expect(store.slideUrls).toEqual([])
			expect(store.slides).toEqual([])
			expect(store.activeIndex).toBe(0)
			expect(store.isInitializing).toBe(false)
			expect(store.isTransitioning).toBe(false)
			expect(store.scaleRatio).toBe(1)
			expect(store.verticalOffset).toBe(0)
			expect(store.horizontalOffset).toBe(0)
		})
	})

	describe("initializeSlides", () => {
		it("should keep every provided slide path", async () => {
			await store.initializeSlides(["slide-0.html", "slide-1.html"])

			expect(store.slidePaths).toEqual(["slide-0.html", "slide-1.html"])
			expect(store.activeIndex).toBe(0)
			expect(store.isInitializing).toBe(false)
		})

		it("should replace previous slide content on re-init", async () => {
			store.setSlides(
				[
					createSlide(0, {
						content: "old content",
						loadingState: "loaded",
					}),
				],
				true,
			)

			await store.initializeSlides(["slide-0.html"])

			expect(store.slides).toHaveLength(1)
			expect(store.slides[0]?.content).toBeUndefined()
		})

		it("should handle empty slides array", async () => {
			await store.initializeSlides([])

			expect(store.slideUrls).toEqual([])
			expect(store.slides).toEqual([])
		})
	})

	describe("computed values", () => {
		beforeEach(() => {
			store.setSlides(
				[
					createSlide(0, { content: "content 1", loadingState: "loaded" }),
					createSlide(1, { content: "content 2", loadingState: "loaded" }),
				],
				true,
			)
			store.pathMappingService.setPathFileIdMapping("slide-0.html", "file1")
			store.pathMappingService.setPathFileIdMapping("slide-1.html", "file2")
		})

		it("should compute currentSlideUrl", () => {
			expect(store.currentSlideUrl).toBe("https://example.com/slide-0.html")

			store.setActiveIndex(1)
			expect(store.currentSlideUrl).toBe("https://example.com/slide-1.html")
		})

		it("should compute currentSlideContent", () => {
			expect(store.currentSlideContent).toBe("content 1")

			store.setActiveIndex(1)
			expect(store.currentSlideContent).toBe("content 2")
		})

		it("should compute currentFileId", () => {
			expect(store.currentFileId).toBe("file1")

			store.setActiveIndex(1)
			expect(store.currentFileId).toBe("file2")
		})

		it("should compute canGoPrev", () => {
			store.setIsTransitioning(false)

			expect(store.canGoPrev).toBe(false)

			store.setActiveIndex(1)
			expect(store.canGoPrev).toBe(true)
		})

		it("should compute canGoNext", () => {
			store.setIsTransitioning(false)

			expect(store.canGoNext).toBe(true)

			store.setActiveIndex(1)
			expect(store.canGoNext).toBe(false)
		})

		it("should compute loadingPercentage", () => {
			expect(store.loadingPercentage).toBe(100)

			store.updateSlideItem(1, { loadingState: "idle", content: undefined })
			expect(store.loadingPercentage).toBe(50)
		})

		it("should compute totalSlides", () => {
			expect(store.totalSlides).toBe(2)
		})
	})

	describe("navigation", () => {
		beforeEach(() => {
			store.setSlides([createSlide(0), createSlide(1), createSlide(2)], true)
			store.setIsTransitioning(false)
		})

		it("should navigate to next slide", () => {
			store.nextSlide()
			expect(store.activeIndex).toBe(1)
		})

		it("should not navigate past last slide", () => {
			store.setActiveIndex(2)
			store.nextSlide()
			expect(store.activeIndex).toBe(2)
		})

		it("should navigate to previous slide", () => {
			store.setActiveIndex(1)
			store.prevSlide()
			expect(store.activeIndex).toBe(0)
		})

		it("should not navigate before first slide", () => {
			store.prevSlide()
			expect(store.activeIndex).toBe(0)
		})

		it("should go to first slide", () => {
			store.setActiveIndex(2)
			store.goToFirstSlide()
			expect(store.activeIndex).toBe(0)
		})

		it("should not navigate when transitioning", () => {
			store.setIsTransitioning(true)

			store.nextSlide()
			expect(store.activeIndex).toBe(0)

			store.prevSlide()
			expect(store.activeIndex).toBe(0)
		})

		it("should set active index directly", () => {
			store.setActiveIndex(1)
			expect(store.activeIndex).toBe(1)
		})

		it("should not set invalid index", () => {
			store.setActiveIndex(-1)
			expect(store.activeIndex).toBe(0)

			store.setActiveIndex(10)
			expect(store.activeIndex).toBe(0)
		})
	})

	describe("view state", () => {
		it("should set scale ratio", () => {
			store.setScaleRatio(1.5)
			expect(store.scaleRatio).toBe(1.5)
		})

		it("should set vertical offset", () => {
			store.setVerticalOffset(100)
			expect(store.verticalOffset).toBe(100)
		})

		it("should set horizontal offset", () => {
			store.setHorizontalOffset(50)
			expect(store.horizontalOffset).toBe(50)
		})

		it("should set fullscreen state", () => {
			store.setFullscreen(true)
			expect(store.isFullscreen).toBe(true)
		})

		it("should set transition state", () => {
			store.setIsTransitioning(true)
			expect(store.isTransitioning).toBe(true)
		})
	})

	describe("slide content management", () => {
		beforeEach(() => {
			store.setSlides([createSlide(0), createSlide(1), createSlide(2)], true)
		})

		it("should update single slide content", async () => {
			store.pathMappingService.setPathFileIdMapping("slide-0.html", "file1")

			await store.updateSlideContent(0, "new content")

			expect(mockState.processHtmlContent).toHaveBeenCalledWith(
				expect.objectContaining({ html_relative_path: "deck/" }),
			)
			expect(store.slides[0]?.content).toBe("new content")
			expect(store.slides[0]?.loadingState).toBe("loaded")
		})

		it("should update multiple slide contents", () => {
			store.updateSlideContents(
				new Map([
					[0, "content 0"],
					[1, "content 1"],
					[2, "content 2"],
				]),
			)

			expect(store.slides[0]?.content).toBe("content 0")
			expect(store.slides[1]?.content).toBe("content 1")
			expect(store.slides[2]?.content).toBe("content 2")
		})

		it("should set slide URLs", () => {
			const newUrls = ["https://example.com/new1.html", "https://example.com/new2.html"]

			store.setSlideUrls(newUrls)

			expect(store.slideUrls).toEqual(newUrls)
		})
	})

	describe("loadAllSlides", () => {
		it("should load all slides successfully", async () => {
			store.setSlides([createSlide(0), createSlide(1)], true)

			await store.loadAllSlides()

			await vi.waitFor(() => {
				expect(store.slides[0]?.loadingState).toBe("loaded")
				expect(store.slides[1]?.loadingState).toBe("loaded")
			})
			expect(store.loadingPercentage).toBe(100)
		})

		it("should finish initialization even when a slide fails to load", async () => {
			mockState.downloadFileContent.mockRejectedValue(new Error("Load failed"))
			store.setSlides([createSlide(0)], true)

			await store.loadAllSlides()

			expect(store.isInitializing).toBe(false)
			expect(store.slides[0]?.loadingState).toBe("error")
		})
	})

	describe("updateConfig", () => {
		it("notifies render consumers for hidden-only updates without observing attachment data", async () => {
			const onHiddenChange = vi.fn()
			const dispose = reaction(
				() => store.getConfigForExport().displayConfig?.hidden_slides,
				onHiddenChange,
			)
			const attachments = [{ file_id: "unrelated", children: [{ file_id: "nested" }] }]
			const hidden = ["slide-0.html"]
			await store.updateConfig({ displayConfig: { hidden_slides: hidden }, attachments })
			expect(onHiddenChange).toHaveBeenCalledTimes(1)
			expect(store.getConfigForExport().displayConfig.hidden_slides).toEqual(hidden)
			expect(isObservableProp(store, "config")).toBe(false)
			expect(isObservable(store.getConfigForExport().attachments)).toBe(false)
			await store.updateConfig({ displayConfig: {} })
			expect(onHiddenChange).toHaveBeenCalledTimes(2)
			expect(store.getConfigForExport().displayConfig.hidden_slides).toBeUndefined()
			dispose()
		})

		it("should update store configuration", () => {
			store.updateConfig({
				attachmentList: [
					{
						file_id: "new-file",
						file_name: "new.html",
						relative_file_path: "deck/new.html",
					},
				],
			})

			expect(store).toBeDefined()
		})

		it("does not abort in-flight init when fileApi identity is unchanged", async () => {
			let resolveUrls: (value: Array<{ file_id: string; url: string }>) => void = () =>
				undefined
			mockState.getTemporaryDownloadUrl.mockImplementation(
				() =>
					new Promise<Array<{ file_id: string; url: string }>>((resolve) => {
						resolveUrls = resolve
					}),
			)
			const fileApi = {
				identityKey: "none",
				getTemporaryDownloadUrl: mockState.getTemporaryDownloadUrl,
				getFileContentById: vi.fn(),
				getFileContentsByIds: vi.fn(),
				requestSharedMediaUrls: vi.fn(),
			}

			const init = store.updateConfig({
				displayConfig: { type: "slide", slides: ["slide-0.html"] },
				attachmentList: [
					{
						file_id: "main-id",
						file_name: "index.html",
						relative_file_path: "deck/index.html",
						is_directory: false,
					},
					{
						file_id: "file1",
						file_name: "slide-0.html",
						relative_file_path: "deck/slide-0.html",
					},
				],
				mainFileId: "main-id",
				mainFileName: "index.html",
				fileApi: fileApi as never,
			})
			await vi.waitFor(() =>
				expect(mockState.getTemporaryDownloadUrl).toHaveBeenCalledTimes(1),
			)

			await store.updateConfig({ fileApi: fileApi as never })
			resolveUrls([{ file_id: "file1", url: "https://example.com/file1.html" }])
			await init

			expect(store.slides).toHaveLength(1)
			expect(store.slides[0]?.url).toBe("https://example.com/file1.html")
			expect(store.isReady).toBe(true)
		})
	})

	describe("reset", () => {
		it("should reset store to initial state", () => {
			store.setSlides([createSlide(0, { content: "content", loadingState: "loaded" })], true)
			store.setActiveIndex(0)
			store.setScaleRatio(2)
			store.setVerticalOffset(100)
			store.setHorizontalOffset(50)

			store.reset()

			expect(store.slideUrls).toEqual([])
			expect(store.slides).toEqual([])
			expect(store.activeIndex).toBe(0)
			expect(store.isInitializing).toBe(false)
			expect(store.scaleRatio).toBe(1)
			expect(store.verticalOffset).toBe(0)
			expect(store.horizontalOffset).toBe(0)
		})
	})
})
