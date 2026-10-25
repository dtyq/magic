import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { useCanvasCovers } from "../useCanvasCovers"

const loadState = vi.hoisted(() => ({
	calls: [] as string[],
	resolvers: new Map<string, () => void>(),
}))

vi.mock("@/pages/superMagic/services/projectAttachmentsLoader", () => ({
	loadProjectAttachments: ({ projectId }: { projectId: string }) => {
		loadState.calls.push(projectId)
		return new Promise((resolve) => {
			loadState.resolvers.set(projectId, () =>
				resolve({
					list: [
						{
							file_id: `${projectId}-img`,
							file_name: "a.png",
							file_extension: "png",
							relative_file_path: "/canvas/a.png",
						},
					],
				}),
			)
		})
	},
}))

vi.mock("@/pages/superMagic/services/useFileMediaSource", () => ({
	getFileMediaMetadata: (file: { file_id: string }) => ({ fileId: file.file_id }),
}))

function project(id: string): ProjectListItem {
	return { id, updated_at: "2026-10-21" } as ProjectListItem
}

describe("useCanvasCovers", () => {
	beforeEach(() => {
		loadState.calls.length = 0
		loadState.resolvers.clear()
	})

	it("reads covers only for cards that have been on screen", async () => {
		const projects = [project("lazy-a"), project("lazy-b")]
		const { rerender, result } = renderHook(
			({ visible }) => useCanvasCovers(projects, visible),
			{ initialProps: { visible: new Set<string>() as ReadonlySet<string> } },
		)
		expect(loadState.calls).toEqual([])

		rerender({ visible: new Set(["lazy-b"]) })
		expect(loadState.calls).toEqual(["lazy-b"])

		await act(async () => loadState.resolvers.get("lazy-b")?.())
		await waitFor(() => expect(result.current["lazy-b"]).toEqual([{ fileId: "lazy-b-img" }]))
		expect(result.current["lazy-a"]).toBeUndefined()
	})

	it("queues beyond three reads without cancelling the ones in flight", async () => {
		const ids = ["q1", "q2", "q3", "q4"]
		const projects = ids.map(project)
		const { rerender } = renderHook(({ visible }) => useCanvasCovers(projects, visible), {
			initialProps: { visible: new Set(["q1", "q2", "q3"]) as ReadonlySet<string> },
		})
		rerender({ visible: new Set(ids) })
		expect(loadState.calls).toEqual(["q1", "q2", "q3"])

		await act(async () => loadState.resolvers.get("q1")?.())
		await waitFor(() => expect(loadState.calls).toEqual(["q1", "q2", "q3", "q4"]))
	})
})
