import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PPTStore } from "../PPTStore"
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

function createStore(
	count: number,
	config: {
		contentLoadConcurrency?: number
		fullscreenContentPreloadRadius?: number
		initialActiveIndex?: number
		autoLoadAndGenerate?: boolean
	} = {},
) {
	const deck = createDeck(count)
	const store = new PPTStore({
		attachments: [],
		attachmentList: deck.attachmentList,
		mainFileId: "main-file",
		mainFileName: "index.html",
		logger: { enabled: false },
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

function getDownloadedSlideIndices(): number[] {
	return mockState.downloadFileContent.mock.calls
		.map(([url]) => /file-(\d+)\.html/.exec(String(url))?.[1])
		.filter((index): index is string => index !== undefined)
		.map(Number)
}

describe("PPTStore content lazy loading", () => {
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

	it("opens a 200-page deck without downloading every slide HTML file", async () => {
		const { store, paths } = createStore(200)
		stores.push(store)

		await store.initializeSlides(paths)

		expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1)
		expect(store.slides[0]?.loadingState).toBe("loaded")
		expect(store.slides[1]?.loadingState).toBe("idle")
		expect(store.slides[199]?.loadingState).toBe("idle")
		expect(store.isInitializing).toBe(false)
		expect(store.loadingProgress).toBe(100)
	})

	it("loads only the active page until the sidebar reports its virtual window", async () => {
		const { store } = createStore(5)
		stores.push(store)
		setIdleSlides(store, 5)

		store.setActiveIndex(2)

		await vi.waitFor(() => expect(store.slides[2]?.loadingState).toBe("loaded"))
		expect(mockState.downloadFileContent.mock.calls.map(([url]) => url)).toEqual([
			"https://example.com/file-2.html",
		])
		expect(store.slides[1]?.loadingState).toBe("idle")
		expect(store.slides[3]?.loadingState).toBe("idle")
	})

	it("preloads only fullscreen HTML while keeping the iframe render window bounded", async () => {
		const { store } = createStore(30, { fullscreenContentPreloadRadius: 4 })
		stores.push(store)
		setIdleSlides(store, 30)

		store.setActiveIndex(15)
		await vi.waitFor(() => expect(store.slides[15]?.thumbnailUrl).toBeDefined())
		mockState.downloadFileContent.mockClear()
		mockState.screenshotService.generateScreenshot.mockClear()

		store.setFullscreen(true)

		await vi.waitFor(() =>
			expect(
				Array.from({ length: 9 }, (_, offset) => store.slides[11 + offset]?.loadingState),
			).toEqual(Array.from({ length: 9 }, () => "loaded")),
		)
		expect(new Set(getDownloadedSlideIndices())).toEqual(
			new Set([11, 12, 13, 14, 16, 17, 18, 19]),
		)
		expect(store.slides[10]?.loadingState).toBe("idle")
		expect(store.slides[20]?.loadingState).toBe("idle")
		expect(store.visibleSlides.map(({ index }) => index)).toEqual([13, 14, 15, 16, 17])
		expect(mockState.screenshotService.generateScreenshot).not.toHaveBeenCalled()
		expect(mockState.screenshotService.cancelPreviewGenerations).toHaveBeenCalledTimes(1)
	})

	it("slides the fullscreen HTML window by downloading only the new edge page", async () => {
		const { store } = createStore(30, { fullscreenContentPreloadRadius: 3 })
		stores.push(store)
		setIdleSlides(store, 30)

		store.setActiveIndex(10)
		await vi.waitFor(() => expect(store.slides[10]?.loadingState).toBe("loaded"))
		store.setFullscreen(true)
		await vi.waitFor(() =>
			expect(
				Array.from({ length: 7 }, (_, offset) => store.slides[7 + offset]?.loadingState),
			).toEqual(Array.from({ length: 7 }, () => "loaded")),
		)
		mockState.downloadFileContent.mockClear()

		store.nextSlide()

		await vi.waitFor(() => expect(store.slides[14]?.loadingState).toBe("loaded"))
		expect(getDownloadedSlideIndices()).toEqual([14])
		expect(store.slides[7]?.loadingState).toBe("loaded")
	})

	it("reprioritizes retained fullscreen work while the sliding window is still loading", async () => {
		const { store } = createStore(30, {
			contentLoadConcurrency: 2,
			fullscreenContentPreloadRadius: 4,
		})
		stores.push(store)
		setIdleSlides(store, 30)

		store.setActiveIndex(10)
		await vi.waitFor(() => expect(store.slides[10]?.loadingState).toBe("loaded"))

		const started: number[] = []
		const resolvers = new Map<number, (content: string) => void>()
		mockState.downloadFileContent.mockImplementation(
			(url: string, options: { signal?: AbortSignal }) => {
				const index = Number(/file-(\d+)\.html/.exec(url)?.[1])
				started.push(index)
				if (index === 12) return Promise.resolve(`<main>${url}</main>`)
				return new Promise<string>((resolve, reject) => {
					resolvers.set(index, resolve)
					options.signal?.addEventListener("abort", () => {
						reject(new DOMException("The operation was aborted", "AbortError"))
					})
				})
			},
		)

		store.setFullscreen(true)
		await vi.waitFor(() => expect(started).toEqual([11]))

		store.setActiveIndex(12)
		await vi.waitFor(() => expect(started).toEqual([11, 12]))
		resolvers.get(11)?.("<main>slide 11</main>")

		await vi.waitFor(() => expect(started.slice(0, 3)).toEqual([11, 12, 13]))
		expect(started).not.toContain(8)
		expect(started).not.toContain(9)
	})

	it("reuses overlapping sidebar work and cancels previews outside the fullscreen window", async () => {
		const { store } = createStore(9, {
			contentLoadConcurrency: 2,
			fullscreenContentPreloadRadius: 2,
		})
		stores.push(store)
		setIdleSlides(store, 9)

		store.setActiveIndex(4)
		await vi.waitFor(() => expect(store.slides[4]?.loadingState).toBe("loaded"))
		mockState.downloadFileContent.mockClear()
		let overlappingSignal: AbortSignal | undefined
		let resolveOverlapping: (content: string) => void = () => undefined
		mockState.downloadFileContent.mockImplementation(
			(url: string, options: { signal?: AbortSignal }) => {
				if (url.endsWith("file-5.html")) {
					overlappingSignal = options.signal
					return new Promise<string>((resolve, reject) => {
						resolveOverlapping = resolve
						options.signal?.addEventListener("abort", () => {
							reject(new DOMException("The operation was aborted", "AbortError"))
						})
					})
				}
				return Promise.resolve(`<main>${url}</main>`)
			},
		)

		store.updateVisibleSlidePreviews([5, 8])
		await vi.waitFor(() => expect(overlappingSignal).toBeDefined())

		store.setFullscreen(true)
		store.updateVisibleSlidePreviews([])
		expect(overlappingSignal?.aborted).toBe(false)
		expect(getDownloadedSlideIndices()).not.toContain(8)
		resolveOverlapping("<main>slide 5</main>")

		await vi.waitFor(() =>
			expect([2, 3, 4, 5, 6].map((index) => store.slides[index]?.loadingState)).toEqual(
				Array.from({ length: 5 }, () => "loaded"),
			),
		)
		expect(getDownloadedSlideIndices().sort((a, b) => a - b)).toEqual([2, 3, 5, 6])
		expect(getDownloadedSlideIndices().filter((index) => index === 5)).toHaveLength(1)
		expect(store.slides[8]?.loadingState).toBe("idle")
	})

	it("clamps the fullscreen HTML window at the beginning of the deck", async () => {
		const { store } = createStore(12, { fullscreenContentPreloadRadius: 3 })
		stores.push(store)
		setIdleSlides(store, 12)

		store.setActiveIndex(0)
		await vi.waitFor(() => expect(store.slides[0]?.loadingState).toBe("loaded"))
		mockState.downloadFileContent.mockClear()
		store.setFullscreen(true)

		await vi.waitFor(() =>
			expect([0, 1, 2, 3].map((index) => store.slides[index]?.loadingState)).toEqual(
				Array.from({ length: 4 }, () => "loaded"),
			),
		)
		expect(new Set(getDownloadedSlideIndices())).toEqual(new Set([1, 2, 3]))
		expect(store.slides[4]?.loadingState).toBe("idle")
	})

	it("warms the fullscreen HTML window when fullscreen starts before deck initialization", async () => {
		const { store, paths } = createStore(12, { fullscreenContentPreloadRadius: 2 })
		stores.push(store)

		store.setFullscreen(true)
		await store.initializeSlides(paths)

		await vi.waitFor(() =>
			expect([0, 1, 2].map((index) => store.slides[index]?.loadingState)).toEqual(
				Array.from({ length: 3 }, () => "loaded"),
			),
		)
		expect(new Set(getDownloadedSlideIndices())).toEqual(new Set([0, 1, 2]))
		expect(store.slides[3]?.loadingState).toBe("idle")
	})

	it("cancels fullscreen-only work when fullscreen exits", async () => {
		const { store } = createStore(9, {
			contentLoadConcurrency: 2,
			fullscreenContentPreloadRadius: 2,
		})
		stores.push(store)
		setIdleSlides(store, 9)
		let fullscreenSignal: AbortSignal | undefined
		mockState.downloadFileContent.mockImplementation(
			(url: string, options: { signal?: AbortSignal }) => {
				if (url.endsWith("file-5.html")) {
					fullscreenSignal = options.signal
					return new Promise<string>((_resolve, reject) => {
						options.signal?.addEventListener("abort", () => {
							reject(new DOMException("The operation was aborted", "AbortError"))
						})
					})
				}
				return Promise.resolve(`<main>${url}</main>`)
			},
		)

		store.setActiveIndex(4)
		await vi.waitFor(() => expect(store.slides[4]?.loadingState).toBe("loaded"))
		store.setFullscreen(true)
		await vi.waitFor(() => expect(fullscreenSignal).toBeDefined())

		store.setFullscreen(false)

		expect(fullscreenSignal?.aborted).toBe(true)
		await vi.waitFor(() => expect(store.slides[5]?.loadingState).toBe("idle"))
		expect(store.visibleSlides.map(({ index }) => index)).toEqual([3, 4, 5])
	})

	it("cancels obsolete fullscreen work after a far jump and starts the new active page", async () => {
		const { store } = createStore(30, {
			contentLoadConcurrency: 2,
			fullscreenContentPreloadRadius: 3,
		})
		stores.push(store)
		setIdleSlides(store, 30)
		let staleSignal: AbortSignal | undefined
		mockState.downloadFileContent.mockImplementation(
			(url: string, options: { signal?: AbortSignal }) => {
				if (url.endsWith("file-11.html")) {
					staleSignal = options.signal
					return new Promise<string>((_resolve, reject) => {
						options.signal?.addEventListener("abort", () => {
							reject(new DOMException("The operation was aborted", "AbortError"))
						})
					})
				}
				return Promise.resolve(`<main>${url}</main>`)
			},
		)

		store.setActiveIndex(10)
		await vi.waitFor(() => expect(store.slides[10]?.loadingState).toBe("loaded"))
		mockState.downloadFileContent.mockClear()
		store.setFullscreen(true)
		await vi.waitFor(() => expect(staleSignal).toBeDefined())

		store.setActiveIndex(20)

		await vi.waitFor(() => expect(store.slides[20]?.loadingState).toBe("loaded"))
		expect(staleSignal?.aborted).toBe(true)
		expect(getDownloadedSlideIndices()).not.toContain(9)
		expect(getDownloadedSlideIndices()).not.toContain(12)
	})

	it("stops automatic neighbor preloading in fullscreen when auto loading is disabled", async () => {
		const { store } = createStore(9, {
			autoLoadAndGenerate: false,
			fullscreenContentPreloadRadius: 3,
		})
		stores.push(store)
		setIdleSlides(store, 9)

		store.setActiveIndex(4)
		await vi.waitFor(() => expect(store.slides[4]?.loadingState).toBe("loaded"))
		mockState.downloadFileContent.mockClear()

		store.setFullscreen(true)
		await new Promise((resolve) => window.setTimeout(resolve, 0))

		expect(mockState.downloadFileContent).not.toHaveBeenCalled()
		expect(store.slides[3]?.loadingState).toBe("idle")
		expect(store.slides[5]?.loadingState).toBe("idle")
		expect(store.visibleSlides.map(({ index }) => index)).toEqual([2, 3, 4, 5, 6])
	})

	it("keeps direct navigation demand-driven when automatic preview generation is disabled", async () => {
		const { store } = createStore(2, { autoLoadAndGenerate: false })
		stores.push(store)
		setIdleSlides(store, 2)

		store.setActiveIndex(1)

		await vi.waitFor(() => expect(store.slides[1]?.loadingState).toBe("loaded"))
		expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1)
		expect(mockState.screenshotService.generateScreenshot).not.toHaveBeenCalled()
	})

	it("cancels stale active loads so the latest navigation starts immediately", async () => {
		const { store } = createStore(3, { contentLoadConcurrency: 1 })
		stores.push(store)
		setIdleSlides(store, 3)
		const requestSignals = new Map<string, AbortSignal | undefined>()
		mockState.downloadFileContent.mockImplementation(
			(url: string, options: { signal?: AbortSignal }) => {
				requestSignals.set(url, options.signal)
				if (url.endsWith("file-2.html")) return Promise.resolve("<main>latest</main>")
				return new Promise<string>((_resolve, reject) => {
					options.signal?.addEventListener("abort", () => {
						reject(new DOMException("The operation was aborted", "AbortError"))
					})
				})
			},
		)

		store.setActiveIndex(0)
		await vi.waitFor(() => expect(requestSignals.size).toBe(1))
		store.setActiveIndex(1)
		await vi.waitFor(() => expect(requestSignals.size).toBe(2))
		store.setActiveIndex(2)

		await vi.waitFor(() => expect(store.slides[2]?.loadingState).toBe("loaded"))
		expect(requestSignals.get("https://example.com/file-0.html")?.aborted).toBe(true)
		expect(requestSignals.get("https://example.com/file-1.html")?.aborted).toBe(true)
		expect(store.slides[0]?.loadingState).toBe("idle")
		expect(store.slides[1]?.loadingState).toBe("idle")
	})

	it("skips thumbnail generation when a running preview leaves the sidebar window", async () => {
		const { store } = createStore(2)
		stores.push(store)
		setIdleSlides(store, 2)
		let resolveFirstDownload: (content: string) => void = () => undefined
		mockState.downloadFileContent.mockImplementation((url: string) => {
			if (url.endsWith("file-0.html")) {
				return new Promise<string>((resolve) => {
					resolveFirstDownload = resolve
				})
			}
			return Promise.resolve("<main>visible</main>")
		})

		store.updateVisibleSlidePreviews([0])
		await vi.waitFor(() => expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1))
		store.updateVisibleSlidePreviews([1])
		resolveFirstDownload("<main>stale preview</main>")

		await vi.waitFor(() => expect(store.slides[1]?.thumbnailUrl).toBeDefined())
		expect(store.slides[0]?.loadingState).toBe("loaded")
		expect(store.slides[0]?.thumbnailUrl).toBeUndefined()
	})

	it("finishes initialization when a same-deck config update supersedes the active-page load", async () => {
		const { store, paths, attachmentList } = createStore(200)
		stores.push(store)
		let resolveActiveDownload: (content: string) => void = () => undefined
		mockState.downloadFileContent.mockImplementationOnce(
			() =>
				new Promise<string>((resolve) => {
					resolveActiveDownload = resolve
				}),
		)

		const initialUpdate = store.updateConfig({
			displayConfig: { slides: paths },
			attachmentList,
		})
		await vi.waitFor(() => expect(store.slides).toHaveLength(200))
		await vi.waitFor(() => expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1))

		// A refreshed config object with the same slide paths must adopt the pending initialization.
		const latestUpdate = store.updateConfig({
			displayConfig: { slides: [...paths] },
			attachmentList,
		})

		resolveActiveDownload("<main>active slide</main>")
		await Promise.all([initialUpdate, latestUpdate])

		expect(store.slides[store.activeIndex]?.loadingState).toBe("loaded")
		expect(store.isInitializing).toBe(false)
		expect(store.loadingProgress).toBe(100)
	})

	it("keeps the active-page load when a non-active attachment updates", async () => {
		const { store, paths, attachmentList } = createStore(2)
		stores.push(store)
		let resolveActiveDownload: (content: string) => void = () => undefined
		let initialSignal: AbortSignal | undefined
		mockState.downloadFileContent.mockImplementationOnce(
			(_url: string, options: { signal?: AbortSignal }) =>
				new Promise<string>((resolve, reject) => {
					initialSignal = options.signal
					resolveActiveDownload = resolve
					options.signal?.addEventListener("abort", () => {
						reject(new DOMException("The operation was aborted", "AbortError"))
					})
				}),
		)

		const initialUpdate = store.updateConfig({
			displayConfig: { slides: paths },
			attachmentList,
		})
		await vi.waitFor(() => expect(initialSignal).toBeDefined())

		const latestUpdate = store.updateConfig({
			displayConfig: { slides: [...paths] },
			attachmentList: attachmentList.map((item) =>
				item.file_id === "file-1" ? { ...item, updated_at: "2026-08-03T00:00:00Z" } : item,
			),
		})

		expect(initialSignal?.aborted).toBe(false)
		resolveActiveDownload("<main>active slide</main>")
		await Promise.all([initialUpdate, latestUpdate])

		expect(store.slides[store.activeIndex]?.loadingState).toBe("loaded")
		expect(store.isInitializing).toBe(false)
		expect(store.loadingProgress).toBe(100)
	})

	it("does not let a stale config update close a newer deck initialization", async () => {
		const { store, paths, attachmentList } = createStore(1)
		stores.push(store)
		let staleSignal: AbortSignal | undefined
		let resolveNewDeckDownload: (content: string) => void = () => undefined
		mockState.downloadFileContent
			.mockImplementationOnce(
				(_url: string, options: { signal?: AbortSignal }) =>
					new Promise<string>((_resolve, reject) => {
						staleSignal = options.signal
						options.signal?.addEventListener("abort", () => {
							reject(new DOMException("The operation was aborted", "AbortError"))
						})
					}),
			)
			.mockImplementationOnce(
				() =>
					new Promise<string>((resolve) => {
						resolveNewDeckDownload = resolve
					}),
			)

		const staleUpdate = store.updateConfig({
			displayConfig: { slides: paths },
			attachmentList,
		})
		await vi.waitFor(() => expect(staleSignal).toBeDefined())

		const latestUpdate = store.updateConfig({
			mainFileId: "new-main-file",
			mainFileName: "index.html",
			displayConfig: { slides: ["new-slide.html"] },
			attachmentList: [
				{
					file_id: "new-main-file",
					file_name: "index.html",
					relative_file_path: "new-deck/index.html",
				},
				{
					file_id: "new-slide-file",
					file_name: "new-slide.html",
					relative_file_path: "new-deck/new-slide.html",
				},
			],
		})

		await vi.waitFor(() => expect(staleSignal?.aborted).toBe(true))
		await vi.waitFor(() =>
			expect(mockState.downloadFileContent.mock.calls.length).toBeGreaterThan(1),
		)
		expect(store.isInitializing).toBe(true)

		resolveNewDeckDownload("<main>new deck active slide</main>")
		await Promise.all([staleUpdate, latestUpdate])

		expect(store.slides.map((slide) => slide.path)).toEqual(["new-slide.html"])
		expect(store.slides[0]?.loadingState).toBe("loaded")
		expect(store.isInitializing).toBe(false)
		expect(store.loadingProgress).toBe(100)
	})

	it("treats an explicit mainFileId clear as a deck replacement", async () => {
		const { store, paths } = createStore(2, { autoLoadAndGenerate: false })
		stores.push(store)
		const oldSlides = setIdleSlides(store, 2)
		oldSlides[0].rawContent = "<main>old raw content</main>"
		oldSlides[0].content = "<main>old processed content</main>"
		oldSlides[0].loadingState = "loaded"
		store.pathMappingService.setPathUrlMapping(paths[0], "https://old.example.com/slide-0")
		store.pathMappingService.setPathUrlMapping(paths[1], "https://old.example.com/slide-1")

		let oldSignal: AbortSignal | undefined
		let resolveOldDownload: (content: string) => void = () => undefined
		mockState.downloadFileContent.mockImplementationOnce(
			(_url: string, options: { signal?: AbortSignal }) =>
				new Promise<string>((resolve) => {
					oldSignal = options.signal
					resolveOldDownload = resolve
				}),
		)

		const oldLoad = store.ensureSlideContent(1, "active")
		await vi.waitFor(() => expect(oldSignal).toBeDefined())
		const oldFirstSlide = store.slides[0]

		await store.updateConfig({
			attachments: undefined,
			attachmentList: undefined,
			mainFileId: undefined,
			mainFileName: undefined,
			displayConfig: { slides: [...paths] },
		})

		expect(oldSignal?.aborted).toBe(true)
		await expect(oldLoad).resolves.toBe(false)
		expect(store.slides[0]).not.toBe(oldFirstSlide)
		expect(store.slides[0]).toMatchObject({
			path: paths[0],
			url: "",
			loadingState: "idle",
		})
		expect(store.slides[0]?.rawContent).toBeUndefined()
		expect(store.slides[0]?.content).toBeUndefined()
		expect(store.pathMappingService.getAllFileIdMappings()).toEqual(new Map())
		expect(store.pathMappingService.getAllUrlMappings()).toEqual(new Map())

		const storeInternals = store as unknown as {
			attachmentListSnapshot?: unknown
			processorService: {
				config: {
					attachments?: unknown[]
					attachmentList?: unknown[]
					mainFileId?: string
					mainFileName?: string
				}
			}
			cacheManager: { mainFileId?: string }
		}
		expect(storeInternals.attachmentListSnapshot).toBeUndefined()
		expect(storeInternals.processorService.config.attachments).toBeUndefined()
		expect(storeInternals.processorService.config.attachmentList).toBeUndefined()
		expect(storeInternals.processorService.config.mainFileId).toBeUndefined()
		expect(storeInternals.processorService.config.mainFileName).toBeUndefined()
		expect(storeInternals.cacheManager.mainFileId).toBeUndefined()

		const processedCallCount = mockState.processHtmlContent.mock.calls.length
		resolveOldDownload("<main>late old deck content</main>")
		await vi.waitFor(() => expect(store.getContentLoadStats().active).toBe(0))
		expect(mockState.processHtmlContent).toHaveBeenCalledTimes(processedCallCount)
		expect(store.slides[0]?.content).toBeUndefined()
	})

	it("keeps one physical content budget across deck generations", async () => {
		const { store } = createStore(1, {
			autoLoadAndGenerate: false,
			contentLoadConcurrency: 1,
		})
		stores.push(store)
		setIdleSlides(store, 1)

		let oldSignal: AbortSignal | undefined
		let resolveOldDownload: (content: string) => void = () => undefined
		mockState.downloadFileContent.mockImplementation(
			(url: string, options: { signal?: AbortSignal }) => {
				if (url.endsWith("file-0.html")) {
					return new Promise<string>((resolve) => {
						oldSignal = options.signal
						resolveOldDownload = resolve
					})
				}
				return Promise.resolve(`<main>${url}</main>`)
			},
		)

		const oldLoad = store.ensureSlideContent(0, "active")
		await vi.waitFor(() => expect(oldSignal).toBeDefined())

		const deckUpdate = store.updateConfig({
			autoLoadAndGenerate: true,
			mainFileId: "new-main-file",
			mainFileName: "index.html",
			displayConfig: { slides: ["new-slide.html"] },
			attachmentList: [
				{
					file_id: "new-main-file",
					file_name: "index.html",
					relative_file_path: "new-deck/index.html",
				},
				{
					file_id: "new-slide-file",
					file_name: "new-slide.html",
					relative_file_path: "new-deck/new-slide.html",
				},
			],
		})

		await vi.waitFor(() => expect(oldSignal?.aborted).toBe(true))
		await vi.waitFor(() => expect(store.slides[0]?.path).toBe("new-slide.html"))
		const cacheManager = (store as unknown as { cacheManager: { mainFileId?: string } })
			.cacheManager
		expect(cacheManager.mainFileId).toBe("new-main-file")
		expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1)
		expect(store.getContentLoadStats()).toEqual({ active: 1, queued: 1, total: 2 })
		await expect(oldLoad).resolves.toBe(false)

		resolveOldDownload("<main>late old content</main>")
		await deckUpdate

		expect(mockState.downloadFileContent).toHaveBeenCalledTimes(2)
		expect(store.slides[0]?.content).toContain("new-slide-file")
		expect(store.getContentLoadStats()).toEqual({ active: 0, queued: 0, total: 0 })
	})

	it("loads the configured initial page before page zero", async () => {
		const { store, paths } = createStore(200, { initialActiveIndex: 100 })
		stores.push(store)

		await store.initializeSlides(paths)

		expect(store.activeIndex).toBe(100)
		expect(mockState.downloadFileContent).toHaveBeenNthCalledWith(
			1,
			"https://example.com/file-100.html",
			{ signal: expect.any(AbortSignal) },
		)
	})

	it("keeps initialization pending until the latest restored active page settles", async () => {
		const { store, paths } = createStore(3)
		stores.push(store)
		let initialSignal: AbortSignal | undefined
		let resolveLatestDownload: (content: string) => void = () => undefined
		mockState.downloadFileContent
			.mockImplementationOnce(
				(_url: string, options: { signal?: AbortSignal }) =>
					new Promise<string>((_resolve, reject) => {
						initialSignal = options.signal
						options.signal?.addEventListener("abort", () => {
							reject(new DOMException("The operation was aborted", "AbortError"))
						})
					}),
			)
			.mockImplementationOnce(
				() =>
					new Promise<string>((resolve) => {
						resolveLatestDownload = resolve
					}),
			)

		const initialization = store.initializeSlides(paths)
		await vi.waitFor(() => expect(initialSignal).toBeDefined())

		store.setActiveIndex(2)

		await vi.waitFor(() => expect(initialSignal?.aborted).toBe(true))
		await vi.waitFor(() => expect(mockState.downloadFileContent).toHaveBeenCalledTimes(2))
		expect(store.isInitializing).toBe(true)

		resolveLatestDownload("<main>restored active slide</main>")
		await initialization

		expect(store.activeIndex).toBe(2)
		expect(store.slides[2]?.loadingState).toBe("loaded")
		expect(store.isInitializing).toBe(false)
	})

	it("keeps sidebar content work within the configured concurrency limit", async () => {
		const { store } = createStore(12, { contentLoadConcurrency: 4 })
		stores.push(store)
		setIdleSlides(store, 12)
		let activeRequests = 0
		let maximumActiveRequests = 0
		mockState.downloadFileContent.mockImplementation(async (url: string) => {
			activeRequests++
			maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests)
			await new Promise((resolve) => window.setTimeout(resolve, 5))
			activeRequests--
			return `<main>${url}</main>`
		})

		store.updateVisibleSlidePreviews(Array.from({ length: 12 }, (_, index) => index))

		await vi.waitFor(
			() => expect(store.slides.every((slide) => slide.loadingState === "loaded")).toBe(true),
			{ timeout: 2000 },
		)
		expect(maximumActiveRequests).toBeGreaterThan(1)
		expect(maximumActiveRequests).toBeLessThanOrEqual(4)
	})

	it("deduplicates active and sidebar demand for the same slide", async () => {
		const { store } = createStore(1)
		stores.push(store)
		setIdleSlides(store, 1)
		let resolveDownload: (content: string) => void = () => undefined
		mockState.downloadFileContent.mockImplementation(
			() =>
				new Promise<string>((resolve) => {
					resolveDownload = resolve
				}),
		)

		const activePromise = store.ensureSlideContent(0, "active")
		store.updateVisibleSlidePreviews([0])
		await vi.waitFor(() => expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1))

		resolveDownload("<main>slide 0</main>")
		await expect(activePromise).resolves.toBe(true)
		await vi.waitFor(() => expect(store.slides[0]?.loadingState).toBe("loaded"))
		expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1)
	})

	it("loads targets reached through direct, next, previous and first-page navigation", async () => {
		const { store } = createStore(3)
		stores.push(store)
		setIdleSlides(store, 3)

		store.setActiveIndex(1)
		await vi.waitFor(() => expect(store.slides[1]?.loadingState).toBe("loaded"))
		store.nextSlide()
		await vi.waitFor(() => expect(store.slides[2]?.loadingState).toBe("loaded"))
		store.prevSlide()
		expect(store.activeIndex).toBe(1)
		store.goToFirstSlide()
		await vi.waitFor(() => expect(store.slides[0]?.loadingState).toBe("loaded"))

		expect(new Set(mockState.downloadFileContent.mock.calls.map(([url]) => url))).toEqual(
			new Set([
				"https://example.com/file-1.html",
				"https://example.com/file-2.html",
				"https://example.com/file-0.html",
			]),
		)
		expect(mockState.downloadFileContent).toHaveBeenCalledTimes(3)
	})

	it("drops queued previews that leave the virtual range during fast scrolling", async () => {
		const { store } = createStore(6, { contentLoadConcurrency: 2 })
		stores.push(store)
		setIdleSlides(store, 6)
		let resolveFirst: (content: string) => void = () => undefined
		mockState.downloadFileContent.mockImplementation((url: string) => {
			if (url.endsWith("file-0.html")) {
				return new Promise<string>((resolve) => {
					resolveFirst = resolve
				})
			}
			return Promise.resolve(`<main>${url}</main>`)
		})

		store.updateVisibleSlidePreviews([0, 1, 2, 3, 4, 5])
		await vi.waitFor(() => expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1))
		store.updateVisibleSlidePreviews([5])
		resolveFirst("<main>slide 0</main>")

		await vi.waitFor(() => expect(store.slides[5]?.loadingState).toBe("loaded"))
		expect(mockState.downloadFileContent.mock.calls.map(([url]) => url)).toEqual([
			"https://example.com/file-0.html",
			"https://example.com/file-5.html",
		])
	})

	it("aborts old deck work on reset and prevents late content writes", async () => {
		const { store } = createStore(1)
		stores.push(store)
		setIdleSlides(store, 1)
		let requestSignal: AbortSignal | undefined
		mockState.downloadFileContent.mockImplementation(
			(_url: string, options: { signal?: AbortSignal }) =>
				new Promise<string>((_resolve, reject) => {
					requestSignal = options.signal
					options.signal?.addEventListener("abort", () => {
						reject(new DOMException("The operation was aborted", "AbortError"))
					})
				}),
		)

		const loadPromise = store.ensureSlideContent(0, "active")
		await vi.waitFor(() => expect(requestSignal).toBeDefined())
		store.reset()

		expect(requestSignal?.aborted).toBe(true)
		await expect(loadPromise).resolves.toBe(false)
		expect(store.slides).toEqual([])
	})

	it("can initialize the same deck again after reset invalidates an in-flight initialization", async () => {
		const { store, paths } = createStore(2)
		stores.push(store)
		let firstFileIds: string[] = []
		let resolveFirstUrls: (value: Array<{ file_id: string; url: string }>) => void = () =>
			undefined
		mockState.getTemporaryDownloadUrl
			.mockImplementationOnce(
				({ file_ids }: { file_ids: string[] }) =>
					new Promise<Array<{ file_id: string; url: string }>>((resolve) => {
						firstFileIds = file_ids
						resolveFirstUrls = resolve
					}),
			)
			.mockImplementation(async ({ file_ids }: { file_ids: string[] }) =>
				file_ids.map((fileId) => ({
					file_id: fileId,
					url: `https://example.com/${fileId}.html`,
				})),
			)

		const staleInitialization = store.initializeSlides(paths)
		await vi.waitFor(() => expect(mockState.getTemporaryDownloadUrl).toHaveBeenCalledTimes(1))
		store.reset()

		await store.initializeSlides(paths)
		resolveFirstUrls(
			firstFileIds.map((fileId) => ({
				file_id: fileId,
				url: `https://stale.example.com/${fileId}.html`,
			})),
		)
		await staleInitialization

		expect(mockState.getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
		expect(store.slides.map((slide) => slide.path)).toEqual(paths)
		expect(store.slides[0]?.loadingState).toBe("loaded")
	})

	it("keeps a newer deck when an older incremental addition resolves late", async () => {
		const { store, attachmentList } = createStore(1)
		stores.push(store)
		setIdleSlides(store, 1)
		let resolveOldUrls: (value: Array<{ file_id: string; url: string }>) => void = () =>
			undefined
		mockState.getTemporaryDownloadUrl
			.mockImplementationOnce(
				() =>
					new Promise<Array<{ file_id: string; url: string }>>((resolve) => {
						resolveOldUrls = resolve
					}),
			)
			.mockImplementation(async ({ file_ids }: { file_ids: string[] }) =>
				file_ids.map((fileId) => ({
					file_id: fileId,
					url: `https://example.com/${fileId}.html`,
				})),
			)

		const staleUpdate = store.updateConfig({
			displayConfig: { slides: ["slide-0.html", "slide-1.html"] },
			attachmentList: [
				...attachmentList,
				{
					file_id: "file-1",
					file_name: "slide-1.html",
					relative_file_path: "deck/slide-1.html",
				},
			],
		})
		await vi.waitFor(() => expect(mockState.getTemporaryDownloadUrl).toHaveBeenCalledTimes(1))

		await store.updateConfig({
			mainFileId: "new-main-file",
			mainFileName: "index.html",
			displayConfig: { slides: ["new-slide.html"] },
			attachmentList: [
				{
					file_id: "new-main-file",
					file_name: "index.html",
					relative_file_path: "new-deck/index.html",
				},
				{
					file_id: "new-slide-file",
					file_name: "new-slide.html",
					relative_file_path: "new-deck/new-slide.html",
				},
			],
		})
		resolveOldUrls([
			{
				file_id: "file-1",
				url: "https://stale.example.com/file-1.html",
			},
		])
		await staleUpdate

		expect(store.slides.map((slide) => slide.path)).toEqual(["new-slide.html"])
		expect(store.slides[0]?.content).toContain("new-slide-file")
	})

	it("reconciles every page from the latest same-deck config update", async () => {
		const { store, attachmentList } = createStore(1)
		stores.push(store)
		setIdleSlides(store, 1)
		let resolveFirstUrls: (value: Array<{ file_id: string; url: string }>) => void = () =>
			undefined
		mockState.getTemporaryDownloadUrl
			.mockImplementationOnce(
				() =>
					new Promise<Array<{ file_id: string; url: string }>>((resolve) => {
						resolveFirstUrls = resolve
					}),
			)
			.mockImplementation(async ({ file_ids }: { file_ids: string[] }) =>
				file_ids.map((fileId) => ({
					file_id: fileId,
					url: `https://example.com/${fileId}.html`,
				})),
			)

		const firstUpdate = store.updateConfig({
			displayConfig: { slides: ["slide-0.html", "slide-1.html"] },
			attachmentList: [
				...attachmentList,
				{
					file_id: "file-1",
					file_name: "slide-1.html",
					relative_file_path: "deck/slide-1.html",
				},
			],
		})
		await vi.waitFor(() => expect(mockState.getTemporaryDownloadUrl).toHaveBeenCalledTimes(1))

		await store.updateConfig({
			displayConfig: {
				slides: ["slide-0.html", "slide-1.html", "slide-2.html"],
			},
			attachmentList: [
				...attachmentList,
				{
					file_id: "file-1",
					file_name: "slide-1.html",
					relative_file_path: "deck/slide-1.html",
				},
				{
					file_id: "file-2",
					file_name: "slide-2.html",
					relative_file_path: "deck/slide-2.html",
				},
			],
		})
		resolveFirstUrls([
			{
				file_id: "file-1",
				url: "https://stale.example.com/file-1.html",
			},
		])
		await firstUpdate

		expect(store.slides.map((slide) => slide.path)).toEqual([
			"slide-0.html",
			"slide-1.html",
			"slide-2.html",
		])
	})

	it("restarts pending initialization when the same main file gets newer attachments", async () => {
		const { store } = createStore(0)
		stores.push(store)
		let resolveOldInitialization: (
			value: Array<{ file_id: string; url: string }>,
		) => void = () => undefined
		mockState.getTemporaryDownloadUrl
			.mockImplementationOnce(
				() =>
					new Promise<Array<{ file_id: string; url: string }>>((resolve) => {
						resolveOldInitialization = resolve
					}),
			)
			.mockImplementation(async ({ file_ids }: { file_ids: string[] }) =>
				file_ids.map((fileId) => ({
					file_id: fileId,
					url: `https://example.com/${fileId}.html`,
				})),
			)

		const staleInitialization = store.updateConfig({
			mainFileId: "replacement-main",
			mainFileName: "index.html",
			displayConfig: { slides: ["shared-slide.html"] },
			attachmentList: [
				{
					file_id: "replacement-main",
					file_name: "index.html",
					relative_file_path: "replacement/index.html",
				},
				{
					file_id: "old-shared-file",
					file_name: "shared-slide.html",
					relative_file_path: "replacement/shared-slide.html",
				},
			],
		})
		await vi.waitFor(() => expect(mockState.getTemporaryDownloadUrl).toHaveBeenCalledTimes(1))

		await store.updateConfig({
			mainFileId: "replacement-main",
			mainFileName: "index.html",
			displayConfig: { slides: ["shared-slide.html"] },
			attachmentList: [
				{
					file_id: "replacement-main",
					file_name: "index.html",
					relative_file_path: "replacement/index.html",
				},
				{
					file_id: "new-shared-file",
					file_name: "shared-slide.html",
					relative_file_path: "replacement/shared-slide.html",
				},
			],
		})
		resolveOldInitialization([
			{
				file_id: "old-shared-file",
				url: "https://stale.example.com/old-shared-file.html",
			},
		])
		await staleInitialization

		expect(store.slides.map((slide) => slide.path)).toEqual(["shared-slide.html"])
		expect(store.getFileIdByPath("shared-slide.html")).toBe("new-shared-file")
		expect(store.slides[0]?.content).toContain("new-shared-file")
	})

	it("prevents an old scheduled request from overwriting a manual refresh", async () => {
		const { store } = createStore(1)
		stores.push(store)
		setIdleSlides(store, 1)
		let resolveOldDownload: (content: string) => void = () => undefined
		mockState.downloadFileContent
			.mockImplementationOnce(
				() =>
					new Promise<string>((resolve) => {
						resolveOldDownload = resolve
					}),
			)
			.mockImplementation(async () => "<main>fresh content</main>")

		const staleLoad = store.ensureSlideContent(0, "preview")
		await vi.waitFor(() => expect(mockState.downloadFileContent).toHaveBeenCalledTimes(1))
		await store.refreshSlideByFileId("file-0")

		expect(store.slides[0]?.content).toContain("fresh content")
		resolveOldDownload("<main>stale content</main>")
		await expect(staleLoad).resolves.toBe(false)
		await new Promise((resolve) => window.setTimeout(resolve, 0))
		expect(store.slides[0]?.content).toContain("fresh content")
	})

	it("aborts silent direct downloads when the store resets", async () => {
		const { store } = createStore(1)
		stores.push(store)
		setIdleSlides(store, 1)
		let requestSignal: AbortSignal | undefined
		mockState.downloadFileContent.mockImplementation(
			(_url: string, options: { signal?: AbortSignal }) =>
				new Promise<string>((_resolve, reject) => {
					requestSignal = options.signal
					options.signal?.addEventListener("abort", () => {
						reject(new DOMException("The operation was aborted", "AbortError"))
					})
				}),
		)

		const silentLoad = store.loadSlideContentSilently("https://example.com/file-0.html", 0)
		await vi.waitFor(() => expect(requestSignal).toBeDefined())
		store.reset()

		expect(requestSignal?.aborted).toBe(true)
		await expect(silentLoad).resolves.toBe("")
	})

	it("leaves initialization after an active-page error", async () => {
		const { store, paths } = createStore(1)
		stores.push(store)
		mockState.downloadFileContent.mockRejectedValue(new Error("network failed"))
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

		await store.initializeSlides(paths)

		expect(store.isInitializing).toBe(false)
		expect(store.slides[0]?.loadingState).toBe("error")
		expect(store.slides[0]?.loadingError).toBeInstanceOf(Error)
		consoleError.mockRestore()
	})
})
