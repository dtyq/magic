import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useTaskWorkspaceOptions } from "../useTaskWorkspaceOptions"

const list = vi.hoisted(() => vi.fn())
vi.mock("@/apis", () => ({ SuperMagicApi: { getWorkspaces: list } }))
vi.mock("../useTaskHomeContext", () => ({
	isTaskWorkspace: (item: { workspace_type: string }) => item.workspace_type === "default",
}))
const workspace = (id: string) => ({ id, name: id, workspace_type: "default" })

describe("mobile workspace search", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})
	it("loads further pages and searches all server workspaces", async () => {
		list.mockResolvedValueOnce({ list: [workspace("first")], total: 51 })
			.mockResolvedValueOnce({ list: [workspace("last")], total: 51 })
			.mockResolvedValueOnce({ list: [workspace("matching")], total: 1 })
		const { result } = renderHook(() => useTaskWorkspaceOptions(true))
		await waitFor(() => expect(result.current.hasMore).toBe(true))
		await act(async () => result.current.loadMore())
		expect(result.current.items.map((item) => item.id)).toEqual(["first", "last"])
		expect(result.current.hasMore).toBe(false)
		act(() => result.current.setSearch("matching"))
		await waitFor(() =>
			expect(result.current.items.map((item) => item.id)).toEqual(["matching"]),
		)
		expect(list).toHaveBeenLastCalledWith(
			expect.objectContaining({ page: 1, workspace_name: "matching" }),
		)
	})

	it("does not replace newer search results with an older request", async () => {
		let finish!: (value: unknown) => void
		list.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve
			}),
		).mockResolvedValueOnce({ list: [workspace("matching")], total: 1 })
		const { result } = renderHook(() => useTaskWorkspaceOptions(true))
		act(() => result.current.setSearch("matching"))
		await waitFor(() => expect(result.current.items[0]?.id).toBe("matching"))
		await act(async () => finish({ list: [workspace("old")], total: 1 }))
		expect(result.current.items[0]?.id).toBe("matching")
	})
})
