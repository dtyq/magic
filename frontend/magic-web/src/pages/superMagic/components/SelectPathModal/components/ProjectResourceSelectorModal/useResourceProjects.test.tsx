import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MY_AGENTS_WORKSPACE_ID, SHARE_WORKSPACE_ID } from "../../../../constants"
import { TopicMode } from "../../../../pages/Workspace/TopicMode"
import type { Workspace } from "../../../../pages/Workspace/types"
import { useResourceProjects } from "./useResourceProjects"

const mocks = vi.hoisted(() => ({
	shared: vi.fn(),
	created: vi.fn(),
	collaborated: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: { getCollaborationProjects: mocks.shared },
	MagicClawApi: {},
}))
vi.mock("@/services/crew/CrewService", () => ({
	crewService: { getCreatedAgents: mocks.created, getCollaboratedAgents: mocks.collaborated },
}))
vi.mock("@/services/skills/SkillsService", () => ({ skillsService: {} }))
vi.mock("@/components/base/MagicToaster/utils", () => ({ default: { error: vi.fn() } }))
vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key }),
}))

function setup(workspaceId = MY_AGENTS_WORKSPACE_ID) {
	const setLoading = vi.fn()
	const setLoadError = vi.fn()
	return renderHook(() =>
		useResourceProjects({
			visible: true,
			isMentionMode: true,
			currentWorkspace: { id: workspaceId } as Workspace,
			loading: false,
			setLoading,
			setLoadError,
		}),
	)
}

function agent(id: string, userRole = "owner") {
	return { id, projectId: `project-${id}`, name: id, userRole }
}

beforeEach(() => {
	vi.resetAllMocks()
	mocks.created.mockResolvedValue({ list: [agent("mine")], total: 1 })
	mocks.collaborated.mockResolvedValue({ list: [], total: 0 })
})

describe("resource picker sources", () => {
	it("excludes both digital employee project modes from shared projects", async () => {
		mocks.shared.mockResolvedValue({
			list: [
				{ id: "general", project_mode: TopicMode.General },
				{ id: "creator", project_mode: TopicMode.AgentCreator },
				{ id: "custom", project_mode: TopicMode.CustomAgent },
				{ id: "skill", project_mode: TopicMode.SkillProjectCreator },
				{ id: "legacy" },
			],
			total: 5,
		})
		const { result } = setup(SHARE_WORKSPACE_ID)
		await act(() => result.current.fetchProjectsByWorkspace(SHARE_WORKSPACE_ID))
		expect(result.current.availableProjects.map((item) => item.id)).toEqual([
			"general",
			"skill",
			"legacy",
		])
	})

	it("loads shared projects after an entirely excluded first page", async () => {
		mocks.shared
			.mockResolvedValueOnce({
				list: Array.from({ length: 100 }, (_, id) => ({
					id: `agent-${id}`,
					project_mode: TopicMode.AgentCreator,
				})),
				total: 101,
			})
			.mockResolvedValueOnce({ list: [{ id: "shared" }], total: 101 })
		const { result } = setup(SHARE_WORKSPACE_ID)
		await act(() => result.current.fetchProjectsByWorkspace(SHARE_WORKSPACE_ID))
		expect(result.current.availableProjects).toEqual([{ id: "shared", tag: "collaboration" }])
		expect(mocks.shared).toHaveBeenCalledTimes(2)
	})

	it("separates created and editable collaborated employees while retaining project identity", async () => {
		mocks.collaborated.mockResolvedValue({
			list: [
				agent("editor", "editor"),
				agent("manager", "manage"),
				agent("reader", "viewer"),
				agent("unknown", ""),
			],
			total: 4,
		})
		const { result } = setup()
		await act(() => result.current.fetchProjectsByWorkspace(MY_AGENTS_WORKSPACE_ID, "query"))
		expect(result.current.availableProjects.map((item) => item.id)).toEqual(["project-mine"])
		act(() => result.current.changeAgentScope("collaborated"))
		await waitFor(() => expect(result.current.availableProjects).toHaveLength(2))
		expect(mocks.collaborated).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			keyword: "query",
		})
		expect(result.current.availableProjects.map((item) => item.id)).toEqual([
			"project-editor",
			"project-manager",
		])
		expect(result.current.availableProjects[0]).toMatchObject({
			resourceId: "editor",
			project_id: "project-editor",
		})
	})

	it("rejects old scope responses and restarts pagination when switching back", async () => {
		let resolveOld!: (value: { list: ReturnType<typeof agent>[]; total: number }) => void
		mocks.created.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveOld = resolve
			}),
		)
		mocks.collaborated.mockResolvedValue({ list: [agent("shared", "editor")], total: 21 })
		const { result } = setup()
		let pending!: Promise<void>
		act(() => {
			pending = result.current.fetchProjectsByWorkspace(MY_AGENTS_WORKSPACE_ID)
		})
		act(() => result.current.changeAgentScope("collaborated"))
		await waitFor(() => expect(result.current.availableProjects[0]?.id).toBe("project-shared"))
		await act(async () => {
			resolveOld({ list: [agent("stale")], total: 1 })
			await pending
		})
		expect(result.current.availableProjects[0]?.id).toBe("project-shared")
		await act(() => result.current.handleLoadMoreResourceProjects())
		expect(mocks.collaborated).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
		act(() => result.current.changeAgentScope("created"))
		await waitFor(() => expect(result.current.availableProjects[0]?.id).toBe("project-mine"))
		expect(mocks.created).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
		expect(result.current.hasMoreResourceProjects).toBe(false)
	})
})
