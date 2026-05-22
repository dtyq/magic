import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	WorkspaceStatus,
	ProjectStatus,
	TopicMode,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { userStore } from "@/models/user"
import projectStore from "@/pages/superMagic/stores/core/project"
import { ChatWorkspaceIdCache } from "@/pages/superMagic/utils/superMagicCache"
import { getCachedChatWorkspaceId, useChatWorkspace } from "../useChatWorkspace"

const getChatWorkspaceMock = vi.fn()
const getProjectsMock = vi.fn()

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getChatWorkspace: (...args: unknown[]) => getChatWorkspaceMock(...args),
		getProjects: (...args: unknown[]) => getProjectsMock(...args),
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		project: {
			createProject: vi.fn(),
		},
	},
}))

const CHAT_WORKSPACE = {
	id: "chat-workspace-1",
	name: "Chat",
	is_archived: 0,
	current_topic_id: "",
	current_project_id: null,
	workspace_status: WorkspaceStatus.WAITING,
	project_count: 0,
	workspace_type: "chat" as const,
}

const CHAT_PROJECTS: ProjectListItem[] = [
	{
		id: "project-1",
		project_status: ProjectStatus.WAITING,
		project_mode: TopicMode.Chat,
		workspace_id: CHAT_WORKSPACE.id,
		work_dir: "",
		workspace_name: "Chat",
		project_name: "Server Search Result",
		current_topic_id: "",
		current_topic_status: "",
		created_at: "2026-04-27 10:00:00",
		updated_at: "2026-04-27 10:05:00",
		last_active_at: "2026-04-27 10:05:00",
		tag: "",
	},
]

describe("useChatWorkspace", () => {
	beforeEach(() => {
		projectStore.reset()
		getChatWorkspaceMock.mockResolvedValue(CHAT_WORKSPACE)
		getProjectsMock.mockResolvedValue({
			list: CHAT_PROJECTS,
			total: CHAT_PROJECTS.length,
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
		projectStore.reset()
		ChatWorkspaceIdCache.clear(userStore.user.userInfo)
	})

	it("loads chat projects with workspace_id and project_name from queries api", async () => {
		const { result } = renderHook(() => useChatWorkspace())

		await waitFor(() => {
			expect(result.current.chatWorkspace?.id).toBe(CHAT_WORKSPACE.id)
		})

		await act(async () => {
			await result.current.refreshChatProjects({
				pageSize: 20,
				keyword: "server keyword",
			})
		})

		expect(getProjectsMock).toHaveBeenCalledWith({
			workspace_id: CHAT_WORKSPACE.id,
			project_name: "server keyword",
			page: 1,
			page_size: 20,
		})
		expect(result.current.chatProjects).toEqual(CHAT_PROJECTS)
		expect(ChatWorkspaceIdCache.get(userStore.user.userInfo)).toBe(CHAT_WORKSPACE.id)
	})

	it("reads cached chat workspace id from sessionStorage without requiring a fresh request", () => {
		ChatWorkspaceIdCache.set(userStore.user.userInfo, CHAT_WORKSPACE.id)

		expect(getCachedChatWorkspaceId()).toBe(CHAT_WORKSPACE.id)
	})

	it("does not toggle isLoadingChatProjects during silent refresh", async () => {
		const { result } = renderHook(() => useChatWorkspace({ projectsEnabled: true }))

		await waitFor(() => {
			expect(result.current.isLoadingChatProjects).toBe(false)
			expect(result.current.chatProjects.length).toBeGreaterThan(0)
		})

		const loadingStatesDuringFetch: boolean[] = []
		getProjectsMock.mockImplementation(async () => {
			loadingStatesDuringFetch.push(result.current.isLoadingChatProjects)
			return {
				list: CHAT_PROJECTS,
				total: CHAT_PROJECTS.length,
			}
		})

		await act(async () => {
			await result.current.refreshChatProjects({ silent: true })
		})

		expect(loadingStatesDuringFetch.every((isLoading) => !isLoading)).toBe(true)
		expect(result.current.isLoadingChatProjects).toBe(false)
	})
})
