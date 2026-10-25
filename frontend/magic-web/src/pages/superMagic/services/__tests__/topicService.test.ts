import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { interfaceStore } from "@/stores/interface"
import { platformKey } from "@/utils/storage"
import TopicService from "../topicService"

const defaultSelectionState = vi.hoisted(() => ({
	selection: {
		modeIdentifier: "general" as TopicMode,
		topicPattern: "general" as TopicMode,
		agentCode: undefined as string | undefined,
	},
}))

const modeServiceMock = vi.hoisted(() => ({
	isModeValid: vi.fn(() => true),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createTopic: vi.fn(),
		getTopicsByProjectId: vi.fn(),
		getSidebarTopicsByProjectId: vi.fn(),
		getTopicDetail: vi.fn(),
	},
}))

const trackMock = vi.hoisted(() => vi.fn())
vi.mock("@/services/analytics", () => ({
	analyticsService: { report: trackMock },
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "org-1",
			userInfo: {
				user_id: "user-1",
			},
		},
	},
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: {
		isMobile: false,
	},
}))

vi.mock("@/services/superMagic/DefaultAgentSelectionService", () => ({
	resolveDefaultAgentSelection: () => defaultSelectionState.selection,
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		isModeValid: modeServiceMock.isModeValid,
	},
}))

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: "topic-1",
		user_id: "user-1",
		chat_topic_id: "chat-topic-1",
		chat_conversation_id: "conversation-1",
		topic_name: "Topic",
		task_status: TaskStatus.FINISHED,
		status: TaskStatus.FINISHED,
		task_mode: "chat",
		project_id: "project-1",
		topic_mode: TopicMode.General,
		updated_at: "2026-04-08T00:00:00Z",
		workspace_id: "workspace-1",
		is_pinned: false,
		pinned_at: null,
		is_archived: false,
		last_read_at: null,
		last_read_message_id: null,
		has_unread: false,
		token_used: null,
		...overrides,
	}
}

function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: "project-1",
		project_name: "Project",
		workspace_id: "workspace-1",
		workspace_name: "Workspace",
		...overrides,
	} as ProjectListItem
}

function createEmptyModeTopic(id: string, topicName: string): Topic {
	return {
		...createTopic({ id, topic_name: topicName }),
		topic_mode: TopicMode.Empty,
	}
}

describe("TopicService interface-aware topic source", () => {
	let topicService: TopicService
	let topicStore: TopicStore

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
		window.sessionStorage.clear()
		topicStore = new TopicStore()
		topicService = new TopicService({ store: topicStore })
		interfaceStore.isMobile = false
		defaultSelectionState.selection = {
			modeIdentifier: TopicMode.General,
			topicPattern: TopicMode.General,
			agentCode: undefined,
		}
	})

	it("uses sidebar-topics for mobile fetchTopics", async () => {
		vi.mocked(SuperMagicApi.getSidebarTopicsByProjectId).mockResolvedValue({
			list: [createTopic({ id: "topic-sidebar" })],
			total: 1,
		})

		interfaceStore.isMobile = true
		await topicService.fetchTopics({ projectId: "project-1", isAutoSelect: false })

		expect(SuperMagicApi.getSidebarTopicsByProjectId).toHaveBeenCalledWith({
			id: "project-1",
			page: 1,
			page_size: 100,
			q: undefined,
		})
		expect(SuperMagicApi.getTopicsByProjectId).not.toHaveBeenCalled()
	})

	it("keeps desktop fetchTopics on the legacy project topics api", async () => {
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [createTopic({ id: "topic-desktop" })],
			total: 1,
		})

		await topicService.fetchTopics({ projectId: "project-1", isAutoSelect: false })

		expect(SuperMagicApi.getTopicsByProjectId).toHaveBeenCalledWith({
			id: "project-1",
			page: 1,
			page_size: 99,
		})
		expect(SuperMagicApi.getSidebarTopicsByProjectId).not.toHaveBeenCalled()
	})

	it("uses sidebar-topics after mobile createTopic to refresh project topics", async () => {
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(createTopic({ id: "topic-new" }))
		vi.mocked(SuperMagicApi.getSidebarTopicsByProjectId).mockResolvedValue({
			list: [createTopic({ id: "topic-new" })],
			total: 1,
		})

		interfaceStore.isMobile = true
		await topicService.createTopic({ projectId: "project-1", topicName: "" })

		expect(SuperMagicApi.getSidebarTopicsByProjectId).toHaveBeenCalledWith({
			id: "project-1",
			page: 1,
			page_size: 100,
			q: undefined,
		})
		expect(topicStore.topics[0]?.id).toBe("topic-new")
	})

	it("uses sidebar-topics when mobile selects project topics", async () => {
		vi.mocked(SuperMagicApi.getSidebarTopicsByProjectId).mockResolvedValue({
			list: [createTopic({ id: "topic-selected" })],
			total: 1,
		})

		interfaceStore.isMobile = true
		await topicService.selectTopicWithProject(createProject(), "project-topic-map")

		expect(SuperMagicApi.getSidebarTopicsByProjectId).toHaveBeenCalledWith({
			id: "project-1",
			page: 1,
			page_size: 100,
			q: undefined,
		})
		expect(topicStore.selectedTopic?.id).toBe("topic-selected")
	})
})

