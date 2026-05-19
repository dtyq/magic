import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetFileContentById } = vi.hoisted(() => ({
	mockGetFileContentById: vi.fn(),
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: mockGetFileContentById,
	getTemporaryDownloadUrl: vi.fn(async () => []),
}))

import { useSelfMediaPosts } from "../hooks/useSelfMediaPosts"

const FOLDER_PATH = "self-media-folder/"
const EMPTY_ATTACHMENTS: [] = []

const rootMagicProjectContent = `
window.magicProjectConfig = {
	type: "self-media",
	"self-media": {
		rednote: {
			posts: [
				{
					id: "p1",
					name: "Post One",
					entry: "posts/post-one/post.json"
				},
				{
					id: "p2",
					name: "Post Two",
					entry: "posts/post-two/post.json"
				}
			]
		}
	}
};
window.magicProjectConfigure(window.magicProjectConfig);
`

const multiPlatformMagicProjectContent = `
window.magicProjectConfig = {
	type: "self-media",
	"self-media": {
		rednote: {
			posts: [
				{
					id: "p1",
					name: "Rednote Post One",
					entry: "posts/post-one/post.json"
				}
			]
		},
		instagram: {
			posts: [
				{
					id: "ig-1",
					name: "Instagram Reel",
					entry: "posts/instagram-reel/post.json"
				}
			]
		}
	}
};
window.magicProjectConfigure(window.magicProjectConfig);
`

const postOneContent = JSON.stringify({
	id: "p1",
	meta: {
		id: "p1",
		title: "Loaded Post One",
	},
	cards: ["cards/01.html", "cards/02.html"],
})

const postTwoContent = JSON.stringify({
	id: "p2",
	meta: {
		id: "p2",
		title: "Loaded Post Two",
	},
	cards: ["cards/01.html"],
})

const attachments = [
	{
		file_id: "folder-id",
		is_directory: true,
		file_name: "self-media-folder",
		relative_file_path: FOLDER_PATH,
		children: [
			{
				file_id: "magic-id",
				file_name: "magic.project.js",
				is_directory: false,
				relative_file_path: `${FOLDER_PATH}magic.project.js`,
			},
			{
				file_id: "post-one-folder",
				file_name: "post-one",
				is_directory: true,
				relative_file_path: `${FOLDER_PATH}posts/post-one/`,
				children: [
					{
						file_id: "post-one-json",
						file_name: "post.json",
						is_directory: false,
						relative_file_path: `${FOLDER_PATH}posts/post-one/post.json`,
					},
					{
						file_id: "post-one-card-1",
						file_name: "01.html",
						is_directory: false,
						relative_file_path: `${FOLDER_PATH}posts/post-one/cards/01.html`,
					},
					{
						file_id: "post-one-card-2",
						file_name: "02.html",
						is_directory: false,
						relative_file_path: `${FOLDER_PATH}posts/post-one/cards/02.html`,
					},
				],
			},
			{
				file_id: "post-two-folder",
				file_name: "post-two",
				is_directory: true,
				relative_file_path: `${FOLDER_PATH}posts/post-two/`,
				children: [
					{
						file_id: "post-two-json",
						file_name: "post.json",
						is_directory: false,
						relative_file_path: `${FOLDER_PATH}posts/post-two/post.json`,
					},
					{
						file_id: "post-two-card-1",
						file_name: "01.html",
						is_directory: false,
						relative_file_path: `${FOLDER_PATH}posts/post-two/cards/01.html`,
					},
				],
			},
		],
	},
]

const flatAttachmentList = [
	{
		file_id: "folder-id",
		is_directory: true,
		file_name: "self-media-folder",
		relative_file_path: FOLDER_PATH,
	},
	{
		file_id: "magic-id",
		file_name: "magic.project.js",
		is_directory: false,
		relative_file_path: `${FOLDER_PATH}magic.project.js`,
	},
	{
		file_id: "post-one-json",
		file_name: "post.json",
		is_directory: false,
		relative_file_path: `${FOLDER_PATH}posts/post-one/post.json`,
	},
	{
		file_id: "post-one-card-1",
		file_name: "01.html",
		is_directory: false,
		relative_file_path: `${FOLDER_PATH}posts/post-one/cards/01.html`,
	},
	{
		file_id: "post-one-card-2",
		file_name: "02.html",
		is_directory: false,
		relative_file_path: `${FOLDER_PATH}posts/post-one/cards/02.html`,
	},
	{
		file_id: "post-two-json",
		file_name: "post.json",
		is_directory: false,
		relative_file_path: `${FOLDER_PATH}posts/post-two/post.json`,
	},
	{
		file_id: "post-two-card-1",
		file_name: "01.html",
		is_directory: false,
		relative_file_path: `${FOLDER_PATH}posts/post-two/cards/01.html`,
	},
]

