import { createElement } from "react"
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest"
import { runInAction } from "mobx"
import { render, waitFor } from "@testing-library/react"
import { SelfMediaStore } from "../stores/SelfMediaStore"
import { SelfMediaStoreProvider } from "../stores"
import type { PlatformSlice, SelfMediaPostsService, SelfMediaSnapshot } from "../services"
import { cacheKey } from "../services"
import type { SelfMediaPost, SelfMediaPostEntry } from "../types"
import type { SelfMediaPlatform } from "../../../types"

type FakeService = SelfMediaPostsService & {
	initialize: ReturnType<typeof vi.fn>
	reconcile: ReturnType<typeof vi.fn>
	ensurePostLoaded: ReturnType<typeof vi.fn>
	ensureAllPostsLoaded: ReturnType<typeof vi.fn>
	resolveTreeContext: ReturnType<typeof vi.fn>
	dispose: ReturnType<typeof vi.fn>
}

function makeEntry(id: string): SelfMediaPostEntry {
	return { id, name: `Name ${id}`, entry: `posts/${id}/post.json` }
}

function makePost(id: string, extras: Partial<SelfMediaPost> = {}): SelfMediaPost {
	return {
		meta: { id, title: `Title ${id}` },
		cards: [],
		...extras,
	}
}

function makeSlice(platform: SelfMediaPlatform, entries: SelfMediaPostEntry[]): PlatformSlice {
	return { platform, config: { posts: entries }, postEntries: entries } as PlatformSlice
}

function buildSnapshot(
	platform: SelfMediaPlatform,
	entries: SelfMediaPostEntry[],
	cached: Record<string, SelfMediaPost> = {},
): SelfMediaSnapshot {
	return {
		slices: [makeSlice(platform, entries)],
		loadedPosts: cached,
		error: null,
		folderRelativePath: "/root/",
	}
}

function createFakeService(): FakeService {
	return {
		initialize: vi.fn(),
		reconcile: vi.fn(),
		ensurePostLoaded: vi.fn(),
		ensureAllPostsLoaded: vi.fn(async () => []),
		resolveTreeContext: vi.fn(() => ({ allFiles: [] })),
		dispose: vi.fn(),
	} as unknown as FakeService
}

// Stub attachment list – the fake service ignores its contents entirely.
const STUB_TREE = [
	{ file_id: "root", file_name: "root", is_directory: true, relative_file_path: "root/" },
] as never