describe("TopicService frontend mode patch", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
		window.sessionStorage.clear()
		interfaceStore.isMobile = false
		modeServiceMock.isModeValid.mockReturnValue(true)
		defaultSelectionState.selection = {
			modeIdentifier: TopicMode.General,
			topicPattern: TopicMode.General,
			agentCode: undefined,
		}
	})

	it("creates an empty backend topic and keeps the previous employee selection in frontend state", async () => {
		const sourceTopic = createTopic({
			id: "topic-1",
			topic_name: "Existing Topic",
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		const setTopics = vi.fn()
		const setSelectedTopic = vi.fn()
		const service = new TopicService({
			store: {
				setTopics,
				setSelectedTopic,
			} as never,
		})

		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(newTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [newTopic, sourceTopic],
			total: 2,
		})

		await service.createTopic({
			projectId: "project-1",
			topicName: "",
			sourceTopic,
		})

		expect(SuperMagicApi.createTopic).toHaveBeenCalledWith({
			project_id: "project-1",
			topic_name: "",
		})
		expect(setSelectedTopic).toHaveBeenCalledWith({
			...newTopic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		expect(setTopics).toHaveBeenCalledWith([
			{
				...newTopic,
				topic_mode: TopicMode.CustomAgent,
				agent_code: "employee-code-1",
			},
			sourceTopic,
		])
	})

	it("preserves inherited employee selection when the created topic is reloaded by id", async () => {
		const sourceTopic = createTopic({
			id: "topic-1",
			topic_name: "Existing Topic",
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})

		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(newTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [newTopic],
			total: 1,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(newTopic)

		await service.createTopic({
			projectId: "project-1",
			topicName: "",
			sourceTopic,
		})

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual({
			...newTopic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
	})

	it("preserves inherited employee selection in the sidebar topic list", async () => {
		const sourceTopic = createTopic({
			id: "topic-1",
			topic_name: "Existing Topic",
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})

		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(newTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [newTopic],
			total: 1,
		})
		vi.mocked(SuperMagicApi.getSidebarTopicsByProjectId).mockResolvedValue({
			list: [newTopic],
			total: 1,
		})

		await service.createTopic({
			projectId: "project-1",
			topicName: "",
			sourceTopic,
		})

		await expect(
			service.getSidebarTopicsByProjectId({
				projectId: "project-1",
				page: 1,
				pageSize: 20,
			}),
		).resolves.toEqual({
			list: [
				{
					...newTopic,
					status: TaskStatus.FINISHED,
					is_pinned: false,
					is_archived: false,
					has_unread: false,
					pinned_at: null,
					last_read_at: null,
					last_read_message_id: null,
					topic_mode: TopicMode.CustomAgent,
					agent_code: "employee-code-1",
				},
			],
			total: 1,
		})
	})

	it("keeps backend employee selection when the reloaded topic already has an agent code", async () => {
		const sourceTopic = createTopic({
			id: "topic-1",
			topic_name: "Existing Topic",
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		const backendTopic = createTopic({
			...newTopic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: "backend-employee-code",
		})
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})

		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(newTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [newTopic],
			total: 1,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(backendTopic)

		await service.createTopic({
			projectId: "project-1",
			topicName: "",
			sourceTopic,
		})

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual(backendTopic)
	})

	it("keeps backend built-in topic mode even when updated_at has not advanced past the patch", async () => {
		const storageKey = platformKey("super_magic/topic_frontend_mode_patch/org-1/user-1")
		const sourceTopic = createTopic({
			id: "topic-1",
			topic_name: "Existing Topic",
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		const emptyNewTopic = createEmptyModeTopic("topic-2", "New Topic")
		const backendTopic = createTopic({ id: "topic-2", topic_name: "New Topic" })
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})

		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(emptyNewTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [emptyNewTopic],
			total: 1,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(backendTopic)

		await service.createTopic({
			projectId: "project-1",
			topicName: "",
			sourceTopic,
		})

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual(backendTopic)
		expect(window.sessionStorage.getItem(storageKey)).toBe("{}")
	})

	it("restores inherited employee selection from session storage after service recreation", async () => {
		const sourceTopic = createTopic({
			id: "topic-1",
			topic_name: "Existing Topic",
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})

		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(newTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [newTopic],
			total: 1,
		})

		await service.createTopic({
			projectId: "project-1",
			topicName: "",
			sourceTopic,
		})

		const recreatedService = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(newTopic)

		await expect(recreatedService.getTopicDetail("topic-2")).resolves.toEqual({
			...newTopic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
	})

	it("does not restore expired inherited employee selection from session storage", async () => {
		const storageKey = platformKey("super_magic/topic_frontend_mode_patch/org-1/user-1")
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		window.sessionStorage.setItem(
			storageKey,
			JSON.stringify({
				"topic-2": {
					project_id: "project-1",
					topic_mode: TopicMode.CustomAgent,
					agent_code: "employee-code-1",
					expiresAt: Date.now() - 1,
				},
			}),
		)
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(newTopic)

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual(newTopic)
		expect(window.sessionStorage.getItem(storageKey)).toBe("{}")
	})

	it("drops unavailable employee patches from session storage after refresh", async () => {
		const storageKey = platformKey("super_magic/topic_frontend_mode_patch/org-1/user-1")
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		window.sessionStorage.setItem(
			storageKey,
			JSON.stringify({
				"topic-2": {
					project_id: "project-1",
					topic_mode: TopicMode.CustomAgent,
					agent_code: "offline-employee",
					createdAt: Date.now(),
					expiresAt: Date.now() + 60_000,
				},
			}),
		)
		modeServiceMock.isModeValid.mockReturnValue(false)
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(newTopic)

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual(newTopic)
		expect(window.sessionStorage.getItem(storageKey)).toBe("{}")
		expect(modeServiceMock.isModeValid).toHaveBeenCalledWith(
			TopicMode.CustomAgent,
			"offline-employee",
		)
	})

	it("updates the frontend employee patch when the user manually switches employee", async () => {
		const sourceTopic = createTopic({
			id: "topic-1",
			topic_name: "Existing Topic",
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
				mergeTopic: vi.fn(),
			} as never,
		})

		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(newTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [newTopic],
			total: 1,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(newTopic)

		await service.createTopic({
			projectId: "project-1",
			topicName: "",
			sourceTopic,
		})
		service.syncTopicFrontendModePatch({
			topic: {
				...newTopic,
				topic_mode: TopicMode.CustomAgent,
				agent_code: "SMA-employee-code-1",
			},
			mode: "SMA-employee-code-2" as TopicMode,
		})

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual({
			...newTopic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: "SMA-employee-code-2",
		})
	})

	it("updates the frontend patch for a configured non-SMA default employee", async () => {
		defaultSelectionState.selection = {
			modeIdentifier: "configured-agent",
			topicPattern: "configured-agent" as TopicMode,
			agentCode: undefined,
		}
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		const mergeTopic = vi.fn()
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
				mergeTopic,
			} as never,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(newTopic)

		service.syncTopicFrontendModePatch({
			topic: newTopic,
			mode: "configured-agent" as TopicMode,
		})

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual({
			...newTopic,
			topic_mode: "configured-agent",
			agent_code: undefined,
		})
		expect(mergeTopic).toHaveBeenCalledWith("topic-2", {
			topic_mode: "configured-agent",
			agent_code: undefined,
		})
	})

	it("restores a queued custom employee when mode and employee code are separate", async () => {
		const newTopic = createEmptyModeTopic("topic-2", "New Topic")
		const mergeTopic = vi.fn()
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
				mergeTopic,
			} as never,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(newTopic)

		service.syncTopicFrontendModePatch({
			topic: newTopic,
			mode: TopicMode.CustomAgent,
			agentCode: "custom-agent-code",
		})

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual({
			...newTopic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: "custom-agent-code",
		})
		expect(mergeTopic).toHaveBeenCalledWith("topic-2", {
			topic_mode: TopicMode.CustomAgent,
			agent_code: "custom-agent-code",
		})
	})

	it("clears the frontend employee patch agent code when the user manually switches to a built-in mode", async () => {
		const newTopic = createTopic({ id: "topic-2", topic_name: "New Topic" })
		const mergeTopic = vi.fn()
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
				mergeTopic,
			} as never,
		})

		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(newTopic)

		service.syncTopicFrontendModePatch({
			topic: {
				...newTopic,
				topic_mode: TopicMode.CustomAgent,
				agent_code: "employee-code-1",
			},
			mode: TopicMode.General,
		})

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual({
			...newTopic,
			topic_mode: TopicMode.General,
			agent_code: undefined,
		})
		expect(mergeTopic).toHaveBeenCalledWith("topic-2", {
			topic_mode: TopicMode.General,
			agent_code: undefined,
		})
	})

	it("does not publish the same recovered mode to the topic store twice", () => {
		const mergeTopic = vi.fn()
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
				mergeTopic,
			} as never,
		})
		const invalidTopic = createTopic({
			id: "topic-2",
			topic_name: "New Topic",
			topic_mode: "ip-manager" as TopicMode,
			agent_code: "",
		})

		service.syncTopicFrontendModePatch({
			topic: invalidTopic,
			mode: TopicMode.General,
		})
		service.syncTopicFrontendModePatch({
			topic: {
				...invalidTopic,
				topic_mode: TopicMode.General,
				agent_code: undefined,
			},
			mode: TopicMode.General,
		})

		expect(mergeTopic).toHaveBeenCalledTimes(1)
		expect(mergeTopic).toHaveBeenCalledWith("topic-2", {
			topic_mode: TopicMode.General,
			agent_code: undefined,
		})
	})

	it("drops the frontend patch after backend updates the topic without an agent code", async () => {
		const storageKey = platformKey("super_magic/topic_frontend_mode_patch/org-1/user-1")
		const sourceTopic = createTopic({
			id: "topic-1",
			topic_name: "Existing Topic",
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		const newTopic = createTopic({
			...createEmptyModeTopic("topic-2", "New Topic"),
			updated_at: "2026-04-08T00:00:00.000Z",
		})
		const backendUpdatedTopic = createTopic({
			...newTopic,
			topic_mode: TopicMode.General,
			agent_code: undefined,
			updated_at: "2026-04-08T00:02:00.000Z",
		})
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})

		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-04-08T00:01:00.000Z"))
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(newTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [newTopic],
			total: 1,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(backendUpdatedTopic)

		await service.createTopic({
			projectId: "project-1",
			topicName: "",
			sourceTopic,
		})

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual(backendUpdatedTopic)
		expect(window.sessionStorage.getItem(storageKey)).toBe("{}")
	})

	it("keeps the frontend patch when backend updates the topic without a mode value", async () => {
		const sourceTopic = createTopic({
			id: "topic-1",
			topic_name: "Existing Topic",
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
		const newTopic = createTopic({
			...createEmptyModeTopic("topic-2", "New Topic"),
			updated_at: "2026-04-08T00:00:00.000Z",
		})
		const backendUpdatedTopic = createTopic({
			...newTopic,
			topic_mode: TopicMode.Empty,
			agent_code: undefined,
			updated_at: "2026-04-08T00:02:00.000Z",
		})
		const service = new TopicService({
			store: {
				setTopics: vi.fn(),
				setSelectedTopic: vi.fn(),
			} as never,
		})

		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-04-08T00:01:00.000Z"))
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(newTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [newTopic],
			total: 1,
		})
		vi.mocked(SuperMagicApi.getTopicDetail).mockResolvedValue(backendUpdatedTopic)

		await service.createTopic({
			projectId: "project-1",
			topicName: "",
			sourceTopic,
		})

		await expect(service.getTopicDetail("topic-2")).resolves.toEqual({
			...backendUpdatedTopic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		})
	})
})

