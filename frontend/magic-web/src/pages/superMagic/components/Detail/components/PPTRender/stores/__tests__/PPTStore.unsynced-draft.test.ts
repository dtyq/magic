import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PPTStore } from "../PPTStore"

const mockState = vi.hoisted(() => ({
	peekUnsyncedDraft: vi.fn<(fileId: string) => unknown>(),
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

vi.mock("../../../../services/fileSaveQueue", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../../../services/fileSaveQueue")>()),
	peekUnsyncedDraft: mockState.peekUnsyncedDraft,
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

const RELATIVE_IMAGE = '<img src="./cover.png">'
const REWRITTEN_IMAGE = '<img src="https://cdn.example.com/cover.png">'

function createStore() {
	const store = new PPTStore({
		attachments: [],
		attachmentList: [
			{
				file_id: "main-file",
				file_name: "index.html",
				relative_file_path: "deck/index.html",
			},
			{
				file_id: "file-0",
				file_name: "slide-0.html",
				relative_file_path: "deck/slide-0.html",
			},
		],
		mainFileId: "main-file",
		mainFileName: "index.html",
		logger: { enabled: false },
		fileUpdateDebounceMs: 0,
	})
	store.pathMappingService.setPathFileIdMapping("slide-0.html", "file-0")
	store.setSlides(
		[
			{
				id: "slide-0",
				path: "slide-0.html",
				url: "https://example.com/file-0.html",
				index: 0,
				loadingState: "idle" as const,
			},
		],
		true,
	)
	return store
}

describe("PPTStore unsynced draft content", () => {
	const stores: PPTStore[] = []

	beforeEach(() => {
		vi.clearAllMocks()
		mockState.peekUnsyncedDraft.mockReturnValue(undefined)
		mockState.getTemporaryDownloadUrl.mockImplementation(async ({ file_ids }) =>
			file_ids.map((fileId: string) => ({
				file_id: fileId,
				url: `https://example.com/${fileId}.html`,
			})),
		)
		mockState.downloadFileContent.mockResolvedValue("<main>server</main>")
		mockState.processHtmlContent.mockImplementation(async ({ content }) => ({
			processedContent: String(content).replace(RELATIVE_IMAGE, REWRITTEN_IMAGE),
		}))
	})

	afterEach(() => {
		stores.splice(0).forEach((store) => store.dispose())
	})

	it("processes a recovered draft before storing it as slide content", async () => {
		const store = createStore()
		stores.push(store)

		await store.applyUnsyncedDraft("file-0", `<main>${RELATIVE_IMAGE}</main>`)

		const slide = store.slides[0]
		expect(slide?.rawContent).toBe(`<main>${RELATIVE_IMAGE}</main>`)
		expect(slide?.content).toBe(`<main>${REWRITTEN_IMAGE}</main>`)
	})

	it("uses the processed draft instead of server content when loading a slide", async () => {
		mockState.peekUnsyncedDraft.mockImplementation((fileId) =>
			fileId === "file-0" ? `<main>${RELATIVE_IMAGE}</main>` : undefined,
		)
		const store = createStore()
		stores.push(store)

		await store.loadSlideContentByFileId("file-0", {
			url: "https://example.com/file-0.html",
		})

		const slide = store.slides[0]
		expect(slide?.rawContent).toBe(`<main>${RELATIVE_IMAGE}</main>`)
		expect(slide?.content).toBe(`<main>${REWRITTEN_IMAGE}</main>`)
	})

	it("keeps server content processed when there is no draft", async () => {
		const store = createStore()
		stores.push(store)

		await store.loadSlideContentByFileId("file-0", {
			url: "https://example.com/file-0.html",
		})

		expect(store.slides[0]?.rawContent).toBe("<main>server</main>")
		expect(store.slides[0]?.content).toBe("<main>server</main>")
	})
})
