import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { platformKey } from "@/utils/storage"
import type { Topic } from "../../pages/Workspace/types"
import { TaskStatus } from "../../pages/Workspace/types"
import { TopicMode } from "../../pages/Workspace/TopicMode"
import TopicService from "../topicService"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createTopic: vi.fn(),
		getTopicsByProjectId: vi.fn(),
		getTopicDetail: vi.fn(),
	},
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

function createTopic(id: string, topicName: string): Topic {
	return {
		id,
		user_id: "user-1",
		chat_topic_id: `chat-${id}`,
		chat_conversation_id: `conversation-${id}`,
		topic_name: topicName,
		task_status: TaskStatus.FINISHED,
		task_mode: "chat",
		project_id: "project-1",
		topic_mode: TopicMode.General,
		updated_at: "2026-04-08T00:00:00Z",
		workspace_id: "workspace-1",
		token_used: null,
	}
}

describe("TopicService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
		window.sessionStorage.clear()
	})

	it("creates an empty backend topic and keeps the previous employee selection in frontend state", async () => {
		const sourceTopic = {
			...createTopic("topic-1", "Existing Topic"),
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		}
		const newTopic = createTopic("topic-2", "New Topic")
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
		const sourceTopic = {
			...createTopic("topic-1", "Existing Topic"),
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		}
		const newTopic = createTopic("topic-2", "New Topic")
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

	it("keeps backend employee selection when the reloaded topic already has an agent code", async () => {
		const sourceTopic = {
			...createTopic("topic-1", "Existing Topic"),
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		}
		const newTopic = createTopic("topic-2", "New Topic")
		const backendTopic = {
			...newTopic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: "backend-employee-code",
		}
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

	it("restores inherited employee selection from session storage after service recreation", async () => {
		const sourceTopic = {
			...createTopic("topic-1", "Existing Topic"),
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		}
		const newTopic = createTopic("topic-2", "New Topic")
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
		const newTopic = createTopic("topic-2", "New Topic")
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

	it("updates the frontend employee patch when the user manually switches employee", async () => {
		const sourceTopic = {
			...createTopic("topic-1", "Existing Topic"),
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		}
		const newTopic = createTopic("topic-2", "New Topic")
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

	it("clears the frontend employee patch agent code when the user manually switches to a built-in mode", async () => {
		const newTopic = createTopic("topic-2", "New Topic")
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

	it("drops the frontend patch after backend updates the topic without an agent code", async () => {
		const storageKey = platformKey("super_magic/topic_frontend_mode_patch/org-1/user-1")
		const sourceTopic = {
			...createTopic("topic-1", "Existing Topic"),
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		}
		const newTopic = {
			...createTopic("topic-2", "New Topic"),
			updated_at: "2026-04-08T00:00:00.000Z",
		}
		const backendUpdatedTopic = {
			...newTopic,
			topic_mode: TopicMode.General,
			agent_code: undefined,
			updated_at: "2026-04-08T00:02:00.000Z",
		}
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
		const sourceTopic = {
			...createTopic("topic-1", "Existing Topic"),
			topic_mode: TopicMode.CustomAgent,
			agent_code: "employee-code-1",
		}
		const newTopic = {
			...createTopic("topic-2", "New Topic"),
			updated_at: "2026-04-08T00:00:00.000Z",
		}
		const backendUpdatedTopic = {
			...newTopic,
			topic_mode: TopicMode.Empty,
			agent_code: undefined,
			updated_at: "2026-04-08T00:02:00.000Z",
		}
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
