import { beforeEach, describe, expect, it, vi } from "vitest"
import { PPTIncrementalUpdateService } from "../PPTIncrementalUpdateService"
import type { SlideItem } from "../../PPTSidebar/types"

describe("PPTIncrementalUpdateService", () => {
	let pathMappingService: {
		getFileIdByPath: ReturnType<typeof vi.fn>
		extractFileIdFromPath: ReturnType<typeof vi.fn>
		setPathFileIdMapping: ReturnType<typeof vi.fn>
		fetchUrlsForFileIds: ReturnType<typeof vi.fn>
	}
	let screenshotService: {
		clearCache: ReturnType<typeof vi.fn>
	}
	let incrementalUpdateService: PPTIncrementalUpdateService

	beforeEach(() => {
		pathMappingService = {
			getFileIdByPath: vi.fn((path: string) =>
				path === "slide-1.html" ? "file-1" : path === "slide-2.html" ? "file-2" : undefined,
			),
			extractFileIdFromPath: vi.fn((path: string) =>
				path === "slide-1.html" ? "file-1" : path === "slide-2.html" ? "file-2" : undefined,
			),
			setPathFileIdMapping: vi.fn(),
			fetchUrlsForFileIds: vi.fn(
				async () =>
					new Map([
						["file-1", "https://example.com/slide-1"],
						["file-2", "https://example.com/slide-2"],
					]),
			),
		}
		screenshotService = {
			clearCache: vi.fn(),
		}
		incrementalUpdateService = new PPTIncrementalUpdateService(
			pathMappingService as never,
			screenshotService as never,
			{
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			} as never,
		)
	})

	function createContext(input?: {
		loadSlideContentSilently?: (url: string, index: number) => Promise<string>
		isSlideManuallySaved?: (fileId: string) => boolean
		getSlideEditingState?: (fileId: string) => boolean
		clearManualSaveMark?: (fileId: string) => void
		notifyServerUpdate?: (fileId: string, content: string) => void
		generateSlideScreenshot?: (index: number, targetContent?: string) => Promise<void>
		ensureSlideScreenshot?: (index: number) => Promise<void>
		slides?: SlideItem[]
	}) {
		return {
			slides: input?.slides || [
				{
					id: "slide-1",
					path: "slide-1.html",
					url: "https://example.com/old-slide-1",
					index: 0,
					content: "<div>saved-content</div>",
					rawContent: "<div>saved-content</div>",
				},
			],
			activeIndex: 0,
			autoLoadAndGenerate: true,
			loadSlideContent: vi.fn(async () => "<div>loaded-content</div>"),
			loadSlideContentSilently:
				input?.loadSlideContentSilently || vi.fn(async () => "<div>saved-content</div>"),
			generateSlideScreenshot: input?.generateSlideScreenshot || vi.fn(async () => undefined),
			ensureSlideScreenshot: input?.ensureSlideScreenshot,
			setSlides: vi.fn(),
			setActiveIndex: vi.fn(),
			isSlideManuallySaved: input?.isSlideManuallySaved,
			clearManualSaveMark: input?.clearManualSaveMark,
			getSlideEditingState: input?.getSlideEditingState,
			notifyServerUpdate: input?.notifyServerUpdate,
		}
	}

	it("ignores a manual-save echo while the slide stays in edit mode", async () => {
		const clearManualSaveMark = vi.fn()
		const notifyServerUpdate = vi.fn()
		const generateSlideScreenshot = vi.fn(async () => undefined)
		const context = createContext({
			isSlideManuallySaved: () => true,
			getSlideEditingState: () => true,
			clearManualSaveMark,
			notifyServerUpdate,
			generateSlideScreenshot,
			loadSlideContentSilently: vi.fn(async () => "<div>saved-content</div>"),
		})

		await incrementalUpdateService.applyIncrementalUpdates(
			{ hasChanges: false, added: [], removed: [], reordered: false },
			new Set(["file-1"]),
			["slide-1.html"],
			context,
		)

		expect(notifyServerUpdate).not.toHaveBeenCalled()
		expect(generateSlideScreenshot).not.toHaveBeenCalled()
		expect(clearManualSaveMark).toHaveBeenCalledWith("file-1")
	})

	it("keeps reporting conflicts for new server content while editing", async () => {
		const clearManualSaveMark = vi.fn()
		const notifyServerUpdate = vi.fn()
		const generateSlideScreenshot = vi.fn(async () => undefined)
		const context = createContext({
			isSlideManuallySaved: () => true,
			getSlideEditingState: () => true,
			clearManualSaveMark,
			notifyServerUpdate,
			generateSlideScreenshot,
			loadSlideContentSilently: vi.fn(async () => "<div>server-new-content</div>"),
		})

		await incrementalUpdateService.applyIncrementalUpdates(
			{ hasChanges: false, added: [], removed: [], reordered: false },
			new Set(["file-1"]),
			["slide-1.html"],
			context,
		)

		expect(clearManualSaveMark).toHaveBeenCalledWith("file-1")
		expect(notifyServerUpdate).toHaveBeenCalledWith("file-1", "<div>server-new-content</div>")
		expect(generateSlideScreenshot).toHaveBeenCalledWith(0, "<div>server-new-content</div>")
	})

	it("uses ensureSlideScreenshot for added slide thumbnails to avoid duplicate generation", async () => {
		const generateSlideScreenshot = vi.fn(async () => undefined)
		const ensureSlideScreenshot = vi.fn(async () => undefined)
		const context = createContext({
			slides: [
				{
					id: "slide-1",
					path: "slide-1.html",
					url: "https://example.com/slide-1",
					index: 0,
					content: "<div>slide 1</div>",
					loadingState: "loaded",
				},
			],
			generateSlideScreenshot,
			ensureSlideScreenshot,
		})

		await incrementalUpdateService.applyIncrementalUpdates(
			{
				hasChanges: true,
				added: [{ path: "slide-2.html", index: 1 }],
				removed: [],
				reordered: false,
			},
			new Set(),
			["slide-1.html", "slide-2.html"],
			context,
		)

		expect(ensureSlideScreenshot).toHaveBeenCalledWith(1)
		expect(generateSlideScreenshot).not.toHaveBeenCalled()
	})
})
