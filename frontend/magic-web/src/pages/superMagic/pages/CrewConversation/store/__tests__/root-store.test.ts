import { beforeEach, describe, expect, it, vi } from "vitest"
import { CrewApi, SuperMagicApi } from "@/apis"
import { crewService, type AgentDetailView } from "@/services/crew/CrewService"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import {
	ProjectStatus,
	TaskStatus,
	type ProjectListItem,
	type Topic,
} from "@/pages/superMagic/pages/Workspace/types"
import { CrewConversationStore } from "../root-store"

const analyticsTrackMock = vi.hoisted(() => vi.fn())

type SpecialProjectResponse = Awaited<ReturnType<typeof SuperMagicApi.getSpecialProject>>
type ProjectDetailResponse = Awaited<ReturnType<typeof SuperMagicApi.getProjectDetail>>
type TopicsResponse = Awaited<ReturnType<typeof SuperMagicApi.getTopicsByProjectId>>
type AttachmentsResponse = Awaited<ReturnType<typeof SuperMagicApi.getAttachmentsByProjectId>>

vi.mock("@/apis", () => ({
	CrewApi: {
		hireStoreAgent: vi.fn(),
	},
	SuperMagicApi: {
		getSpecialProject: vi.fn(),
		getProjectDetail: vi.fn(),
		getTopicsByProjectId: vi.fn(),
		getAttachmentsByProjectId: vi.fn(),
		createTopic: vi.fn(),
	},
}))

vi.mock("@/services/crew/CrewService", () => ({
	crewService: {
		getAgentDetail: vi.fn(),
		checkAgentAccess: vi.fn(),
	},
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		fetchModeList: vi.fn(),
		fetchDefaultModeModelList: vi.fn(),
	},
}))

vi.mock("@/services/analytics", () => ({
	analyticsService: { report: analyticsTrackMock },
}))

vi.mock("@/components/business/MentionPanel/builtin-store", () => ({
	createMentionPanelStore: vi.fn(() => ({
		initLoadAttachments: vi.fn(),
		finishLoadAttachmentsPromise: vi.fn(),
	})),
}))

vi.mock("@/pages/superMagic/utils/attachmentDataProcessor", () => ({
	AttachmentDataProcessor: {
		processAttachmentData: vi.fn(() => ({ tree: [], list: [] })),
	},
}))

function createAgent(overrides: Partial<AgentDetailView> = {}): AgentDetailView {
	return {
		id: "agent-id-1",
		agentCode: "SMA-agent",
		name: "Agent",
		role: "Helper",
		description: "Agent description",
		icon: null,
		prompt: null,
		enabled: true,
		sourceType: "LOCAL_CREATE",
		isStoreOffline: null,
		pinnedAt: null,
		skills: [],
		features: [],
		...overrides,
	}
}

function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: "project-1",
		project_status: ProjectStatus.WAITING,
		project_mode: TopicMode.CustomAgent,
		workspace_id: "workspace-1",
		work_dir: "/workspace",
		workspace_name: "Workspace",
		project_name: "Project",
		current_topic_status: TaskStatus.FINISHED,
		current_topic_id: "topic-1",
		created_at: "2026-06-08T00:00:00Z",
		updated_at: "2026-06-08T00:00:00Z",
		tag: "",
		user_role: "owner",
		...overrides,
	}
}

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: "topic-1",
		user_id: "user-1",
		topic_name: "Topic",
		chat_topic_id: "chat-topic-1",
		chat_conversation_id: "chat-conversation-1",
		task_status: TaskStatus.FINISHED,
		task_mode: "chat",
		project_id: "project-1",
		topic_mode: TopicMode.CustomAgent,
		updated_at: "2026-06-08T00:00:00Z",
		workspace_id: "workspace-1",
		token_used: null,
		...overrides,
	}
}

/** Creates a normalized access-check result with synthetic identifiers. */
function createAccessCheck(
	overrides: Partial<{ code: string; exists: boolean; canUse: boolean }> = {},
) {
	return {
		code: "SMA-access-mock",
		exists: true,
		canUse: true,
		...overrides,
	}
}

/** Configures the downstream project requests required for a ready conversation. */
function mockReadyConversation() {
	vi.mocked(SuperMagicApi.getSpecialProject).mockResolvedValue({
		project: createProject(),
		is_existing: false,
	} as SpecialProjectResponse)
	vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue(
		createProject() as ProjectDetailResponse,
	)
	vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
		list: [createTopic()],
	} as TopicsResponse)
}

