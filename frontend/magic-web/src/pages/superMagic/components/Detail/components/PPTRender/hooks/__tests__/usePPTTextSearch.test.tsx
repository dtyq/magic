import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { usePPTTextSearch, type PPTTextSearchOptions } from "../usePPTTextSearch"
import type { PPTStore } from "../../stores/PPTStore"
import { PPTFileMutationError } from "../../services/pptFileMutation"

const { fileApi } = vi.hoisted(() => ({
	fileApi: { identityKey: "session:test", getFileContentById: vi.fn() },
}))
vi.mock("@/pages/superMagic/fileAccess/fileApi", () => ({ useFileApi: () => fileApi }))
vi.mock("../../services/pptFileMutation", () => ({
	PPTFileMutationError: class extends Error {
		constructor(public readonly kind: string) {
			super(kind)
		}
	},
}))

function options(count = 2): PPTTextSearchOptions {
	const store = {
		slides: Array.from({ length: count }, (_, index) => ({ path: `${index}.html`, index })),
		getFileIdByPath: (path: string) => path.split(".")[0],
		refreshSlideByFileId: vi.fn().mockResolvedValue(undefined),
	} as unknown as PPTStore
	return {
		open: true,
		deckKey: "deck",
		store,
		selectedIds: new Set(),
		allowEdit: true,
		busy: false,
		client: {
			read: vi.fn(async (fileId: string) =>
				Object.freeze({
					fileId,
					revision: 7,
					content: "<p>needle</p><template data-magic-slide-notes>needle</template>",
				}),
			),
			save: vi.fn().mockResolvedValue({ revision: 8 }),
		},
		runWrite: vi.fn(async (operation) => operation()),
		onNavigate: vi.fn().mockResolvedValue(undefined),
	}
}

