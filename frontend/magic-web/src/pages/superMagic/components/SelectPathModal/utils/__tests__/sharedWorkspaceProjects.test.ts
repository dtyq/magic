import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "../../../../pages/Workspace/TopicMode"
import { loadSharedWorkspaceProjects } from "../sharedWorkspaceProjects"

const { getProjects } = vi.hoisted(() => ({ getProjects: vi.fn() }))
vi.mock("@/apis", () => ({ SuperMagicApi: { getCollaborationProjects: getProjects } }))

beforeEach(() => vi.resetAllMocks())

describe("loadSharedWorkspaceProjects", () => {
	it("reads beyond an entirely excluded page and counts unique shared projects", async () => {
		getProjects
			.mockResolvedValueOnce({
				list: Array.from({ length: 100 }, (_, id) => ({
					id: `agent-${id}`,
					project_mode: TopicMode.AgentCreator,
				})),
				total: 104,
			})
			.mockResolvedValueOnce({
				list: [
					{ id: "shared", project_mode: TopicMode.General },
					{ id: "custom", project_mode: TopicMode.CustomAgent },
					{ id: "shared", project_mode: TopicMode.General },
					{ id: "legacy" },
				],
				total: 104,
			})
		const projects = await loadSharedWorkspaceProjects()
		expect(projects.map((project) => project.id)).toEqual(["shared", "legacy"])
		expect(projects).toHaveLength(2)
		expect(getProjects).toHaveBeenCalledTimes(2)
		expect(getProjects).toHaveBeenLastCalledWith(
			{ page: 2, page_size: 100 },
			{ signal: undefined },
		)
	})

	it("uses the raw count even when the server returns fewer items than requested", async () => {
		getProjects
			.mockResolvedValueOnce({
				list: [{ id: "agent", project_mode: TopicMode.AgentCreator }],
				total: 2,
			})
			.mockResolvedValueOnce({ list: [{ id: "shared" }], total: 2 })
		expect(await loadSharedWorkspaceProjects()).toEqual([{ id: "shared" }])
		expect(getProjects).toHaveBeenCalledTimes(2)
	})

	it("stops on an empty raw page when total is stale", async () => {
		getProjects.mockResolvedValue({ list: [], total: 200 })
		expect(await loadSharedWorkspaceProjects()).toEqual([])
		expect(getProjects).toHaveBeenCalledTimes(1)
	})

	it("does not publish a partial list or count when a later page fails", async () => {
		getProjects
			.mockResolvedValueOnce({ list: [{ id: "shared" }], total: 2 })
			.mockRejectedValueOnce(new Error("page failed"))
		await expect(loadSharedWorkspaceProjects()).rejects.toThrow("page failed")
	})

	it("does not fetch another page after cancellation", async () => {
		const request = new AbortController()
		getProjects.mockImplementationOnce(async () => {
			request.abort()
			return { list: [{ id: "shared" }], total: 200 }
		})
		await expect(loadSharedWorkspaceProjects({ signal: request.signal })).rejects.toMatchObject(
			{
				name: "AbortError",
			},
		)
		expect(getProjects).toHaveBeenCalledTimes(1)
		expect(getProjects).toHaveBeenCalledWith(
			{ page: 1, page_size: 100 },
			{ signal: request.signal },
		)
	})
})
