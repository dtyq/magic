import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { SuperMagicApi } from "@/apis"
import { TaskStatus, type Topic } from "@/pages/superMagic/pages/Workspace/types"
import projectStore from "@/pages/superMagic/stores/core/project"
import topicStore, { TopicStore } from "@/pages/superMagic/stores/core/topic"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import { createTopicReadProgressService } from "../topicReadProgressService"
import {
	applyOptimisticTopicRunningState,
	handleArrivedTopicStatusChange,
	syncTopicStatusPatch,
} from "../topicStatusSyncService"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getTopicsStatus: vi.fn(),
		markTopicReadProgress: vi.fn(),
	},
}))

describe("topicStatusSyncService", () => {
	function createTopicPatch({
		id = "topic-1",
		taskStatus = TaskStatus.FINISHED,
		hasUnread = true,
	}: {
		id?: string
		taskStatus?: TaskStatus
		hasUnread?: boolean
	} = {}): Topic {
		return {
			id,
			user_id: "user-1",
			chat_topic_id: "chat-topic-1",
			chat_conversation_id: "conversation-1",
			topic_name: "topic",
			task_status: taskStatus,
			task_mode: "chat",
			project_id: "project-1",
			topic_mode: "",
			updated_at: "2026-04-16 10:00:00",
			workspace_id: "workspace-1",
			has_unread: hasUnread,
			token_used: null,
		}
	}

	beforeEach(() => {
		const topic = createTopicPatch()
		topicStore.setTopics([topic])
		topicStore.setSelectedTopic(topic)
		vi.clearAllMocks()
	})

	afterEach(() => {
		topicStore.reset()
		projectStore.reset()
		workspaceStore.reset()
	})

	it("applyOptimisticTopicRunningState updates topic, project and workspace to running", () => {
		const scopedTopicStore = new TopicStore()
		const topic = createTopicPatch({
			id: "topic-optimistic",
			taskStatus: TaskStatus.WAITING,
		})
		scopedTopicStore.setTopics([topic])
		scopedTopicStore.setSelectedTopic(topic)
		projectStore.setProjects([
			{
				id: "project-optimistic",
				workspace_id: "workspace-optimistic",
				project_status: "waiting",
			} as any,
		])
		projectStore.setSelectedProject({
			id: "project-optimistic",
			workspace_id: "workspace-optimistic",
			project_status: "waiting",
		} as any)
		workspaceStore.setWorkspaces([
			{
				id: "workspace-optimistic",
				name: "workspace",
				is_archived: 0,
				current_topic_id: "topic-optimistic",
				current_project_id: "project-optimistic",
				workspace_status: "waiting",
				project_count: 1,
			} as any,
		])
		workspaceStore.setSelectedWorkspace({
			id: "workspace-optimistic",
			name: "workspace",
			is_archived: 0,
			current_topic_id: "topic-optimistic",
			current_project_id: "project-optimistic",
			workspace_status: "waiting",
			project_count: 1,
		} as any)

		applyOptimisticTopicRunningState({
			topicStore: scopedTopicStore,
			topic,
			project: projectStore.selectedProject,
			workspace: workspaceStore.selectedWorkspace,
		})

		expect(scopedTopicStore.selectedTopic?.task_status).toBe(TaskStatus.RUNNING)
		expect(projectStore.selectedProject?.project_status).toBe("running")
		expect(workspaceStore.selectedWorkspace?.workspace_status).toBe("running")
	})

	it("syncTopicStatusPatch writes unread patch into injected store", async () => {
		const scopedTopicStore = new TopicStore()
		const topic = createTopicPatch({
			id: "topic-sync",
			taskStatus: TaskStatus.RUNNING,
			hasUnread: false,
		})
		scopedTopicStore.setTopics([topic])
		scopedTopicStore.setSelectedTopic(topic)
		vi.mocked(SuperMagicApi.getTopicsStatus).mockResolvedValue({
			list: [
				{
					id: "topic-sync",
					status: "finished",
					has_unread: true,
				},
			],
		})

		await syncTopicStatusPatch({
			topicStore: scopedTopicStore,
			topicId: "topic-sync",
		})

		expect(scopedTopicStore.selectedTopic?.task_status).toBe("finished")
		expect(scopedTopicStore.selectedTopic?.has_unread).toBe(true)
	})

	it("handleArrivedTopicStatusChange merges local status and syncs unread patch", async () => {
		const scopedTopicStore = new TopicStore()
		const topic = createTopicPatch({
			id: "topic-arrived",
			taskStatus: TaskStatus.RUNNING,
			hasUnread: false,
		})
		scopedTopicStore.setTopics([topic])
		scopedTopicStore.setSelectedTopic(topic)
		const scopedTopicReadProgressService = createTopicReadProgressService(scopedTopicStore)
		const currentTopicStatusRef = { current: TaskStatus.RUNNING as TaskStatus | undefined }

		vi.mocked(SuperMagicApi.getTopicsStatus).mockResolvedValue({
			list: [
				{
					id: "topic-arrived",
					status: "finished",
					has_unread: true,
				},
			],
		})

		handleArrivedTopicStatusChange({
			scopeName: "test",
			topicStore: scopedTopicStore,
			topicReadProgressService: scopedTopicReadProgressService,
			currentTopicStatusRef,
			nextStatus: TaskStatus.FINISHED,
			topicId: "topic-arrived",
			terminalReadDelayMs: 0,
		})

		await waitFor(() => {
			expect(scopedTopicStore.selectedTopic?.task_status).toBe(TaskStatus.FINISHED)
			expect(scopedTopicStore.selectedTopic?.has_unread).toBe(true)
		})
	})

	it("handleArrivedTopicStatusChange prevents fallback from running to waiting", () => {
		const scopedTopicStore = new TopicStore()
		const topic = createTopicPatch({
			id: "topic-no-fallback",
			taskStatus: TaskStatus.RUNNING,
			hasUnread: false,
		})
		scopedTopicStore.setTopics([topic])
		scopedTopicStore.setSelectedTopic(topic)
		const scopedTopicReadProgressService = createTopicReadProgressService(scopedTopicStore)
		const currentTopicStatusRef = { current: TaskStatus.RUNNING as TaskStatus | undefined }

		const hasMerged = handleArrivedTopicStatusChange({
			scopeName: "test",
			topicStore: scopedTopicStore,
			topicReadProgressService: scopedTopicReadProgressService,
			currentTopicStatusRef,
			nextStatus: TaskStatus.WAITING,
			topicId: "topic-no-fallback",
		})

		expect(hasMerged).toBe(false)
		expect(scopedTopicStore.selectedTopic?.task_status).toBe(TaskStatus.RUNNING)
		expect(currentTopicStatusRef.current).toBe(TaskStatus.RUNNING)
		expect(SuperMagicApi.getTopicsStatus).not.toHaveBeenCalled()
	})

	it("handleArrivedTopicStatusChange 在终态到达时即使本地无未读也会补记已读", async () => {
		const scopedTopicStore = new TopicStore()
		const topic = createTopicPatch({
			id: "topic-terminal-read",
			taskStatus: TaskStatus.RUNNING,
			hasUnread: false,
		})
		scopedTopicStore.setTopics([topic])
		scopedTopicStore.setSelectedTopic(topic)
		const scopedTopicReadProgressService = createTopicReadProgressService(scopedTopicStore)
		const currentTopicStatusRef = { current: TaskStatus.RUNNING as TaskStatus | undefined }

		vi.mocked(SuperMagicApi.getTopicsStatus).mockResolvedValue({
			list: [
				{
					id: "topic-terminal-read",
					status: "finished",
					has_unread: false,
				},
			],
		})
		vi.mocked(SuperMagicApi.markTopicReadProgress).mockResolvedValue({
			topic_id: "topic-terminal-read",
			last_read_at: "2026-04-16 12:00:00",
			last_read_message_id: "msg-final",
			has_unread: false,
		})

		handleArrivedTopicStatusChange({
			scopeName: "test",
			topicStore: scopedTopicStore,
			topicReadProgressService: scopedTopicReadProgressService,
			currentTopicStatusRef,
			nextStatus: TaskStatus.FINISHED,
			topicId: "topic-terminal-read",
			lastReadAt: "2026-04-16 12:00:00",
			lastReadMessageId: "msg-final",
			terminalReadDelayMs: 0,
		})

		await waitFor(() => {
			expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledWith(
				"topic-terminal-read",
				{
					last_read_at: "2026-04-16 12:00:00",
					last_read_message_id: "msg-final",
				},
			)
		})
	})
})
