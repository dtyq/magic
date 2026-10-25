import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PPTStore } from "../../stores/PPTStore"
import { usePPTDeckTools } from "../usePPTDeckTools"
import { PPTSlideManager } from "../../stores/PPTSlideManager"

const mocks = vi.hoisted(() => ({
	fileApi: { identityKey: "session:project:topic" },
	sharePage: false,
	createFileApi: vi.fn(),
	boundIdentities: [] as string[],
	read: vi.fn(),
	save: vi.fn(),
	initialize: vi.fn(),
	create: vi.fn(),
	getInfo: vi.fn(),
	findManifest: vi.fn(),
	addFile: vi.fn(),
	toast: vi.fn(),
	checks: [] as Array<() => boolean>,
	download: vi.fn(),
	getUrls: vi.fn(),
}))
vi.mock("@/pages/superMagic/utils/api", () => ({
	downloadFileContent: mocks.download,
	getTemporaryDownloadUrl: mocks.getUrls,
}))
vi.mock("@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor", () => ({
	processHtmlContent: async ({ content }: { content: string }) => ({ processedContent: content }),
	collectFileIdsFromHtml: () => new Set(),
}))
vi.mock("../../../../contents/HTML/utils/full-content", () => ({
	decodeHTMLEntities: (content: string) => content,
	fallbackImageBase64: "data:image/png;base64,",
	getFullContent: (content: string) => content,
}))
vi.mock("@/infrastructure/logger", () => ({
	logger: { createLogger: () => ({ warn: vi.fn(), error: vi.fn() }) },
}))
vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))
vi.mock("@/apis", () => ({
	SuperMagicApi: { createFile: mocks.create },
	MagicFSApi: { getFileInfo: mocks.getInfo },
}))
vi.mock("@/stores/projectFiles", () => ({ default: { addWorkspaceFile: mocks.addFile } }))
vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { success: mocks.toast, error: mocks.toast, info: mocks.toast },
}))
vi.mock("@/pages/superMagic/fileAccess/fileApi", () => ({
	useFileApi: () => mocks.fileApi,
	createFileApi: mocks.createFileApi,
}))
vi.mock("@/pages/superMagic/fileAccess/fileAccessContext", () => ({
	isSharePageLocation: () => mocks.sharePage,
	createSessionFileAccess: (params: { projectId?: string }) => ({ kind: "session", ...params }),
}))
vi.mock("@/pages/superMagic/services/attachmentsTopicSync", () => ({
	requestProjectAttachmentsFullRefresh: vi.fn(),
}))
vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils/magicProjectFileFinder", () => ({
	findMagicProjectJsFile: mocks.findManifest,
}))
vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils/magicProjectUpdater", () => ({
	parseMagicProjectJs: (content: string) => {
		const config = JSON.parse(content)
		return { slides: config.slides, config }
	},
	generateUpdatedMagicProjectJs: (config: unknown) => JSON.stringify(config),
	generateBlankSlideContent: () => "<html>blank</html>",
}))
vi.mock("../../services/pptFileMutation", () => ({
	PPTFileMutationError: class extends Error {
		constructor(public readonly kind: string) {
			super(kind)
		}
	},
	createPPTFileMutationClient: (
		api: { identityKey: string },
		options: { isCurrent: () => boolean },
	) => {
		mocks.boundIdentities.push(api.identityKey)
		mocks.checks.push(options.isCurrent)
		return { read: mocks.read, save: mocks.save, initializeCreatedFile: mocks.initialize }
	},
}))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

function makeOptions(hidden: string[] = []) {
	const store = {
		slides: [{ path: "a.html" }, { path: "b.html" }],
		slidePaths: ["a.html", "b.html"],
		currentSlide: { path: "a.html" },
		getFileIdByPath: (path: string) => (path === "a.html" ? "a" : "b"),
		getConfigForExport: () => ({ displayConfig: { hidden_slides: hidden } }),
		syncManager: { waitForCompletion: vi.fn().mockResolvedValue(undefined) },
		setSlides: vi.fn(),
		setActiveIndex: vi.fn(),
		updateConfig: vi.fn().mockResolvedValue(undefined),
		pathMappingService: { setPathFileIdMapping: vi.fn() },
	}
	return {
		store: store as unknown as PPTStore,
		allowEdit: true,
		mainFileId: "deck",
		projectId: "project",
		beforeWrite: vi.fn().mockResolvedValue(true),
		attachmentList: [
			{ file_id: "a", file_name: "a.html", parent_id: "folder" },
			{ file_id: "b", file_name: "b.html", parent_id: "folder" },
		],
	}
}

