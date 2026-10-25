import { beforeEach, describe, expect, it, vi } from "vitest"
import { PPTIncrementalUpdateService } from "../PPTIncrementalUpdateService"
import type { SlideItem } from "../../PPTSidebar/types"

describe("PPTIncrementalUpdateService", () => {
	let pathMappingService: {
		getFileIdByPath: ReturnType<typeof vi.fn>
		extractFileIdFromPath: ReturnType<typeof vi.fn>
		setPathFileIdMapping: ReturnType<typeof vi.fn>
		fetchUrlsForFileIds: ReturnType<typeof vi.fn>
		getPPTFolderFileIds: ReturnType<typeof vi.fn>
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
			getPPTFolderFileIds: vi.fn(() => new Set(["file-1", "file-2"])),
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
		matchesLocalSave?: (fileId: string, content: string) => boolean
		hasPendingSave?: (fileId: string) => boolean
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
			matchesLocalSave: input?.matchesLocalSave,
			hasPendingSave: input?.hasPendingSave,
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

	it("skips reload and thumbnail reset for a notes save echo outside edit mode", async () => {
		const clearManualSaveMark = vi.fn()
		const generateSlideScreenshot = vi.fn(async () => undefined)
		const context = createContext({
			isSlideManuallySaved: () => true,
			getSlideEditingState: () => false,
			clearManualSaveMark,
			generateSlideScreenshot,
			slides: [
				{
					id: "slide-1",
					path: "slide-1.html",
					url: "https://example.com/old-slide-1",
					index: 0,
					content: "<div>saved-content</div>",
					rawContent: "<div>saved-content</div>",
					thumbnailUrl: "blob:existing-thumb",
					loadingState: "loaded",
					lastLoadedAt: 100,
				},
			],
		})

		await incrementalUpdateService.applyIncrementalUpdates(
			{ hasChanges: false, added: [], removed: [], reordered: false },
			new Set(["file-1"]),
			["slide-1.html"],
			context,
		)

		expect(context.loadSlideContent).not.toHaveBeenCalled()
		expect(generateSlideScreenshot).not.toHaveBeenCalled()
		expect(screenshotService.clearCache).not.toHaveBeenCalled()
		expect(clearManualSaveMark).toHaveBeenCalledWith("file-1")
		expect(context.slides[0].thumbnailUrl).toBe("blob:existing-thumb")
		expect(context.slides[0].lastLoadedAt).toBe(100)
	})

	it("skips auto-reload while a queued save is still pending", async () => {
		const notifyServerUpdate = vi.fn()
		const context = createContext({
			hasPendingSave: () => true,
			matchesLocalSave: () => true,
			notifyServerUpdate,
			slides: [
				{
					id: "slide-1",
					path: "slide-1.html",
					url: "https://example.com/old-slide-1",
					index: 0,
					content: "<div>local-draft</div>",
					rawContent: "<div>local-draft</div>",
					thumbnailUrl: "blob:existing-thumb",
					loadingState: "loaded",
				},
			],
		})

		await incrementalUpdateService.applyIncrementalUpdates(
			{ hasChanges: false, added: [], removed: [], reordered: false },
			new Set(["file-1"]),
			["slide-1.html"],
			context,
		)

		expect(context.loadSlideContent).not.toHaveBeenCalled()
		expect(notifyServerUpdate).not.toHaveBeenCalled()
		expect(context.slides[0].content).toBe("<div>local-draft</div>")
	})

	it("surfaces a foreign remote change while an edited slide still has a pending save", async () => {
		const notifyServerUpdate = vi.fn()
		const context = createContext({
			getSlideEditingState: () => true,
			hasPendingSave: () => true,
			matchesLocalSave: () => false,
			loadSlideContentSilently: async () => "<div>remote-change</div>",
			notifyServerUpdate,
			slides: [
				{
					id: "slide-1",
					path: "slide-1.html",
					url: "https://example.com/old-slide-1",
					index: 0,
					content: "<div>local-draft</div>",
					rawContent: "<div>local-draft</div>",
					loadingState: "loaded",
				},
			],
		})

		await incrementalUpdateService.applyIncrementalUpdates(
			{ hasChanges: false, added: [], removed: [], reordered: false },
			new Set(["file-1"]),
			["slide-1.html"],
			context,
		)

		expect(notifyServerUpdate).toHaveBeenCalledWith("file-1", "<div>remote-change</div>")
	})

	it("applies a staged remote update once the save queue is idle", async () => {
		let pending = true
		const context = createContext({
			hasPendingSave: () => pending,
			slides: [
				{
					id: "slide-1",
					path: "slide-1.html",
					url: "https://example.com/old-slide-1",
					index: 0,
					content: "<div>local-draft</div>",
					rawContent: "<div>local-draft</div>",
					loadingState: "loaded",
				},
			],
		})

		await incrementalUpdateService.applyIncrementalUpdates(
			{ hasChanges: false, added: [], removed: [], reordered: false },
			new Set(["file-1"]),
			["slide-1.html"],
			context,
		)
		await incrementalUpdateService.flushStagedRemoteUpdates(context)
		expect(context.loadSlideContent).not.toHaveBeenCalled()

		pending = false
		await incrementalUpdateService.flushStagedRemoteUpdates(context)
		expect(context.loadSlideContent).toHaveBeenCalledTimes(1)

		await incrementalUpdateService.flushStagedRemoteUpdates(context)
		expect(context.loadSlideContent).toHaveBeenCalledTimes(1)
	})

	it("keeps added slides idle until active or sidebar demand loads them", async () => {
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

		expect(context.slides[1]?.loadingState).toBe("idle")
		expect(context.loadSlideContent).not.toHaveBeenCalled()
		expect(ensureSlideScreenshot).not.toHaveBeenCalled()
		expect(generateSlideScreenshot).not.toHaveBeenCalled()
	})

	it("drops an addition when a newer config update supersedes it", async () => {
		let resolveUrls: (value: Map<string, string>) => void = () => undefined
		pathMappingService.fetchUrlsForFileIds.mockImplementationOnce(
			() =>
				new Promise<Map<string, string>>((resolve) => {
					resolveUrls = resolve
				}),
		)
		let current = true
		const context = createContext()
		context.isCurrent = () => current

		const updatePromise = incrementalUpdateService.applyIncrementalUpdates(
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

		await vi.waitFor(() => expect(pathMappingService.fetchUrlsForFileIds).toHaveBeenCalled())
		current = false
		resolveUrls(new Map([["file-2", "https://example.com/new-slide-2"]]))
		await updatePromise

		expect(context.setSlides).not.toHaveBeenCalled()
		expect(context.slides).toHaveLength(1)
	})

	it("detects updated files inside nested attachment items", () => {
		const previousList = [
			{
				file_id: "folder-1",
				file_name: "deck",
				updated_at: "1",
				children: [
					{
						file_id: "file-1",
						file_name: "slide-1.html",
						updated_at: "1",
					},
				],
			},
		]
		const newList = [
			{
				file_id: "folder-1",
				file_name: "deck",
				updated_at: "1",
				children: [
					{
						file_id: "file-1",
						file_name: "slide-1.html",
						updated_at: "2",
					},
					{
						file_id: "file-2",
						file_name: "slide-2.html",
						updated_at: "1",
					},
					{
						file_id: "outside-file",
						file_name: "notes.html",
						updated_at: "2",
					},
				],
			},
		]

		const updatedFileIds = incrementalUpdateService.detectUpdatedFiles(
			previousList as never,
			newList as never,
		)

		expect(updatedFileIds.has("file-1")).toBe(true)
		expect(updatedFileIds.has("file-2")).toBe(true)
		expect(updatedFileIds.has("outside-file")).toBe(false)
		expect(updatedFileIds.has("folder-1")).toBe(false)
	})

	it("does not treat the whole project as updated when the folder index is empty", () => {
		pathMappingService.getPPTFolderFileIds.mockReturnValue(new Set())

		const updatedFileIds = incrementalUpdateService.detectUpdatedFiles(
			[
				{
					file_id: "other-folder",
					file_name: "SLIDE-other",
					updated_at: "1",
					children: [{ file_id: "other-slide", updated_at: "1" }],
				},
			] as never,
			[
				{
					file_id: "other-folder",
					file_name: "SLIDE-other",
					updated_at: "2",
					children: [{ file_id: "other-slide", updated_at: "2" }],
				},
			] as never,
		)

		expect(updatedFileIds.size).toBe(0)
	})
})