describe("usePPTTextSearch", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		fileApi.getFileContentById.mockResolvedValue("<p>needle</p>")
	})

	it("uses share-aware read access in read-only views and limits concurrent reads to three", async () => {
		const props = { ...options(4), allowEdit: false }
		const resolveReads: ((content: string) => void)[] = []
		fileApi.getFileContentById.mockImplementation(
			() => new Promise<string>((resolve) => resolveReads.push(resolve)),
		)
		const { result } = renderHook(() => usePPTTextSearch(props))
		act(() => result.current.setQuery("needle"))
		await waitFor(() => expect(fileApi.getFileContentById).toHaveBeenCalledTimes(3))
		expect(props.client.read).not.toHaveBeenCalled()
		await act(async () => resolveReads[0]("<p>needle</p>"))
		await waitFor(() => expect(fileApi.getFileContentById).toHaveBeenCalledTimes(4))
		await act(async () => resolveReads.slice(1).forEach((resolve) => resolve("<p>needle</p>")))
		await waitFor(() => expect(result.current.matches).toHaveLength(4))
		act(() => result.current.preview(true))
		expect(result.current.phase).toBe("search")
		expect(props.client.save).not.toHaveBeenCalled()
	})

	it("drops a late query response and exposes failed pages instead of reporting full-deck zero matches", async () => {
		const props = options(1)
		let resolveRead!: (value: { fileId: string; revision: number; content: string }) => void
		vi.mocked(props.client.read).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveRead = resolve
				}),
		)
		const { result } = renderHook(() => usePPTTextSearch(props))
		act(() => result.current.setQuery("needle"))
		await waitFor(() => expect(props.client.read).toHaveBeenCalledTimes(1))
		act(() => result.current.setQuery("new"))
		vi.mocked(props.client.read).mockRejectedValueOnce(new Error("secret backend detail"))
		await act(async () => resolveRead({ fileId: "0", revision: 1, content: "<p>needle</p>" }))
		await waitFor(() => expect(result.current.pages[0]?.failed).toBe(true))
		expect(result.current.matches).toHaveLength(0)
	})

	it("keeps the active hit on its file when an earlier page finishes later", async () => {
		const props = options()
		let finishFirst!: (value: { fileId: string; revision: number; content: string }) => void
		vi.mocked(props.client.read).mockImplementation(async (fileId) =>
			fileId === "0"
				? new Promise((resolve) => {
						finishFirst = resolve
					})
				: { fileId, revision: 1, content: "<p>needle</p>" },
		)
		const { result } = renderHook(() => usePPTTextSearch(props))
		act(() => result.current.setQuery("needle"))
		await waitFor(() => expect(result.current.matches).toHaveLength(1))
		await act(async () => result.current.navigate(0))
		await act(async () => finishFirst({ fileId: "0", revision: 1, content: "<p>needle</p>" }))
		expect(result.current.current?.page.fileId).toBe("1")
		expect(result.current.active).toBe(1)
	})

	it("saves the original client snapshot and only refreshes successful file identities", async () => {
		const props = options()
		const snapshots = [
			Object.freeze({ fileId: "0", revision: 7, content: "<p>needle</p>" }),
			Object.freeze({ fileId: "1", revision: 9, content: "<p>needle</p>" }),
		]
		vi.mocked(props.client.read).mockImplementation(async (fileId) => snapshots[Number(fileId)])
		vi.mocked(props.client.save)
			.mockResolvedValueOnce({ revision: 8 })
			.mockRejectedValueOnce(new PPTFileMutationError("conflict"))
		const { result } = renderHook(() => usePPTTextSearch(props))
		act(() => {
			result.current.setQuery("needle")
			result.current.setReplacement("<new>")
		})
		await waitFor(() => expect(result.current.matches).toHaveLength(2))
		act(() => result.current.preview(true))
		expect(result.current.phase).toBe("preview")
		await act(async () => result.current.confirm())
		expect(vi.mocked(props.client.save).mock.calls[0][0]).toBe(snapshots[0])
		expect(vi.mocked(props.client.save).mock.calls[0][1]).toBe("<p>&lt;new&gt;</p>")
		expect(result.current.plan.map((entry) => entry.outcome)).toEqual(["success", "conflict"])
		expect(props.store.refreshSlideByFileId).toHaveBeenCalledExactlyOnceWith("0")
	})

	it("stops all remaining writes after an unknown outcome", async () => {
		const props = options(3)
		vi.mocked(props.client.save).mockRejectedValueOnce(new PPTFileMutationError("unknown"))
		const { result } = renderHook(() => usePPTTextSearch(props))
		act(() => result.current.setQuery("needle"))
		await waitFor(() => expect(result.current.matches).toHaveLength(3))
		act(() => result.current.preview(true))
		await act(async () => result.current.confirm())
		expect(props.client.save).toHaveBeenCalledTimes(1)
		expect(result.current.plan.map((entry) => entry.outcome)).toEqual([
			"unknown",
			"cancelled",
			"cancelled",
		])
	})

	it("settles an in-flight save when cancelled but never starts the next page", async () => {
		const props = options()
		let finishSave!: (value: { revision: number }) => void
		vi.mocked(props.client.save).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishSave = resolve
				}),
		)
		const { result } = renderHook(() => usePPTTextSearch(props))
		act(() => result.current.setQuery("needle"))
		await waitFor(() => expect(result.current.matches).toHaveLength(2))
		act(() => result.current.preview(true))
		let pending!: Promise<void>
		act(() => {
			pending = result.current.confirm()
		})
		await waitFor(() => expect(props.client.save).toHaveBeenCalledTimes(1))
		act(() => result.current.cancel())
		await act(async () => {
			finishSave({ revision: 8 })
			await pending
		})
		expect(result.current.plan.map((entry) => entry.outcome)).toEqual(["success", "cancelled"])
		expect(props.client.save).toHaveBeenCalledTimes(1)
	})

	it("does not update another deck after a pending save", async () => {
		const props = options()
		let finishSave!: (value: { revision: number }) => void
		vi.mocked(props.client.save).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishSave = resolve
				}),
		)
		const { result, rerender } = renderHook((value) => usePPTTextSearch(value), {
			initialProps: props,
		})
		act(() => result.current.setQuery("needle"))
		await waitFor(() => expect(result.current.matches).toHaveLength(2))
		act(() => result.current.preview(true))
		let pending!: Promise<void>
		act(() => {
			pending = result.current.confirm()
		})
		await waitFor(() => expect(props.client.save).toHaveBeenCalledTimes(1))
		rerender({ ...props, deckKey: "other-deck" })
		await act(async () => {
			finishSave({ revision: 8 })
			await pending
		})
		expect(props.store.refreshSlideByFileId).not.toHaveBeenCalled()
		expect(props.client.save).toHaveBeenCalledTimes(1)
		expect(result.current.phase).toBe("search")
	})
})
