import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	ProjectStatus,
	TopicMode,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { useChatConversationList } from "../useChatConversationList"

const refreshChatProjectsMock = vi.fn()
const loadMoreChatProjectsMock = vi.fn()
const useChatWorkspaceMock = vi.fn()

let chatProjectsMock: ProjectListItem[] = []

function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: overrides.id ?? "project-1",
		project_status: overrides.project_status ?? ProjectStatus.WAITING,
		project_mode: overrides.project_mode ?? TopicMode.Chat,
		workspace_id: overrides.workspace_id ?? "chat-workspace-1",
		work_dir: overrides.work_dir ?? "",
		workspace_name: overrides.workspace_name ?? "Chat",
		project_name: overrides.project_name ?? "Alpha",
		current_topic_id: overrides.current_topic_id ?? "",
		current_topic_status: overrides.current_topic_status ?? "",
		created_at: overrides.created_at ?? "2026-04-27 10:00:00",
		updated_at: overrides.updated_at ?? "2026-04-27 10:05:00",
		last_active_at: overrides.last_active_at ?? "2026-04-27 10:05:00",
		tag: overrides.tag ?? "",
		...overrides,
	}
}

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
	useTranslation: () => ({
		t: (key: string, params?: { count?: number }) => {
			if (key === "super:chatList.minutesAgo") return `${params?.count ?? 0} minutes ago`
			if (key === "common:format.yesterday") return "Yesterday"
			if (key === "super:chat.unnamedChat") return "Unnamed Chat"
			return key
		},
		i18n: { language: "en_US" },
	}),
}))

vi.mock("@/providers/TimezoneProvider/hooks", () => ({
	useTimezone: () => ({
		timezone: "UTC",
	}),
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	useChatWorkspace: (options: unknown) => {
		useChatWorkspaceMock(options)
		return {
			chatProjects: chatProjectsMock,
			chatProjectsTotal: chatProjectsMock.length,
			isLoadingChatProjects: false,
			refreshChatProjects: refreshChatProjectsMock,
			loadMoreChatProjects: loadMoreChatProjectsMock,
		}
	},
}))

describe("useChatConversationList", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		chatProjectsMock = [createProject()]
		refreshChatProjectsMock.mockResolvedValue(chatProjectsMock)
		loadMoreChatProjectsMock.mockResolvedValue(chatProjectsMock)
		useChatWorkspaceMock.mockClear()
	})

	afterEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
	})

	it("uses server-side search instead of local filtering", async () => {
		const { result } = renderHook(() => useChatConversationList())

		expect(useChatWorkspaceMock).toHaveBeenCalledWith({
			projectsEnabled: true,
			projectPageSize: 100,
			projectKeyword: "",
		})

		act(() => {
			result.current.setSearchValue("server-side")
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(250)
		})

		expect(useChatWorkspaceMock).toHaveBeenLastCalledWith({
			projectsEnabled: true,
			projectPageSize: 100,
			projectKeyword: "server-side",
		})

		expect(result.current.items).toHaveLength(1)
		expect(result.current.items[0]?.title).toBe("Alpha")
		expect(result.current.items[0]?.isRunning).toBe(false)
	})

	it("keeps optimistic remove until server list no longer contains the id", async () => {
		chatProjectsMock = [
			createProject({ id: "project-a" }),
			createProject({ id: "project-b", project_name: "Beta" }),
		]
		refreshChatProjectsMock.mockResolvedValueOnce(chatProjectsMock)

		const { result } = renderHook(() => useChatConversationList())

		act(() => {
			result.current.optimisticRemove("project-a")
		})

		expect(result.current.items.map((item) => item.id)).toEqual(["project-b"])

		refreshChatProjectsMock.mockResolvedValueOnce([
			createProject({ id: "project-a" }),
			createProject({ id: "project-b", project_name: "Beta" }),
		])

		await act(async () => {
			await result.current.reload()
		})

		expect(result.current.items.map((item) => item.id)).toEqual(["project-b"])

		refreshChatProjectsMock.mockResolvedValueOnce([
			createProject({ id: "project-b", project_name: "Beta" }),
		])

		await act(async () => {
			await result.current.reload()
		})

		expect(result.current.items.map((item) => item.id)).toEqual(["project-b"])
	})

	it("passes silent:true to refreshChatProjects when reload is called with silent option", async () => {
		const { result } = renderHook(() => useChatConversationList())

		await act(async () => {
			await result.current.reload({ silent: true })
		})

		expect(refreshChatProjectsMock).toHaveBeenCalledWith({
			pageSize: 100,
			keyword: "",
			silent: true,
		})
	})

	it("maps running-like project statuses to isRunning", () => {
		chatProjectsMock = [
			createProject({ id: "topic-running", current_topic_status: "running" }),
			createProject({ id: "waiting-user", current_topic_status: "waiting_for_user" }),
			createProject({ id: "project-running", project_status: ProjectStatus.RUNNING }),
			createProject({ id: "finished-project", project_status: ProjectStatus.FINISHED }),
		]

		const { result } = renderHook(() => useChatConversationList())

		expect(result.current.items.map((item) => [item.id, item.isRunning])).toEqual([
			["topic-running", true],
			["waiting-user", true],
			["project-running", true],
			["finished-project", false],
		])
	})
})
