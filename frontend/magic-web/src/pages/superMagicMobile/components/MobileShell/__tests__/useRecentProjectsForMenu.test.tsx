import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	ProjectStatus,
	TopicMode,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { projectStore } from "@/pages/superMagic/stores/core"
import { useRecentProjectsForMenu } from "../useRecentProjectsForMenu"

const getProjectsMock = vi.fn()
const getCachedChatWorkspaceIdMock = vi.fn<() => string | null>()
const ensureChatWorkspaceIdMock = vi.fn<() => Promise<string | null>>()

const CHAT_WORKSPACE_ID = "chat-workspace-123"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getProjects: (...args: unknown[]) => getProjectsMock(...args),
	},
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	getCachedChatWorkspaceId: () => getCachedChatWorkspaceIdMock(),
	ensureChatWorkspaceId: () => ensureChatWorkspaceIdMock(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === "chat.unnamedChat") return "未命名对话"
			if (key === "project.unnamedProject") return "未命名项目"
			return key
		},
	}),
}))

describe("useRecentProjectsForMenu", () => {
	beforeEach(() => {
		projectStore.reset()
		// 默认：缓存命中，直接返回 chat workspace ID，不发起额外请求
		getCachedChatWorkspaceIdMock.mockReturnValue(CHAT_WORKSPACE_ID)
		ensureChatWorkspaceIdMock.mockResolvedValue(CHAT_WORKSPACE_ID)
		getProjectsMock.mockResolvedValue({
			list: [
				createProject({
					id: "chat-empty",
					project_mode: TopicMode.General,
					project_name: "",
					workspace_id: CHAT_WORKSPACE_ID,
				}),
				createProject({
					id: "general-empty",
					project_mode: TopicMode.General,
					project_name: "",
				}),
			],
			total: 2,
		})
	})

	afterEach(() => {
		projectStore.reset()
		vi.clearAllMocks()
	})

	it("falls back to translated names when recent project titles are empty", async () => {
		const { result } = renderHook(() => useRecentProjectsForMenu())

		await waitFor(() => {
			expect(result.current.recentItems).toHaveLength(2)
		})

		// chat workspace 下的项目用"未命名对话"，其余用"未命名项目"
		expect(result.current.recentItems[0]?.title).toBe("未命名对话")
		expect(result.current.recentItems[1]?.title).toBe("未命名项目")
	})

	it("maps inProgress from current_topic_status=running", async () => {
		getProjectsMock.mockResolvedValue({
			list: [
				createProject({
					id: "p1",
					project_mode: TopicMode.General,
					current_topic_status: "running",
				}),
				createProject({
					id: "p2",
					project_mode: TopicMode.General,
					current_topic_status: "waiting_for_user",
				}),
				createProject({
					id: "p3",
					project_mode: TopicMode.General,
					current_topic_status: "finished",
				}),
			],
			total: 3,
		})

		const { result } = renderHook(() => useRecentProjectsForMenu())
		await waitFor(() => expect(result.current.recentItems).toHaveLength(3))

		expect(result.current.recentItems[0]?.inProgress).toBe(true)
		expect(result.current.recentItems[1]?.inProgress).toBe(true)
		expect(result.current.recentItems[2]?.inProgress).toBe(false)
	})

	it("preserves API list order for recent items (no client pin reorder)", async () => {
		getProjectsMock.mockResolvedValue({
			list: [
				createProject({ id: "older", project_mode: TopicMode.General, is_pinned: true }),
				createProject({ id: "newer", project_mode: TopicMode.General, is_pinned: false }),
			],
			total: 2,
		})

		const { result } = renderHook(() => useRecentProjectsForMenu())
		await waitFor(() => expect(result.current.recentItems).toHaveLength(2))

		expect(result.current.recentItems.map((item) => item.id)).toEqual(["older", "newer"])
	})

	it("maps isShared: only when tag=collaboration AND user is owner (isSelfCollaborationProject)", async () => {
		getProjectsMock.mockResolvedValue({
			list: [
				// 自己创建的协作项目 → isShared=true
				createProject({
					id: "own-collab",
					project_mode: TopicMode.General,
					tag: "collaboration",
					user_role: "owner",
				}),
				// 加入别人的协作项目（非owner）→ isShared=false
				createProject({
					id: "joined-collab",
					project_mode: TopicMode.General,
					tag: "collaboration",
					user_role: "editor",
				}),
				// 普通项目 → isShared=false
				createProject({ id: "plain", project_mode: TopicMode.General, tag: "" }),
			],
			total: 3,
		})

		const { result } = renderHook(() => useRecentProjectsForMenu())
		await waitFor(() => expect(result.current.recentItems).toHaveLength(3))

		expect(result.current.recentItems[0]?.isShared).toBe(true)
		expect(result.current.recentItems[1]?.isShared).toBe(false)
		expect(result.current.recentItems[2]?.isShared).toBe(false)
	})

	it("maps isChatProject: true when workspace_id matches chat workspace ID, regardless of project_mode", async () => {
		getProjectsMock.mockResolvedValue({
			list: [
				// chat workspace 下的对话项目（project_mode 为 General，与实际创建逻辑一致）
				createProject({
					id: "chat-general",
					project_mode: TopicMode.General,
					workspace_id: CHAT_WORKSPACE_ID,
				}),
				// chat workspace 下的对话项目（project_mode 为 Chat）
				createProject({
					id: "chat-mode",
					project_mode: TopicMode.Chat,
					workspace_id: CHAT_WORKSPACE_ID,
				}),
				// 普通工作区项目 → isChatProject=false
				createProject({ id: "regular", project_mode: TopicMode.General }),
			],
			total: 3,
		})

		const { result } = renderHook(() => useRecentProjectsForMenu())
		await waitFor(() => expect(result.current.recentItems).toHaveLength(3))

		expect(result.current.recentItems[0]?.isChatProject).toBe(true)
		expect(result.current.recentItems[1]?.isChatProject).toBe(true)
		expect(result.current.recentItems[2]?.isChatProject).toBe(false)
	})

	it("maps isLinked: when non-owner with collab tag OR is_bind_workspace (isWorkspaceShortcutProject)", async () => {
		getProjectsMock.mockResolvedValue({
			list: [
				// 加入别人的协作项目（非owner）→ isLinked=true
				createProject({
					id: "joined-collab",
					project_mode: TopicMode.General,
					tag: "collaboration",
					user_role: "editor",
				}),
				// 关联工作区项目（非owner）→ isLinked=true
				createProject({
					id: "bind-ws",
					project_mode: TopicMode.General,
					tag: "",
					is_bind_workspace: true,
					user_role: "editor",
				}),
				// 自己创建的协作项目（owner）→ isLinked=false
				createProject({
					id: "own-collab",
					project_mode: TopicMode.General,
					tag: "collaboration",
					user_role: "owner",
				}),
				// 普通项目 → isLinked=false
				createProject({ id: "plain", project_mode: TopicMode.General, tag: "" }),
			],
			total: 4,
		})

		const { result } = renderHook(() => useRecentProjectsForMenu())
		await waitFor(() => expect(result.current.recentItems).toHaveLength(4))

		expect(result.current.recentItems[0]?.isLinked).toBe(true)
		expect(result.current.recentItems[1]?.isLinked).toBe(true)
		expect(result.current.recentItems[2]?.isLinked).toBe(false)
		expect(result.current.recentItems[3]?.isLinked).toBe(false)
	})

	it("requests recent projects from queries API ordered by updated_at desc", async () => {
		renderHook(() => useRecentProjectsForMenu())

		await waitFor(() => {
			expect(getProjectsMock).toHaveBeenCalled()
		})

		expect(getProjectsMock).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			order_by: "updated_at",
			sort: "desc",
		})
	})

	it("sets hasMore when total exceeds the first page size", async () => {
		getProjectsMock.mockResolvedValue({
			list: Array.from({ length: 20 }, (_, index) =>
				createProject({
					id: `page1-${index}`,
					project_mode: TopicMode.General,
				}),
			),
			total: 25,
		})

		const { result } = renderHook(() => useRecentProjectsForMenu())

		await waitFor(() => {
			expect(result.current.recentItems).toHaveLength(20)
		})

		expect(result.current.hasMore).toBe(true)
	})

	it("loadMoreRecentItems appends page 2 without duplicate ids", async () => {
		const page1Projects = Array.from({ length: 20 }, (_, index) =>
			createProject({
				id: `page1-${index}`,
				project_mode: TopicMode.General,
			}),
		)
		const page2Projects = Array.from({ length: 5 }, (_, index) =>
			createProject({
				id: `page2-${index}`,
				project_mode: TopicMode.General,
			}),
		)

		getProjectsMock.mockImplementation(({ page }: { page: number }) => {
			if (page === 1) {
				return Promise.resolve({ list: page1Projects, total: 25 })
			}
			if (page === 2) {
				return Promise.resolve({ list: page2Projects, total: 25 })
			}
			return Promise.resolve({ list: [], total: 25 })
		})

		const { result } = renderHook(() => useRecentProjectsForMenu())

		await waitFor(() => {
			expect(result.current.recentItems).toHaveLength(20)
		})

		await act(async () => {
			await result.current.loadMoreRecentItems()
		})

		await waitFor(() => {
			expect(result.current.recentItems).toHaveLength(25)
		})

		expect(getProjectsMock).toHaveBeenCalledWith({
			page: 2,
			page_size: 20,
			order_by: "updated_at",
			sort: "desc",
		})

		const ids = result.current.recentItems.map((item) => item.id)
		expect(new Set(ids).size).toBe(ids.length)
		expect(result.current.hasMore).toBe(false)
	})

	it("reloadRecentItems resets pagination to page 1", async () => {
		getProjectsMock
			.mockResolvedValueOnce({
				list: Array.from({ length: 20 }, (_, index) =>
					createProject({
						id: `page1-${index}`,
						project_mode: TopicMode.General,
					}),
				),
				total: 25,
			})
			.mockResolvedValueOnce({
				list: Array.from({ length: 5 }, (_, index) =>
					createProject({
						id: `page2-${index}`,
						project_mode: TopicMode.General,
					}),
				),
				total: 25,
			})
			.mockResolvedValueOnce({
				list: [
					createProject({ id: "refreshed-1", project_mode: TopicMode.General }),
					createProject({ id: "refreshed-2", project_mode: TopicMode.General }),
				],
				total: 2,
			})

		const { result } = renderHook(() => useRecentProjectsForMenu())

		await waitFor(() => {
			expect(result.current.recentItems).toHaveLength(20)
		})

		await act(async () => {
			await result.current.loadMoreRecentItems()
		})

		await waitFor(() => {
			expect(result.current.recentItems).toHaveLength(25)
		})

		await act(async () => {
			await result.current.reloadRecentItems()
		})

		await waitFor(() => {
			expect(result.current.recentItems).toHaveLength(2)
		})

		expect(result.current.recentItems[0]?.id).toBe("refreshed-1")
		expect(result.current.hasMore).toBe(false)
		expect(getProjectsMock).toHaveBeenLastCalledWith({
			page: 1,
			page_size: 20,
			order_by: "updated_at",
			sort: "desc",
		})
	})
})

/**
 * 测试数据保留最小真实结构，避免最近项目映射逻辑依赖不存在的字段。
 */
function createProject(
	overrides: Partial<ProjectListItem> & Pick<ProjectListItem, "id" | "project_mode">,
): ProjectListItem {
	return {
		id: overrides.id,
		project_status: ProjectStatus.WAITING,
		project_mode: overrides.project_mode,
		workspace_id: "workspace-1",
		work_dir: "",
		workspace_name: "Workspace",
		project_name: overrides.project_name ?? "Project",
		current_topic_id: "",
		current_topic_status: "",
		created_at: "2026-04-27 12:00:00",
		updated_at: "2026-04-27 12:01:00",
		last_active_at: "2026-04-27 12:01:00",
		tag: "",
		...overrides,
	}
}