describe("SelfMediaStore", () => {
	let service: FakeService
	let store: SelfMediaStore

	beforeEach(() => {
		service = createFakeService()
		store = new SelfMediaStore(service)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("sync lifecycle", () => {
		it("disposes and resets state when folderFileId is empty", async () => {
			await store.sync({ folderFileId: undefined, attachmentList: STUB_TREE })

			expect(service.dispose).toHaveBeenCalledTimes(1)
			expect(store.slices).toEqual([])
			expect(store.loadedPosts).toEqual({})
			expect(store.rootLoading).toBe(false)
			expect(store.loading).toBe(false)
			expect(store.error).toBeNull()
		})

		it("initializes on first sync and clears rootLoading after snapshot applies", async () => {
			const entry = makeEntry("p1")
			const post = makePost("p1")
			const snap = buildSnapshot("rednote", [entry], {
				[cacheKey("rednote", "p1")]: post,
			})
			service.initialize.mockResolvedValueOnce(snap)
			service.ensurePostLoaded.mockResolvedValue(post)

			await store.sync({ folderFileId: "folder-1", attachmentList: STUB_TREE })

			expect(service.initialize).toHaveBeenCalledTimes(1)
			expect(store.slices).toHaveLength(1)
			expect(store.rootLoading).toBe(false)
			expect(store.folderRelativePath).toBe("/root/")
			expect(store.loadedPosts[cacheKey("rednote", "p1")]).toEqual(post)
		})

		it("routes subsequent syncs through reconcile (silent, no rootLoading flip)", async () => {
			const entry = makeEntry("p1")
			const initialSnap = buildSnapshot("rednote", [entry], {
				[cacheKey("rednote", "p1")]: makePost("p1"),
			})
			const reconciledSnap = buildSnapshot("rednote", [entry, makeEntry("p2")], {
				[cacheKey("rednote", "p1")]: makePost("p1"),
				[cacheKey("rednote", "p2")]: makePost("p2"),
			})
			service.initialize.mockResolvedValueOnce(initialSnap)
			service.reconcile.mockResolvedValueOnce(reconciledSnap)
			service.ensurePostLoaded.mockResolvedValue(makePost("p1"))

			await store.sync({ folderFileId: "folder-1", attachmentList: STUB_TREE })
			expect(store.slices[0].postEntries).toHaveLength(1)

			await store.sync({ folderFileId: "folder-1", attachmentList: STUB_TREE })

			expect(service.reconcile).toHaveBeenCalledTimes(1)
			expect(store.slices[0].postEntries).toHaveLength(2)
			expect(store.rootLoading).toBe(false)
		})

		it("init resets navigation and re-runs initialize from last sync context", async () => {
			const entry = makeEntry("p1")
			const initialSnap = buildSnapshot("rednote", [entry], {
				[cacheKey("rednote", "p1")]: makePost("p1"),
			})
			const reconcileSnap = buildSnapshot("rednote", [entry], {
				[cacheKey("rednote", "p1")]: makePost("p1"),
			})
			service.initialize.mockResolvedValueOnce(initialSnap)
			service.ensurePostLoaded.mockResolvedValue(makePost("p1"))

			await store.sync({ folderFileId: "folder-1", attachmentList: STUB_TREE })
			service.reconcile.mockResolvedValueOnce(reconcileSnap)
			await store.sync({ folderFileId: "folder-1", attachmentList: STUB_TREE })

			expect(service.initialize).toHaveBeenCalledTimes(1)
			expect(service.reconcile).toHaveBeenCalledTimes(1)

			runInAction(() => {
				store.activePostIndex = 2
				store.activeCardIndex = 1
				store.view = "edit"
			})

			service.initialize.mockResolvedValueOnce(reconcileSnap)
			service.ensurePostLoaded.mockResolvedValue(makePost("p1"))

			await store.init()

			expect(service.initialize).toHaveBeenCalledTimes(2)
			expect(store.activePostIndex).toBe(0)
			expect(store.activeCardIndex).toBe(0)
			expect(store.view).toBe("detail")
		})

		it("init with preserveNavigation keeps indices and view (clamped)", async () => {
			const e0 = makeEntry("p0")
			const e1 = makeEntry("p1")
			const initialSnap = buildSnapshot("rednote", [e0, e1], {
				[cacheKey("rednote", "p0")]: makePost("p0"),
				[cacheKey("rednote", "p1")]: makePost("p1"),
			})
			service.initialize.mockResolvedValueOnce(initialSnap)
			service.ensurePostLoaded.mockImplementation(async (_p, _e) => makePost("p0"))

			await store.sync({ folderFileId: "folder-1", attachmentList: STUB_TREE })
			expect(service.initialize).toHaveBeenCalledTimes(1)

			runInAction(() => {
				store.activePostIndex = 1
				store.activeCardIndex = 0
				store.view = "edit"
			})

			const afterReloadSnap = buildSnapshot("rednote", [e0, e1], {
				[cacheKey("rednote", "p0")]: makePost("p0"),
				[cacheKey("rednote", "p1")]: makePost("p1"),
			})
			service.initialize.mockResolvedValueOnce(afterReloadSnap)
			service.ensurePostLoaded.mockImplementation(async () => makePost("p1"))

			await store.init({ preserveNavigation: true })

			expect(service.initialize).toHaveBeenCalledTimes(2)
			expect(store.activePostIndex).toBe(1)
			expect(store.view).toBe("edit")
		})

		it("relay-retries initialize when a prior run was cancelled", async () => {
			const entry = makeEntry("p1")
			const snap = buildSnapshot("rednote", [entry], {
				[cacheKey("rednote", "p1")]: makePost("p1"),
			})

			// First init starts but never settles until we manually resolve it;
			// a concurrent second sync bumps the token and cancels the first.
			let resolveFirst: (v: SelfMediaSnapshot) => void = () => undefined
			service.initialize.mockImplementationOnce(
				() =>
					new Promise<SelfMediaSnapshot>((resolve) => {
						resolveFirst = resolve
					}),
			)
			service.initialize.mockResolvedValueOnce(snap)
			service.ensurePostLoaded.mockResolvedValue(makePost("p1"))

			const firstSync = store.sync({ folderFileId: "folder-1", attachmentList: STUB_TREE })
			const secondSync = store.sync({ folderFileId: "folder-1", attachmentList: STUB_TREE })

			// Resolve the first (now-cancelled) call – its result must be discarded.
			resolveFirst(buildSnapshot("rednote", []))
			await firstSync
			await secondSync

			// Second call should have executed and applied the expected snapshot.
			expect(service.initialize).toHaveBeenCalledTimes(2)
			expect(store.slices[0].postEntries).toHaveLength(1)
			expect(store.rootLoading).toBe(false)
		})

		it("applies initialNavigation once to active platform and post index", async () => {
			const e0 = makeEntry("a")
			const e1 = makeEntry("b")
			const p0 = makePost("a")
			const p1 = makePost("b")
			const initialSnap = buildSnapshot("rednote", [e0, e1], {
				[cacheKey("rednote", "a")]: p0,
				[cacheKey("rednote", "b")]: p1,
			})
			service.initialize.mockResolvedValueOnce(initialSnap)
			service.ensurePostLoaded.mockResolvedValue(p0)

			await store.sync({
				folderFileId: "folder-1",
				attachmentList: STUB_TREE,
				initialNavigation: {
					activePostId: "b",
					initialView: "detail",
					activePlatform: "rednote",
				},
			})

			expect(store.activePostIndex).toBe(1)
			expect(store.view).toBe("detail")
			expect(store.activeCardIndex).toBe(0)
		})

		it("ignores initialNavigation when post id is not in the manifest (one-shot still consumed)", async () => {
			const e0 = makeEntry("a")
			const initialSnap = buildSnapshot("rednote", [e0], {
				[cacheKey("rednote", "a")]: makePost("a"),
			})
			service.initialize.mockResolvedValueOnce(initialSnap)
			service.ensurePostLoaded.mockResolvedValue(makePost("a"))

			await store.sync({
				folderFileId: "folder-1",
				attachmentList: STUB_TREE,
				initialNavigation: { activePostId: "missing", initialView: "detail" },
			})

			expect(store.activePostIndex).toBe(0)
		})

		it("does not re-apply initialNavigation on later sync", async () => {
			const e0 = makeEntry("a")
			const e1 = makeEntry("b")
			const p0 = makePost("a")
			const p1 = makePost("b")
			const initialSnap = buildSnapshot("rednote", [e0, e1], {
				[cacheKey("rednote", "a")]: p0,
				[cacheKey("rednote", "b")]: p1,
			})
			service.initialize.mockResolvedValueOnce(initialSnap)
			service.reconcile.mockResolvedValueOnce(initialSnap)
			service.ensurePostLoaded.mockImplementation(async () => p0)

			await store.sync({
				folderFileId: "folder-1",
				attachmentList: STUB_TREE,
				initialNavigation: { activePostId: "b", initialView: "detail" },
			})
			expect(store.activePostIndex).toBe(1)

			runInAction(() => {
				store.activePostIndex = 0
			})
			await store.sync({
				folderFileId: "folder-1",
				attachmentList: STUB_TREE,
				initialNavigation: { activePostId: "b", initialView: "detail" },
			})
			expect(store.activePostIndex).toBe(0)
		})

		it("re-applies a new tree-open request when the target post changes in the same folder", async () => {
			const e0 = makeEntry("a")
			const e1 = makeEntry("b")
			const initialSnap = buildSnapshot("rednote", [e0, e1], {
				[cacheKey("rednote", "a")]: makePost("a"),
				[cacheKey("rednote", "b")]: makePost("b"),
			})
			service.initialize.mockResolvedValueOnce(initialSnap)
			service.reconcile.mockResolvedValue(initialSnap)
			service.ensurePostLoaded.mockImplementation(async () => makePost("a"))

			await store.sync({
				folderFileId: "folder-1",
				attachmentList: STUB_TREE,
				initialNavigation: { activePostId: "a", initialView: "detail" },
			})
			expect(store.activePostIndex).toBe(0)

			runInAction(() => {
				store.activePostIndex = 0
			})

			await store.sync({
				folderFileId: "folder-1",
				attachmentList: STUB_TREE,
				initialNavigation: { activePostId: "b", initialView: "detail" },
			})
			expect(store.activePostIndex).toBe(1)
		})
	})

	describe("navigation actions", () => {
		it("setActivePostIndex resets activeCardIndex", () => {
			runInAction(() => {
				store.activeCardIndex = 3
			})
			store.setActivePostIndex(2)

			expect(store.activePostIndex).toBe(2)
			expect(store.activeCardIndex).toBe(0)
		})

		it("handleChangePlatform fully resets navigation", () => {
			runInAction(() => {
				store.activePlatform = "rednote"
				store.activePostIndex = 4
				store.activeCardIndex = 2
				store.view = "edit"
			})
			store.handleChangePlatform("instagram")

			expect(store.activePlatform).toBe("instagram")
			expect(store.activePostIndex).toBe(0)
			expect(store.activeCardIndex).toBe(0)
			expect(store.view).toBe("detail")
		})
	})

	describe("active post loading reaction", () => {
		it("loads the newly selected post when activePostIndex changes (uncached only)", async () => {
			const e1 = makeEntry("p1")
			const e2 = makeEntry("p2")
			const p1 = makePost("p1")
			const p2 = makePost("p2")
			service.ensurePostLoaded.mockResolvedValue(p2)

			runInAction(() => {
				store.slices = [makeSlice("rednote", [e1, e2])]
				store.loadedPosts = { [cacheKey("rednote", "p1")]: p1 }
				store.activePlatform = "rednote"
				store.rootLoading = false
				store.activePostIndex = 0
			})
			await Promise.resolve()

			service.ensurePostLoaded.mockClear()
			store.setActivePostIndex(1)
			await waitFor(() => expect(store.loadedPosts[cacheKey("rednote", "p2")]).toEqual(p2))
			expect(service.ensurePostLoaded).toHaveBeenCalledTimes(1)
		})

		it("does not refetch when switching to an already cached post", async () => {
			const e1 = makeEntry("p1")
			const e2 = makeEntry("p2")
			const p1 = makePost("p1")
			const p2 = makePost("p2")

			runInAction(() => {
				store.slices = [makeSlice("rednote", [e1, e2])]
				store.loadedPosts = {
					[cacheKey("rednote", "p1")]: p1,
					[cacheKey("rednote", "p2")]: p2,
				}
				store.activePlatform = "rednote"
				store.rootLoading = false
				store.activePostIndex = 0
			})
			await Promise.resolve()

			service.ensurePostLoaded.mockClear()
			store.setActivePostIndex(1)
			await Promise.resolve()
			await Promise.resolve()

			expect(service.ensurePostLoaded).not.toHaveBeenCalled()
			expect(store.loadedPosts[cacheKey("rednote", "p2")]).toEqual(p2)
		})
	})

	describe("ensurePostLoaded", () => {
		it("returns the cached post without hitting the service", async () => {
			const entry = makeEntry("p1")
			const post = makePost("p1")
			// Seed cache before flipping rootLoading so the internal reaction
			// short-circuits on its cached branch and never touches the service.
			runInAction(() => {
				store.slices = [makeSlice("rednote", [entry])]
				store.loadedPosts = { [cacheKey("rednote", "p1")]: post }
				store.activePlatform = "rednote"
				store.rootLoading = false
			})

			const out = await store.ensurePostLoaded(0)

			expect(out).toEqual(post)
			expect(service.ensurePostLoaded).not.toHaveBeenCalled()
		})

		it("delegates to the service when the post is not cached", async () => {
			const entry = makeEntry("p-new")
			const fresh = makePost("p-new")
			service.ensurePostLoaded.mockResolvedValue(fresh)

			runInAction(() => {
				store.slices = [makeSlice("rednote", [entry])]
				store.activePlatform = "rednote"
				store.rootLoading = false
			})
			// Let the rootLoading-driven reaction drain before the direct call.
			await Promise.resolve()

			const out = await store.ensurePostLoaded(0)

			expect(service.ensurePostLoaded).toHaveBeenCalledWith(
				expect.objectContaining({
					platform: "rednote",
					entry: expect.objectContaining({ id: "p-new" }),
				}),
			)
			expect(out).toEqual(fresh)
			expect(store.loadedPosts[cacheKey("rednote", "p-new")]).toEqual(fresh)
		})
	})

	describe("dispose", () => {
		it("is idempotent and tears down the underlying service only once", () => {
			store.dispose()
			store.dispose()

			expect(service.dispose).toHaveBeenCalledTimes(1)
		})
	})

	describe("provider integration", () => {
		it("syncs against the attachments tree even when attachmentList is also present", async () => {
			const syncSpy = vi.spyOn(SelfMediaStore.prototype, "sync").mockResolvedValue(undefined)

			const attachmentsTree = [
				{
					file_id: "folder-1",
					file_name: "root",
					is_directory: true,
					relative_file_path: "root/",
					children: [
						{
							file_id: "magic-id",
							file_name: "magic.project.js",
							is_directory: false,
							relative_file_path: "root/magic.project.js",
						},
					],
				},
			] as never
			const flatAttachmentList = [
				{
					file_id: "folder-1",
					file_name: "root",
					is_directory: true,
					relative_file_path: "root/",
				},
				{
					file_id: "magic-id",
					file_name: "magic.project.js",
					is_directory: false,
					relative_file_path: "root/magic.project.js",
				},
			] as never

			render(
				createElement(
					SelfMediaStoreProvider,
					{
						folderFileId: "folder-1",
						attachments: attachmentsTree,
						attachmentList: flatAttachmentList,
					},
					createElement("div"),
				),
			)

			await waitFor(() => expect(syncSpy).toHaveBeenCalled())
			expect(syncSpy).toHaveBeenCalledWith({
				folderFileId: "folder-1",
				attachments: attachmentsTree,
			})
		})
	})
})