function cloneTree<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T
}

function findNode(tree: any[], fileId: string): any | null {
	const stack = [...tree]
	while (stack.length) {
		const node = stack.pop()
		if (!node) continue
		if (node.file_id === fileId) return node
		if (Array.isArray(node.children)) stack.push(...node.children)
	}
	return null
}

function updateNode(tree: any[], fileId: string, patch: Record<string, unknown>): void {
	const node = findNode(tree, fileId)
	if (node) Object.assign(node, patch)
}

/** Stamp every node in the tree with a baseline updated_at */
function stampTree<T extends { children?: any[]; updated_at?: string }>(
	tree: T[],
	stamp: string,
): T[] {
	function walk(nodes: any[]): any[] {
		return nodes.map((node) => ({
			...node,
			updated_at: node.updated_at ?? stamp,
			...(Array.isArray(node.children) ? { children: walk(node.children) } : {}),
		}))
	}
	return walk(tree) as T[]
}

describe("useSelfMediaPosts", () => {
	beforeEach(() => {
		mockGetFileContentById.mockReset()
	})

	it("returns empty state without folderFileId", async () => {
		const { result } = renderHook(() =>
			useSelfMediaPosts({ folderFileId: undefined, attachments: EMPTY_ATTACHMENTS }),
		)
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.posts).toEqual([])
	})

	it("does not stay loading when folderFileId exists but tree is empty", async () => {
		const { result } = renderHook(() =>
			useSelfMediaPosts({
				folderFileId: "folder-id",
				attachments: EMPTY_ATTACHMENTS,
			}),
		)

		await waitFor(() => expect(result.current.rootLoading).toBe(false))
		expect(result.current.loading).toBe(false)
		expect(result.current.posts).toEqual([])
		expect(result.current.postEntries).toEqual([])
		expect(mockGetFileContentById).not.toHaveBeenCalled()
	})

	it("loads only the active post from post.json on first render", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const { result } = renderHook(() =>
			useSelfMediaPosts({
				folderFileId: "folder-id",
				attachments,
				activePostIndex: 0,
			}),
		)

		await waitFor(() => expect(result.current.loading).toBe(false))

		expect(result.current.platform).toBe("rednote")
		expect(result.current.posts).toHaveLength(2)
		expect(result.current.posts[0].meta.title).toBe("Loaded Post One")
		expect(result.current.posts[0].cards.map((card) => card.fileId)).toEqual([
			"post-one-card-1",
			"post-one-card-2",
		])
		expect(result.current.posts[1].meta.title).toBe("Post Two")
		expect(result.current.posts[1].cards).toEqual([])
		expect(mockGetFileContentById).toHaveBeenCalledTimes(2)
		expect(mockGetFileContentById).toHaveBeenNthCalledWith(
			1,
			"magic-id",
			expect.objectContaining({ responseType: "text" }),
		)
		expect(mockGetFileContentById).toHaveBeenNthCalledWith(
			2,
			"post-one-json",
			expect.objectContaining({ responseType: "text" }),
		)
	})

	it("prefers the attachments tree when attachmentList is flat", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const { result } = renderHook(() =>
			useSelfMediaPosts({
				folderFileId: "folder-id",
				attachments,
				attachmentList: flatAttachmentList as any,
				activePostIndex: 0,
			}),
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.error).toBeNull()
		expect(result.current.platform).toBe("rednote")
		expect(result.current.posts[0].meta.title).toBe("Loaded Post One")
		expect(result.current.posts[0].cards.map((card) => card.fileId)).toEqual([
			"post-one-card-1",
			"post-one-card-2",
		])
	})

	it("loads a new post only after switching and reuses cached post data", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const { result, rerender } = renderHook(
			({ activePostIndex }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments,
					activePostIndex,
				}),
			{
				initialProps: { activePostIndex: 0 },
			},
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(mockGetFileContentById).toHaveBeenCalledTimes(2)

		rerender({ activePostIndex: 1 })

		await waitFor(() => expect(result.current.posts[1].meta.title).toBe("Loaded Post Two"))
		expect(result.current.posts[1].cards.map((card) => card.fileId)).toEqual([
			"post-two-card-1",
		])
		expect(mockGetFileContentById).toHaveBeenCalledTimes(3)
		expect(mockGetFileContentById).toHaveBeenLastCalledWith(
			"post-two-json",
			expect.objectContaining({ responseType: "text" }),
		)

		rerender({ activePostIndex: 0 })
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(mockGetFileContentById).toHaveBeenCalledTimes(3)
	})

	it("can preload all post manifests for export flows", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const { result } = renderHook(() =>
			useSelfMediaPosts({
				folderFileId: "folder-id",
				attachments,
				activePostIndex: 0,
			}),
		)

		await waitFor(() => expect(result.current.loading).toBe(false))

		let exportedPosts = result.current.posts
		await act(async () => {
			exportedPosts = await result.current.ensureAllPostsLoaded()
		})

		expect(exportedPosts).toHaveLength(2)
		expect(exportedPosts[1].meta.title).toBe("Loaded Post Two")
		expect(exportedPosts[1].cards.map((card) => card.fileId)).toEqual(["post-two-card-1"])
		expect(mockGetFileContentById).toHaveBeenCalledTimes(3)
	})

	it("does not reload root manifest when attachments tree identity changes only", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const { result, rerender } = renderHook(
			({ currentAttachments }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments: currentAttachments,
					activePostIndex: 0,
				}),
			{
				initialProps: { currentAttachments: attachments },
			},
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.posts[0].meta.title).toBe("Loaded Post One")
		expect(mockGetFileContentById).toHaveBeenCalledTimes(2)

		const nextAttachments = JSON.parse(JSON.stringify(attachments))
		rerender({ currentAttachments: nextAttachments })

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.posts[0].meta.title).toBe("Loaded Post One")
		expect(mockGetFileContentById).toHaveBeenCalledTimes(2)
	})

	it("reloads root manifest and evicts post cache when magic.project.js updated_at changes", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const initial = cloneTree(stampTree(attachments, "v1"))
		const { result, rerender } = renderHook(
			({ currentAttachments }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments: currentAttachments,
					activePostIndex: 0,
				}),
			{ initialProps: { currentAttachments: initial } },
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(mockGetFileContentById).toHaveBeenCalledTimes(2)

		const nextTree = cloneTree(initial)
		updateNode(nextTree, "magic-id", { updated_at: "v2" })

		rerender({ currentAttachments: nextTree })

		await waitFor(() =>
			expect(
				mockGetFileContentById.mock.calls.filter(([id]) => id === "magic-id"),
			).toHaveLength(2),
		)
		await waitFor(() => expect(result.current.posts[0].meta.title).toBe("Loaded Post One"))
		const calledIds = mockGetFileContentById.mock.calls.map(([id]) => id)
		expect(calledIds.filter((id) => id === "magic-id")).toHaveLength(2)
		expect(calledIds.filter((id) => id === "post-one-json")).toHaveLength(2)
	})

	it("refetches only the affected post when its post.json updated_at changes", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const initial = cloneTree(stampTree(attachments, "v1"))
		const { result, rerender } = renderHook(
			({ currentAttachments }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments: currentAttachments,
					activePostIndex: 0,
				}),
			{ initialProps: { currentAttachments: initial } },
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(mockGetFileContentById).toHaveBeenCalledTimes(2)

		const nextTree = cloneTree(initial)
		updateNode(nextTree, "post-one-json", { updated_at: "v2" })

		rerender({ currentAttachments: nextTree })

		await waitFor(() => expect(mockGetFileContentById).toHaveBeenCalledTimes(3))
		const calledIds = mockGetFileContentById.mock.calls.map(([id]) => id)
		expect(calledIds.filter((id) => id === "magic-id")).toHaveLength(1)
		expect(calledIds.filter((id) => id === "post-one-json")).toHaveLength(2)
		expect(calledIds.filter((id) => id === "post-two-json")).toHaveLength(0)
		expect(result.current.rootLoading).toBe(false)
		expect(result.current.loading).toBe(false)
	})

	it("bumps card.version without network when a card file updated_at changes", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const initial = cloneTree(stampTree(attachments, "v1"))
		const { result, rerender } = renderHook(
			({ currentAttachments }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments: currentAttachments,
					activePostIndex: 0,
				}),
			{ initialProps: { currentAttachments: initial } },
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.posts[0].cards[0].version).toBe("v1")
		const callsBefore = mockGetFileContentById.mock.calls.length

		const nextTree = cloneTree(initial)
		updateNode(nextTree, "post-one-card-1", { updated_at: "v2" })

		rerender({ currentAttachments: nextTree })

		await waitFor(() => expect(result.current.posts[0].cards[0].version).toBe("v2"))
		expect(result.current.posts[0].cards[0].fileId).toBe("post-one-card-1")
		expect(result.current.posts[0].cards[1].version).toBe("v1")
		expect(mockGetFileContentById.mock.calls.length).toBe(callsBefore)
		expect(result.current.rootLoading).toBe(false)
		expect(result.current.loading).toBe(false)
	})

	it("re-resolves card fileIds locally when files are added or removed", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const initial = cloneTree(stampTree(attachments, "v1"))
		const { result, rerender } = renderHook(
			({ currentAttachments }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments: currentAttachments,
					activePostIndex: 0,
				}),
			{ initialProps: { currentAttachments: initial } },
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.posts[0].cards[0].fileId).toBe("post-one-card-1")
		const callsBefore = mockGetFileContentById.mock.calls.length

		const nextTree = cloneTree(initial)
		const postOneFolder = findNode(nextTree, "post-one-folder")!
		postOneFolder.children = postOneFolder.children!.filter(
			(child: any) => child.file_id !== "post-one-card-1",
		)

		rerender({ currentAttachments: nextTree })

		await waitFor(() => expect(result.current.posts[0].cards[0].fileId).toBeUndefined())
		expect(result.current.posts[0].cards[1].fileId).toBe("post-one-card-2")
		expect(mockGetFileContentById.mock.calls.length).toBe(callsBefore)
		expect(result.current.rootLoading).toBe(false)
		expect(result.current.loading).toBe(false)
	})

	it("restores card fileId when a missing file is later added back", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const partial = cloneTree(stampTree(attachments, "v1"))
		const postOneFolder = findNode(partial, "post-one-folder")!
		const missingCard = postOneFolder.children!.find(
			(child: any) => child.file_id === "post-one-card-1",
		)
		postOneFolder.children = postOneFolder.children!.filter(
			(child: any) => child.file_id !== "post-one-card-1",
		)

		const { result, rerender } = renderHook(
			({ currentAttachments }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments: currentAttachments,
					activePostIndex: 0,
				}),
			{ initialProps: { currentAttachments: partial } },
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.posts[0].cards[0].fileId).toBeUndefined()
		const callsBefore = mockGetFileContentById.mock.calls.length

		const restored = cloneTree(partial)
		const restoredFolder = findNode(restored, "post-one-folder")!
		restoredFolder.children = [...restoredFolder.children!, cloneTree(missingCard)]

		rerender({ currentAttachments: restored })

		await waitFor(() => expect(result.current.posts[0].cards[0].fileId).toBe("post-one-card-1"))
		expect(mockGetFileContentById.mock.calls.length).toBe(callsBefore)
		expect(result.current.rootLoading).toBe(false)
		expect(result.current.loading).toBe(false)
	})

	it("keeps rootLoading and loading false during reconcile cycles", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const initial = cloneTree(stampTree(attachments, "v1"))
		const { result, rerender } = renderHook(
			({ currentAttachments }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments: currentAttachments,
					activePostIndex: 0,
				}),
			{ initialProps: { currentAttachments: initial } },
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.rootLoading).toBe(false)

		const observed: Array<{ root: boolean; loading: boolean }> = []
		const unsubscribe = () =>
			observed.push({
				root: result.current.rootLoading,
				loading: result.current.loading,
			})

		// trigger 5 rapid reconciles with different change kinds
		const after1 = cloneTree(initial)
		updateNode(after1, "post-one-card-1", { updated_at: "v2" })
		rerender({ currentAttachments: after1 })
		unsubscribe()

		const after2 = cloneTree(after1)
		updateNode(after2, "post-one-json", { updated_at: "v3" })
		rerender({ currentAttachments: after2 })
		unsubscribe()

		await waitFor(() => expect(result.current.posts[0].cards[0].version).toBe("v2"))
		unsubscribe()

		expect(observed.every((snapshot) => snapshot.root === false)).toBe(true)
		expect(observed.every((snapshot) => snapshot.loading === false)).toBe(true)
	})

	it("disposes cleanly so a subsequent mount uses a fresh cache", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			if (fileId === "post-two-json") return postTwoContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const initial = cloneTree(stampTree(attachments, "v1"))
		const { result, unmount } = renderHook(() =>
			useSelfMediaPosts({
				folderFileId: "folder-id",
				attachments: initial,
				activePostIndex: 0,
			}),
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(mockGetFileContentById).toHaveBeenCalledTimes(2)

		unmount()

		const remount = renderHook(() =>
			useSelfMediaPosts({
				folderFileId: "folder-id",
				attachments: initial,
				activePostIndex: 0,
			}),
		)

		await waitFor(() => expect(remount.result.current.loading).toBe(false))
		// A clean mount must refetch both the root manifest and the active post.
		expect(mockGetFileContentById).toHaveBeenCalledTimes(4)
	})

	it("recovers loading flags when attachments identity changes mid-initialize", async () => {
		// Delay the root manifest so we can rerender during the in-flight init.
		let resolveRoot: ((value: string) => void) | null = null
		const rootPromise = new Promise<string>((resolve) => {
			resolveRoot = resolve
		})

		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return rootPromise
			if (fileId === "post-one-json") return postOneContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const initial = cloneTree(stampTree(attachments, "v1"))
		const { result, rerender } = renderHook(
			({ currentAttachments }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments: currentAttachments,
					activePostIndex: 0,
				}),
			{ initialProps: { currentAttachments: initial } },
		)

		// Initial render kicks off initialize() which is awaiting the delayed
		// magic.project.js. Both loading flags must currently be true.
		await waitFor(() => expect(result.current.rootLoading).toBe(true))
		expect(result.current.loading).toBe(true)

		// Parent rerenders with a fresh tree reference (same data). This
		// cancels the in-flight effect and re-runs it. The previous bug:
		// the retry went through reconcile() and never cleared loading.
		const identicalTree = cloneTree(initial)
		rerender({ currentAttachments: identicalTree })

		// Release the delayed root manifest.
		await act(async () => {
			resolveRoot?.(rootMagicProjectContent)
		})

		await waitFor(() => expect(result.current.rootLoading).toBe(false))
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.error).toBeNull()
		expect(result.current.posts[0].meta.title).toBe("Loaded Post One")
	})

	it("exposes the list of declared platforms and honors the activePlatform arg", async () => {
		mockGetFileContentById.mockImplementation(async (fileId: string) => {
			if (fileId === "magic-id") return multiPlatformMagicProjectContent
			if (fileId === "post-one-json") return postOneContent
			throw new Error(`unexpected file id: ${fileId}`)
		})

		const { result, rerender } = renderHook(
			({ activePlatform }) =>
				useSelfMediaPosts({
					folderFileId: "folder-id",
					attachments,
					activePostIndex: 0,
					activePlatform,
				}),
			{ initialProps: { activePlatform: undefined as any } },
		)

		await waitFor(() => expect(result.current.platforms.length).toBe(2))
		expect(result.current.platforms).toEqual(["rednote", "instagram"])
		expect(result.current.platform).toBe("rednote")

		rerender({ activePlatform: "instagram" as any })
		await waitFor(() => expect(result.current.platform).toBe("instagram"))
		expect(result.current.postEntries.map((entry) => entry.id)).toEqual(["ig-1"])
	})
})