describe("TopicService scene topic-created analytics", () => {
	let topicService: TopicService
	let topicStore: TopicStore

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
		window.sessionStorage.clear()
		topicStore = new TopicStore()
		topicService = new TopicService({ store: topicStore })
		interfaceStore.isMobile = false
	})

	it("reports the created topic with this request's project and workspace ids", async () => {
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(
			createTopic({
				id: "topic-new",
				project_id: "project-1",
				workspace_id: "workspace-1",
			}),
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [
				createTopic({
					id: "topic-new",
					project_id: "project-1",
					workspace_id: "workspace-1",
				}),
			],
			total: 1,
		})

		await topicService.createTopic({
			projectId: "project-1",
			topicName: "New",
			workspaceId: "workspace-1",
			mode: TopicMode.General,
		})

		expect(trackMock).toHaveBeenCalledTimes(1)
		expect(trackMock).toHaveBeenCalledWith("topic_create_attempted", {
			projectId: "project-1",
			workspaceId: "workspace-1",
			mode: TopicMode.General,
		})
	})

	it("still reports once when list refresh fails after a successful create", async () => {
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(
			createTopic({
				id: "topic-new",
				project_id: "project-1",
				workspace_id: "workspace-1",
			}),
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockRejectedValue(new Error("list-failed"))

		await expect(
			topicService.createTopic({ projectId: "project-1", topicName: "New" }),
		).resolves.toBeNull()

		expect(trackMock).toHaveBeenCalledTimes(1)
		expect(trackMock).toHaveBeenCalledWith("topic_create_attempted", {
			projectId: "project-1",
			workspaceId: undefined,
			mode: undefined,
		})
	})

	it("uses the list payload when create response omitted workspace_id", async () => {
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(
			createTopic({
				id: "topic-new",
				project_id: "project-1",
				workspace_id: "",
			}),
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [
				createTopic({
					id: "topic-new",
					project_id: "project-1",
					workspace_id: "workspace-from-list",
				}),
			],
			total: 1,
		})

		await topicService.createTopic({ projectId: "project-1", topicName: "New" })

		expect(trackMock).toHaveBeenCalledTimes(1)
		expect(trackMock).toHaveBeenCalledWith("topic_create_attempted", {
			projectId: "project-1",
			workspaceId: undefined,
			mode: undefined,
		})
	})

	it("does not report when workspace_id is missing from both create and list payloads", async () => {
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(
			createTopic({
				id: "topic-new",
				project_id: "project-1",
				workspace_id: "",
			}),
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [
				createTopic({
					id: "topic-new",
					project_id: "project-1",
					workspace_id: "",
				}),
			],
			total: 1,
		})

		await topicService.createTopic({ projectId: "project-1", topicName: "New" })

		expect(trackMock).toHaveBeenCalledTimes(1)
	})

	it("does not report when the created topic id is blank", async () => {
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(
			createTopic({
				id: "   ",
				project_id: "project-1",
				workspace_id: "workspace-1",
			}),
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [],
			total: 0,
		})

		await topicService.createTopic({ projectId: "project-1", topicName: "New" })

		expect(trackMock).toHaveBeenCalledTimes(1)
	})

	it("does not report when createTopic fails", async () => {
		vi.mocked(SuperMagicApi.createTopic).mockRejectedValue(new Error("create-failed"))

		await expect(
			topicService.createTopic({ projectId: "project-1", topicName: "New" }),
		).resolves.toBeNull()

		expect(trackMock).toHaveBeenCalledTimes(1)
	})
})

describe("topic type requests", () => {
	it("deduplicates only the same type and forwards filters without writing the store", async () => {
		const store = new TopicStore()
		const service = new TopicService({ store })
		const request = vi.mocked(SuperMagicApi.getSidebarTopicsByProjectId)
		request.mockClear()
		request.mockImplementation(
			() =>
				new Promise(() => {
					/* Keep requests pending to verify request deduplication. */
				}),
		)
		const params = { projectId: "project-1", page: 1, pageSize: 100 }
		void service.getSidebarTopicsByProjectId({ ...params, topicType: "topic" })
		void service.getSidebarTopicsByProjectId({ ...params, topicType: "topic" })
		void service.getSidebarTopicsByProjectId({ ...params, topicType: "scheduled_task" })
		expect(request).toHaveBeenCalledTimes(2)
		expect(request).toHaveBeenLastCalledWith(
			expect.objectContaining({ topicType: "scheduled_task" }),
		)
		expect(store.topics).toEqual([])
	})
})