describe("usePPTDeckTools", () => {
	it("deselects all pages without exiting selection mode", () => {
		const options = makeOptions()
		const { result } = renderHook(() => usePPTDeckTools(options))
		expect(result.current.isAllSelected).toBe(false)
		act(() => result.current.selectAll())
		expect(result.current.isAllSelected).toBe(true)
		act(() => result.current.deselectAll())
		expect(result.current.selected.size).toBe(0)
		expect(result.current.isAllSelected).toBe(false)
		expect(result.current.selecting).toBe(true)
	})

	beforeEach(() => {
		vi.clearAllMocks()
		mocks.fileApi.identityKey = "session:project:topic"
		mocks.sharePage = false
		mocks.boundIdentities.length = 0
		mocks.createFileApi.mockImplementation((access: { projectId?: string }) => ({
			identityKey: `session:${access.projectId}:`,
		}))
		mocks.checks.length = 0
		mocks.findManifest.mockResolvedValue({ fileId: "manifest" })
		mocks.getInfo.mockResolvedValue({ file: { id: "manifest", parent_id: "manifest-folder" } })
		mocks.read.mockImplementation(async (fileId: string) => ({
			fileId,
			revision: 1,
			content:
				fileId === "manifest"
					? JSON.stringify({ slides: ["a.html", "b.html"] })
					: "<html>source</html>",
		}))
		mocks.create.mockResolvedValue({
			file_id: "copy",
			file_name: "a (1).html",
			parent_id: "folder",
		})
		mocks.initialize.mockResolvedValue({ revision: 2 })
		mocks.save.mockResolvedValue({ revision: 2 })
		mocks.download.mockResolvedValue("<main>new page</main>")
		mocks.getUrls.mockImplementation(async ({ file_ids }: { file_ids: string[] }) =>
			file_ids.map((file_id) => ({ file_id, url: `https://example.com/${file_id}.html` })),
		)
	})

	it("saves transitions with the manifest revision and preserves unrelated config", async () => {
		const options = makeOptions()
		const existing = {
			default: { effect: "fade", duration_ms: 400 },
			slides: { "b.html": { effect: "none" } },
		}
		mocks.read.mockResolvedValue({
			fileId: "manifest",
			revision: 17,
			content: JSON.stringify({
				slides: ["a.html", "b.html"],
				transitions: existing,
				title: "Keep",
			}),
		})
		const { result } = renderHook(() => usePPTDeckTools(options))
		let saved: boolean | undefined
		await act(async () => {
			saved = await result.current.setTransitions({
				scope: "slides",
				paths: ["a.html"],
				transition: { effect: "push", duration_ms: 500, direction: "up" },
				expectedTransitions: existing,
				expectedPaths: ["a.html", "b.html"],
			})
		})
		expect(saved).toBe(true)
		expect(mocks.save.mock.calls[0][0].revision).toBe(17)
		const config = JSON.parse(mocks.save.mock.calls[0][1])
		expect(config.title).toBe("Keep")
		expect(config.transitions.slides["b.html"]).toEqual({ effect: "none" })
		expect(config.transitions.slides["a.html"]).toMatchObject({
			effect: "push",
			duration_ms: 500,
			direction: "up",
		})
		expect(options.store.updateConfig).toHaveBeenCalledWith(
			expect.objectContaining({
				displayConfig: expect.objectContaining({ transitions: config.transitions }),
			}),
		)
	})

	it("refuses a stale transition panel snapshot without submitting a write", async () => {
		const options = makeOptions()
		mocks.read.mockResolvedValue({
			fileId: "manifest",
			revision: 2,
			content: JSON.stringify({
				slides: ["a.html", "b.html"],
				transitions: { default: { effect: "none" } },
			}),
		})
		const { result } = renderHook(() => usePPTDeckTools(options))
		await act(async () => {
			expect(
				await result.current.setTransitions({
					scope: "all",
					paths: ["a.html", "b.html"],
					transition: { effect: "fade", duration_ms: 400 },
					expectedTransitions: undefined,
					expectedPaths: ["a.html", "b.html"],
				}),
			).toBe(false)
		})
		expect(mocks.save).not.toHaveBeenCalled()
		expect(mocks.toast).toHaveBeenCalledWith("ppt.batch.operationConflict")
	})

	it("retains transition drafts after uncertain persistence without applying optimistic config", async () => {
		const options = makeOptions()
		mocks.save.mockRejectedValue(new Error("network"))
		const { result } = renderHook(() => usePPTDeckTools(options))
		await act(async () => {
			expect(
				await result.current.setTransitions({
					scope: "slides",
					paths: ["a.html"],
					transition: { effect: "none" },
					expectedTransitions: undefined,
					expectedPaths: ["a.html", "b.html"],
				}),
			).toBe(false)
		})
		expect(mocks.save).toHaveBeenCalledTimes(1)
		expect(options.store.updateConfig).not.toHaveBeenCalled()
	})

	it("allows a dirty-panel guard to save through the writer without deadlocking", async () => {
		const options = makeOptions()
		const { result } = renderHook(() => usePPTDeckTools(options))
		options.beforeWrite.mockImplementationOnce(async () => {
			const saved = await result.current.setTransitions({
				scope: "slides",
				paths: ["a.html"],
				transition: { effect: "none" },
				expectedTransitions: undefined,
				expectedPaths: ["a.html", "b.html"],
			})
			expect(saved).toBe(true)
			return true
		})
		await act(async () => {
			await result.current.reorder(["b.html", "a.html"])
		})
		expect(mocks.save).toHaveBeenCalledTimes(2)
		expect(result.current.busy).toBe(false)
	})

	it.each([
		{
			operation: "remove middle",
			active: 2,
			paths: ["a.html", "c.html"],
			activePath: "c.html",
		},
		{
			operation: "remove active",
			active: 1,
			paths: ["a.html", "c.html"],
			activePath: "c.html",
		},
		{ operation: "remove last", active: 2, paths: ["a.html", "b.html"], activePath: "b.html" },
		{
			operation: "reorder",
			active: 2,
			paths: ["c.html", "a.html", "b.html"],
			activePath: "c.html",
		},
		{
			operation: "duplicate",
			active: 2,
			paths: ["a.html", "a (1).html", "b.html", "c.html"],
			activePath: "a (1).html",
		},
		{
			operation: "insert",
			active: 2,
			paths: ["a.html", "slide (1).html", "b.html", "c.html"],
			activePath: "slide (1).html",
		},
	])(
		"preserves retained previews after $operation",
		async ({ operation, active, paths, activePath }) => {
			const originalPaths = ["a.html", "b.html", "c.html"]
			const options = makeOptions()
			const store = new PPTStore({
				attachments: [],
				attachmentList: options.attachmentList,
				mainFileId: "deck",
				displayConfig: { slides: originalPaths },
				autoLoadAndGenerate: false,
				logger: { enabled: false },
			})
			options.store = store
			originalPaths.forEach((path) =>
				store.pathMappingService.setPathFileIdMapping(path, path[0]),
			)
			store.setSlides(
				originalPaths.map((path, index) => ({
					id: path,
					path,
					index,
					url: `https://example.com/${path}`,
					content: `<main>${path}</main>`,
					rawContent: `<main>${path}</main>`,
					thumbnailUrl: `blob:${path}`,
					loadingState: "loaded" as const,
					lastLoadedAt: Date.now(),
				})),
				true,
			)
			store.setActiveIndex(active)
			const before = new Map(store.slides.map((slide) => [slide.path, { ...slide }]))
			mocks.read.mockImplementation(async (fileId: string) => ({
				fileId,
				revision: 1,
				content:
					fileId === "manifest"
						? JSON.stringify({ slides: originalPaths })
						: "<html>source</html>",
			}))
			const { result, unmount } = renderHook(() => usePPTDeckTools(options))
			try {
				await act(async () => {
					if (operation === "reorder") await result.current.reorder(paths)
					else if (operation === "duplicate")
						await result.current.duplicate(new Set(["a"]))
					else if (operation === "insert") await result.current.insert(0, "after")
					else
						await result.current.remove(
							new Set([operation === "remove last" ? "c" : "b"]),
						)
				})
				expect(mocks.save).toHaveBeenCalledOnce()
				expect(store.slidePaths).toEqual(paths)
				store.slides.forEach((slide, index) => {
					const previous = before.get(slide.path)
					if (previous) expect(slide).toEqual({ ...previous, index })
				})
				expect(store.currentSlide?.path).toBe(activePath)
				const survivingUrls = paths
					.filter((path) => before.has(path))
					.map((path) => before.get(path)?.url)
				expect(mocks.download.mock.calls.some(([url]) => survivingUrls.includes(url))).toBe(
					false,
				)
			} finally {
				unmount()
				store.dispose()
			}
		},
	)

	it.each([true, false])("preserves loaded slides when setting hidden to %s", async (hidden) => {
		const options = makeOptions(hidden ? [] : ["a.html"])
		mocks.read.mockResolvedValue({
			fileId: "manifest",
			revision: 1,
			content: JSON.stringify({
				slides: ["a.html", "b.html"],
				hidden_slides: hidden ? [] : ["a.html"],
			}),
		})
		const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
		const manager = new PPTSlideManager(
			logger as ConstructorParameters<typeof PPTSlideManager>[0],
			options.store.pathMappingService,
			{} as ConstructorParameters<typeof PPTSlideManager>[2],
			false,
		)
		manager.setSlides(
			["a.html", "b.html"].map((path, index) => ({
				id: path,
				path,
				index,
				url: `https://example.com/${path}`,
				content: `<main>${path}</main>`,
				rawContent: `<main>${path}</main>`,
				thumbnailUrl: `blob:${path}`,
				loadingState: "loaded" as const,
			})),
			true,
		)
		manager.setActiveIndex(1)
		const before = manager.slides.slice()
		Object.defineProperty(options.store, "slides", { get: () => manager.slides })
		Object.defineProperty(options.store, "currentSlide", { get: () => manager.currentSlide })
		options.store.setSlides = manager.setSlides
		options.store.setActiveIndex = manager.setActiveIndex
		const { result, unmount } = renderHook(() => usePPTDeckTools(options))
		await act(async () => result.current.setHidden(hidden, new Set(["a"])))
		expect(mocks.save).toHaveBeenCalledOnce()
		expect(options.store.updateConfig).toHaveBeenCalledWith({
			displayConfig: {
				slides: ["a.html", "b.html"],
				hidden_slides: hidden ? ["a.html"] : [],
			},
		})
		manager.slides.forEach((slide, index) => expect(slide).toBe(before[index]))
		expect(manager.activeIndex).toBe(1)
		unmount()
		manager.syncManager.reset()
	})

	it("does not lock the editor until its unsaved changes are resolved", async () => {
		const props = makeOptions()
		let resolve: (value: boolean) => void = () => undefined
		props.beforeWrite.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done
				}),
		)
		const { result } = renderHook(() => usePPTDeckTools(props))
		let task: Promise<void> | undefined
		act(() => {
			task = result.current.remove(new Set(["a"]))
		})
		expect(result.current.busy).toBe(false)
		expect(mocks.read).not.toHaveBeenCalled()
		await act(async () => {
			resolve(false)
			await task
		})
		expect(mocks.save).not.toHaveBeenCalled()
	})

	it("binds a known ordinary project session when no access provider exists", async () => {
		mocks.fileApi.identityKey = "none"
		const props = makeOptions()
		const { result } = renderHook(() => usePPTDeckTools(props))
		await act(async () => {
			await result.current.remove(new Set(["a"]))
		})
		expect(mocks.createFileApi).toHaveBeenCalledWith({ kind: "session", projectId: "project" })
		expect(mocks.boundIdentities).toEqual(["session:project:"])
		expect(mocks.save).toHaveBeenCalledTimes(1)
	})

	it.each(["none", "share:token:project:"])(
		"does not borrow session access on a share page with %s",
		async (identity) => {
			mocks.fileApi.identityKey = identity
			mocks.sharePage = true
			const props = makeOptions()
			const { result } = renderHook(() => usePPTDeckTools(props))
			await act(async () => {
				await result.current.remove(new Set(["a"]))
			})
			expect(mocks.createFileApi).not.toHaveBeenCalled()
			expect(mocks.boundIdentities).toEqual([identity])
			expect(mocks.read).not.toHaveBeenCalled()
			expect(mocks.save).not.toHaveBeenCalled()
		},
	)

	it("invalidates the old client and queued intent on a deck switch", async () => {
		const props = makeOptions()
		let resolve: (value: boolean) => void = () => undefined
		props.beforeWrite.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done
				}),
		)
		const { result, rerender } = renderHook((options) => usePPTDeckTools(options), {
			initialProps: props,
		})
		let task: Promise<void> | undefined
		act(() => {
			task = result.current.remove(new Set(["a"]))
		})
		const oldCheck = mocks.checks[0]
		rerender({ ...props, mainFileId: "next-deck" })
		expect(oldCheck()).toBe(false)
		await act(async () => {
			resolve(true)
			await task
		})
		expect(mocks.read).not.toHaveBeenCalled()
		expect(mocks.save).not.toHaveBeenCalled()
	})

	it.each(["order", "hidden"])(
		"rejects remote %s changes received during the unsaved-edit guard",
		async (change) => {
			const hidden: string[] = []
			const props = makeOptions(hidden)
			let resolve: (value: boolean) => void = () => undefined
			props.beforeWrite.mockImplementation(
				() =>
					new Promise((done) => {
						resolve = done
					}),
			)
			const { result } = renderHook(() => usePPTDeckTools(props))
			let task: Promise<void> | undefined
			act(() => {
				task = result.current.reorder(["b.html", "a.html"])
			})
			if (change === "order")
				Object.defineProperty(props.store, "slidePaths", { value: ["b.html", "a.html"] })
			else hidden.push("a.html")
			await act(async () => {
				resolve(true)
				await task
			})
			expect(mocks.read).not.toHaveBeenCalled()
			expect(mocks.save).not.toHaveBeenCalled()
			expect(mocks.toast).toHaveBeenCalledWith("ppt.batch.operationConflict")
		},
	)

	it("initializes the copy before committing one new manifest", async () => {
		const props = makeOptions()
		const { result } = renderHook(() => usePPTDeckTools(props))
		await act(async () => {
			await result.current.duplicate(new Set(["a"]))
		})
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({ parent_id: "folder", ignore_duplicate: false }),
		)
		expect(mocks.initialize).toHaveBeenCalledWith("copy", "<html>source</html>")
		expect(mocks.read).not.toHaveBeenCalledWith("copy")
		expect(mocks.save).toHaveBeenCalledTimes(1)
		expect(result.current.selected).toEqual(new Set(["copy"]))
	})

	it("does not register a copy when its body initialization fails", async () => {
		const props = makeOptions()
		const { result } = renderHook(() => usePPTDeckTools(props))
		mocks.initialize.mockRejectedValueOnce(new Error("failed"))
		await act(async () => {
			await result.current.duplicate(new Set(["a"]))
		})
		expect(mocks.save).not.toHaveBeenCalled()
		expect(mocks.addFile).not.toHaveBeenCalled()
		expect(mocks.toast).toHaveBeenCalledWith("ppt.batch.filesRetained")
	})

	it("does not apply a completed write to a different deck", async () => {
		const props = makeOptions()
		const { result, rerender } = renderHook((options) => usePPTDeckTools(options), {
			initialProps: props,
		})
		let complete: (value: { revision: number }) => void = () => undefined
		mocks.save.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					complete = resolve
				}),
		)
		let task: Promise<void> | undefined
		act(() => {
			task = result.current.remove(new Set(["a"]))
		})
		await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
		rerender({ ...props, mainFileId: "other-deck" })
		await act(async () => {
			complete({ revision: 2 })
			await task
		})
		expect(props.store.setSlides).not.toHaveBeenCalled()
	})

	it("creates the first page beside the manifest when the deck is empty", async () => {
		const props = makeOptions()
		Object.defineProperty(props.store, "slides", { value: [] })
		Object.defineProperty(props.store, "slidePaths", { value: [] })
		props.attachmentList = []
		mocks.read.mockResolvedValue({
			fileId: "manifest",
			revision: 1,
			content: JSON.stringify({ slides: [] }),
		})
		const { result } = renderHook(() => usePPTDeckTools(props))
		await act(async () => {
			await result.current.insert(0, "after")
		})
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({
				parent_id: "manifest-folder",
				file_name: "slide (1).html",
				ignore_duplicate: false,
			}),
		)
		expect(mocks.initialize).toHaveBeenCalledWith("copy", "<html>blank</html>")
		expect(mocks.save).toHaveBeenCalledWith(
			expect.anything(),
			JSON.stringify({ slides: ["slide (1).html"], hidden_slides: [] }),
		)
		expect(props.store.setActiveIndex).toHaveBeenLastCalledWith(0)
	})

	it("does not inherit a hidden page or its subdirectory for a new blank page", async () => {
		const props = makeOptions(["a.html"])
		mocks.read.mockResolvedValue({
			fileId: "manifest",
			revision: 1,
			content: JSON.stringify({ slides: ["a.html", "b.html"], hidden_slides: ["a.html"] }),
		})
		const { result } = renderHook(() => usePPTDeckTools(props))
		await act(async () => {
			await result.current.insert(0, "after")
		})
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({ parent_id: "manifest-folder" }),
		)
		expect(JSON.parse(mocks.save.mock.calls[0][1]).hidden_slides).toEqual(["a.html"])
	})
})