describe("CrewConversationStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(superMagicModeService.fetchModeList).mockResolvedValue([])
		vi.mocked(superMagicModeService.fetchDefaultModeModelList).mockResolvedValue(undefined)
		vi.mocked(SuperMagicApi.getAttachmentsByProjectId).mockResolvedValue({
			tree: [],
			list: [],
		} as AttachmentsResponse)
	})

	it("marks empty code invalid without creating a special project", async () => {
		const store = new CrewConversationStore()

		await store.bootstrap("   ")

		expect(store.status).toBe("invalid")
		expect(crewService.getAgentDetail).not.toHaveBeenCalled()
		expect(crewService.checkAgentAccess).not.toHaveBeenCalled()
		expect(SuperMagicApi.getSpecialProject).not.toHaveBeenCalled()
	})

	it("does not create a special project when agent validation fails", async () => {
		vi.mocked(crewService.getAgentDetail).mockRejectedValue(new Error("mock detail failure"))
		const store = new CrewConversationStore()

		await store.bootstrap("SMA-missing")

		expect(store.status).toBe("invalid")
		expect(crewService.getAgentDetail).toHaveBeenCalledWith("SMA-missing")
		expect(SuperMagicApi.getSpecialProject).not.toHaveBeenCalled()
	})

	it("marks a missing Widget agent invalid without loading detail", async () => {
		vi.mocked(crewService.checkAgentAccess).mockResolvedValue(
			createAccessCheck({ exists: false, canUse: false }),
		)
		const store = new CrewConversationStore()

		await store.bootstrap("SMA-missing-widget", { autoHire: true })

		expect(store.status).toBe("invalid")
		expect(CrewApi.hireStoreAgent).not.toHaveBeenCalled()
		expect(crewService.getAgentDetail).not.toHaveBeenCalled()
		expect(SuperMagicApi.getSpecialProject).not.toHaveBeenCalled()
	})

	it("does not hire when automatic hiring is disabled", async () => {
		vi.mocked(crewService.checkAgentAccess).mockResolvedValue(
			createAccessCheck({ canUse: false }),
		)
		const store = new CrewConversationStore()

		await store.bootstrap("SMA-unavailable", { autoHire: false })

		expect(store.status).toBe("unavailable")
		expect(CrewApi.hireStoreAgent).not.toHaveBeenCalled()
		expect(SuperMagicApi.getSpecialProject).not.toHaveBeenCalled()
	})

	it("loads ordinary detail directly when access check allows use", async () => {
		vi.mocked(crewService.checkAgentAccess).mockResolvedValue(
			createAccessCheck({ code: "SMA-canonical-access" }),
		)
		vi.mocked(crewService.getAgentDetail).mockResolvedValue(createAgent())
		mockReadyConversation()

		const store = new CrewConversationStore()
		await store.bootstrap("SMA-alias-access", { autoHire: true })

		expect(CrewApi.hireStoreAgent).not.toHaveBeenCalled()
		expect(crewService.getAgentDetail).toHaveBeenCalledWith("SMA-canonical-access")
		expect(superMagicModeService.fetchModeList).not.toHaveBeenCalled()
		expect(store.status).toBe("ready")
	})

	it("hires an unavailable market agent and continues without another access check", async () => {
		vi.mocked(crewService.checkAgentAccess).mockResolvedValue(
			createAccessCheck({ code: "SMA-canonical-market", canUse: false }),
		)
		vi.mocked(CrewApi.hireStoreAgent).mockResolvedValue([])
		vi.mocked(crewService.getAgentDetail).mockResolvedValue(createAgent())
		mockReadyConversation()

		const store = new CrewConversationStore()
		await store.bootstrap("SMA-market-mock", { autoHire: true })

		expect(CrewApi.hireStoreAgent).toHaveBeenCalledWith(
			{ code: "SMA-canonical-market" },
			{ enableErrorMessagePrompt: false },
		)
		expect(crewService.checkAgentAccess).toHaveBeenCalledTimes(1)
		expect(crewService.getAgentDetail).toHaveBeenCalledWith("SMA-canonical-market")
		expect(superMagicModeService.fetchModeList).toHaveBeenCalledWith({ force: true })
		expect(store.status).toBe("ready")
	})

	it("stops after one failed hire without another access check", async () => {
		vi.mocked(crewService.checkAgentAccess).mockResolvedValue(
			createAccessCheck({ canUse: false }),
		)
		vi.mocked(CrewApi.hireStoreAgent).mockRejectedValue(new Error("mock hire failure"))
		const store = new CrewConversationStore()

		await store.bootstrap("SMA-still-unavailable", { autoHire: true })

		expect(store.status).toBe("unavailable")
		expect(CrewApi.hireStoreAgent).toHaveBeenCalledTimes(1)
		expect(crewService.checkAgentAccess).toHaveBeenCalledTimes(1)
		expect(superMagicModeService.fetchModeList).not.toHaveBeenCalled()
		expect(crewService.getAgentDetail).not.toHaveBeenCalled()
	})

	it("does not hire after an access-check transport failure", async () => {
		vi.mocked(crewService.checkAgentAccess).mockRejectedValue(new Error("mock network"))
		const store = new CrewConversationStore()

		await store.bootstrap("SMA-network-mock", { autoHire: true })

		expect(store.status).toBe("error")
		expect(CrewApi.hireStoreAgent).not.toHaveBeenCalled()
	})

	it("treats detail failure after confirmed access as recoverable error", async () => {
		vi.mocked(crewService.checkAgentAccess).mockResolvedValue(createAccessCheck())
		vi.mocked(crewService.getAgentDetail).mockRejectedValue(new Error("mock detail failure"))
		const store = new CrewConversationStore()

		await store.bootstrap("SMA-detail-error", { autoHire: true })

		expect(store.status).toBe("error")
		expect(CrewApi.hireStoreAgent).not.toHaveBeenCalled()
	})

	it("reuses an in-flight hire across overlapping bootstraps", async () => {
		let resolveHire: ((value: []) => void) | undefined
		const hirePromise = new Promise<[]>((resolve) => {
			resolveHire = resolve
		})
		vi.mocked(crewService.checkAgentAccess)
			.mockResolvedValueOnce(createAccessCheck({ canUse: false }))
			.mockResolvedValueOnce(createAccessCheck({ canUse: false }))
		vi.mocked(CrewApi.hireStoreAgent).mockReturnValue(hirePromise)
		vi.mocked(crewService.getAgentDetail).mockResolvedValue(createAgent())
		mockReadyConversation()
		const store = new CrewConversationStore()

		const firstBootstrap = store.bootstrap("SMA-overlap", { autoHire: true })
		await vi.waitFor(() => expect(CrewApi.hireStoreAgent).toHaveBeenCalledTimes(1))
		const secondBootstrap = store.bootstrap("SMA-overlap", { autoHire: true })
		await vi.waitFor(() => expect(crewService.checkAgentAccess).toHaveBeenCalledTimes(2))
		resolveHire?.([])
		await Promise.all([firstBootstrap, secondBootstrap])

		expect(CrewApi.hireStoreAgent).toHaveBeenCalledTimes(1)
		expect(crewService.checkAgentAccess).toHaveBeenCalledTimes(2)
		expect(superMagicModeService.fetchModeList).toHaveBeenCalledTimes(1)
		expect(store.status).toBe("ready")
	})

	it("does not hire when an obsolete access check resolves after a newer bootstrap", async () => {
		let resolveFirstAccess: ((value: ReturnType<typeof createAccessCheck>) => void) | undefined
		const firstAccess = new Promise<ReturnType<typeof createAccessCheck>>((resolve) => {
			resolveFirstAccess = resolve
		})
		vi.mocked(crewService.checkAgentAccess)
			.mockReturnValueOnce(firstAccess)
			.mockResolvedValueOnce(createAccessCheck({ code: "SMA-current-access" }))
		vi.mocked(crewService.getAgentDetail).mockResolvedValue(createAgent())
		mockReadyConversation()
		const store = new CrewConversationStore()

		const obsoleteBootstrap = store.bootstrap("SMA-obsolete", { autoHire: true })
		const currentBootstrap = store.bootstrap("SMA-current", { autoHire: true })
		await currentBootstrap
		resolveFirstAccess?.(createAccessCheck({ code: "SMA-obsolete", canUse: false }))
		await obsoleteBootstrap

		expect(CrewApi.hireStoreAgent).not.toHaveBeenCalled()
		expect(crewService.getAgentDetail).toHaveBeenCalledWith("SMA-current-access")
		expect(store.status).toBe("ready")
	})

	it("does not create a special project when validated employee id is empty", async () => {
		vi.mocked(crewService.getAgentDetail).mockResolvedValue(createAgent({ id: "   " }))
		const store = new CrewConversationStore()

		await store.bootstrap("SMA-agent")

		expect(store.status).toBe("invalid")
		expect(SuperMagicApi.getSpecialProject).not.toHaveBeenCalled()
	})

	it("loads the special project context after validating the agent code", async () => {
		vi.mocked(crewService.getAgentDetail).mockResolvedValue(createAgent())
		vi.mocked(SuperMagicApi.getSpecialProject).mockResolvedValue({
			project: createProject(),
			is_existing: false,
		} as SpecialProjectResponse)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue(
			createProject() as ProjectDetailResponse,
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [createTopic()],
		} as TopicsResponse)

		const store = new CrewConversationStore()
		await store.bootstrap(" SMA-agent ")

		expect(store.status).toBe("ready")
		expect(store.agentCode).toBe("agent-id-1")
		expect(store.agent?.agentCode).toBe("SMA-agent")
		expect(SuperMagicApi.getSpecialProject).toHaveBeenCalledWith({ key: "agent-id-1" })
		expect(store.selectedProject?.id).toBe("project-1")
		expect(store.selectedTopic?.id).toBe("topic-1")
		// Bootstrapping a lazily provisioned Crew project is not a user create attempt.
		expect(analyticsTrackMock).not.toHaveBeenCalled()
	})

	it("does not report entity creation when the employee special project already exists", async () => {
		vi.mocked(crewService.getAgentDetail).mockResolvedValue(createAgent())
		vi.mocked(SuperMagicApi.getSpecialProject).mockResolvedValue({
			project: createProject(),
			is_existing: true,
		} as SpecialProjectResponse)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue(
			createProject() as ProjectDetailResponse,
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [createTopic()],
		} as TopicsResponse)

		const store = new CrewConversationStore()
		await store.bootstrap("SMA-existing-agent")

		expect(store.status).toBe("ready")
		expect(analyticsTrackMock).not.toHaveBeenCalledWith(
			"project_create_attempted",
			expect.anything(),
		)
	})

	it("uses the validated employee id to create the special project", async () => {
		vi.mocked(crewService.getAgentDetail).mockResolvedValue(
			createAgent({ id: "agent-canonical-id", agentCode: "SMA-canonical-agent" }),
		)
		vi.mocked(SuperMagicApi.getSpecialProject).mockResolvedValue({
			project: createProject(),
			is_existing: false,
		} as SpecialProjectResponse)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue(
			createProject() as ProjectDetailResponse,
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [createTopic()],
		} as TopicsResponse)

		const store = new CrewConversationStore()
		await store.bootstrap(" alias-code ")

		expect(store.status).toBe("ready")
		expect(store.agentCode).toBe("agent-canonical-id")
		expect(SuperMagicApi.getSpecialProject).toHaveBeenCalledWith({
			key: "agent-canonical-id",
		})
		expect(store.selectedTopic?.agent_code).toBe("agent-canonical-id")
	})

	it("creates and selects a new topic in the dedicated project", async () => {
		vi.mocked(crewService.getAgentDetail).mockResolvedValue(createAgent())
		vi.mocked(SuperMagicApi.getSpecialProject).mockResolvedValue({
			project: createProject(),
			is_existing: true,
		} as SpecialProjectResponse)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue(
			createProject() as ProjectDetailResponse,
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId)
			.mockResolvedValueOnce({ list: [createTopic()] } as TopicsResponse)
			.mockResolvedValueOnce({
				list: [
					createTopic({ id: "topic-2", chat_topic_id: "chat-topic-2" }),
					createTopic(),
				],
			} as TopicsResponse)
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(
			createTopic({ id: "topic-2", chat_topic_id: "chat-topic-2" }),
		)

		const store = new CrewConversationStore()
		await store.bootstrap("SMA-agent")
		await store.createAndSelectNewTopic()

		expect(SuperMagicApi.createTopic).toHaveBeenCalledWith({
			project_id: "project-1",
			topic_name: "",
		})
		expect(store.selectedTopic?.id).toBe("topic-2")
		expect(store.selectedTopic?.agent_code).toBe("agent-id-1")
		expect(store.selectedTopic?.topic_mode).toBe(TopicMode.CustomAgent)
		expect(store.topicStore.topics.map((topic) => topic.id)).toEqual(["topic-2", "topic-1"])
	})
})
