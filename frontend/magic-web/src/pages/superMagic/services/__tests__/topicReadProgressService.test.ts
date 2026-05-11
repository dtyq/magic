import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { SuperMagicApi } from "@/apis"
import { TaskStatus, type Topic } from "@/pages/superMagic/pages/Workspace/types"
import topicStore, { TopicStore } from "@/pages/superMagic/stores/core/topic"
import topicReadProgressService, {
	createTopicReadProgressService,
	syncTopicStatusPatch,
} from "../topicReadProgressService"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getTopicsStatus: vi.fn(),
		markTopicReadProgress: vi.fn(),
	},
}))

describe("topicReadProgressService", () => {
	/** 生成最小可用 topic 数据，方便各类读进度场景复用同一份基线对象。 */
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
		topicReadProgressService.resetForTest()
		const topic = createTopicPatch()
		topicStore.setTopics([topic])
		topicStore.setSelectedTopic(topic)
		vi.clearAllMocks()
	})

	afterEach(() => {
		topicStore.reset()
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

	it("created service flushes and merges read progress into injected store", async () => {
		const scopedTopicStore = new TopicStore()
		const topic = createTopicPatch({
			id: "topic-read",
			hasUnread: true,
		})
		scopedTopicStore.setTopics([topic])
		scopedTopicStore.setSelectedTopic(topic)
		vi.mocked(SuperMagicApi.markTopicReadProgress).mockResolvedValue({
			topic_id: "topic-read",
			last_read_at: "2024-01-02 00:00:00",
			last_read_message_id: "msg-2",
			has_unread: false,
		})
		const scopedTopicReadProgressService = createTopicReadProgressService(scopedTopicStore)

		scopedTopicReadProgressService.markTopicReadProgress({
			topicId: "topic-read",
			lastReadAt: "2024-01-02 00:00:00",
			lastReadMessageId: "msg-2",
			reason: "enter-topic",
			immediate: true,
		})
		await waitFor(() => {
			expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledWith("topic-read", {
				last_read_at: "2024-01-02 00:00:00",
				last_read_message_id: "msg-2",
			})
		})

		expect(scopedTopicStore.selectedTopic?.last_read_at).toBe("2024-01-02 00:00:00")
		expect(scopedTopicStore.selectedTopic?.last_read_message_id).toBe("msg-2")
		expect(scopedTopicStore.selectedTopic?.has_unread).toBe(false)
	})

	it("多入口触发在终态且有未读时只会上报一次", async () => {
		vi.mocked(SuperMagicApi.markTopicReadProgress).mockResolvedValue({
			topic_id: "topic-1",
			last_read_at: "2026-04-16 10:00:00",
			last_read_message_id: "msg-1",
			has_unread: false,
		})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-1",
			lastReadAt: "2026-04-16 10:00:00",
			lastReadMessageId: "msg-1",
			reason: "message-change",
		})

		await topicReadProgressService.flushTopicReadProgress({
			topicId: "topic-1",
			reason: "route-leave",
		})
		await topicReadProgressService.flushCurrentTopicReadProgress("page-hide")

		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(1)
	})

	it("相同游标重复触发时只请求一次", async () => {
		vi.mocked(SuperMagicApi.markTopicReadProgress).mockResolvedValue({
			topic_id: "topic-1",
			last_read_at: "2026-04-16 10:00:00",
			last_read_message_id: "msg-1",
			has_unread: false,
		})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-1",
			lastReadAt: "2026-04-16 10:00:00",
			lastReadMessageId: "msg-1",
			reason: "message-change",
			immediate: true,
		})
		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-1",
			lastReadAt: "2026-04-16 10:00:00",
			lastReadMessageId: "msg-1",
			reason: "message-change",
			immediate: true,
		})

		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(1)
	})

	it("同一时间从无 messageId 到有 messageId 时应视为前进并补发", async () => {
		vi.mocked(SuperMagicApi.markTopicReadProgress)
			.mockResolvedValueOnce({
				topic_id: "topic-1",
				last_read_at: "2026-04-16 10:00:00",
				last_read_message_id: null,
				has_unread: true,
			})
			.mockResolvedValueOnce({
				topic_id: "topic-1",
				last_read_at: "2026-04-16 10:00:00",
				last_read_message_id: "msg-1",
				has_unread: false,
			})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-1",
			lastReadAt: "2026-04-16 10:00:00",
			reason: "message-change",
			immediate: true,
		})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-1",
			lastReadAt: "2026-04-16 10:00:00",
			lastReadMessageId: "msg-1",
			reason: "message-change",
			immediate: true,
		})

		await new Promise((resolve) => {
			setTimeout(resolve, 0)
		})

		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(2)
	})

	it("时间回退但游标不完全重复时允许请求，由后端兜底", async () => {
		vi.mocked(SuperMagicApi.markTopicReadProgress)
			.mockResolvedValueOnce({
				topic_id: "topic-1",
				last_read_at: "2026-04-16 10:00:01",
				last_read_message_id: "msg-2",
				has_unread: true,
			})
			.mockResolvedValueOnce({
				topic_id: "topic-1",
				last_read_at: "2026-04-16 10:00:00",
				last_read_message_id: "msg-1",
				has_unread: false,
			})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-1",
			lastReadAt: "2026-04-16 10:00:01",
			lastReadMessageId: "msg-2",
			reason: "message-change",
			immediate: true,
		})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-1",
			lastReadAt: "2026-04-16 10:00:00",
			lastReadMessageId: "msg-1",
			reason: "message-change",
			immediate: true,
		})

		await new Promise((resolve) => {
			setTimeout(resolve, 0)
		})

		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(2)
	})

	it("运行中话题不触发上报", async () => {
		const runningTopic = createTopicPatch({
			id: "topic-running",
			taskStatus: TaskStatus.RUNNING,
			hasUnread: true,
		})
		topicStore.setTopics([runningTopic])
		topicStore.setSelectedTopic(runningTopic)

		vi.mocked(SuperMagicApi.markTopicReadProgress).mockResolvedValue({
			topic_id: "topic-running",
			last_read_at: "2026-04-16 11:00:00",
			last_read_message_id: "msg-9",
			has_unread: false,
		})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-running",
			lastReadAt: "2026-04-16 11:00:00",
			lastReadMessageId: "msg-9",
			reason: "message-change",
			immediate: true,
		})

		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(0)
	})

	it("无未读时不触发上报", async () => {
		const readTopic = createTopicPatch({
			id: "topic-read",
			taskStatus: TaskStatus.FINISHED,
			hasUnread: false,
		})
		topicStore.setTopics([readTopic])
		topicStore.setSelectedTopic(readTopic)

		vi.mocked(SuperMagicApi.markTopicReadProgress).mockResolvedValue({
			topic_id: "topic-read",
			last_read_at: "2026-04-16 11:00:00",
			last_read_message_id: "msg-9",
			has_unread: false,
		})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-read",
			lastReadAt: "2026-04-16 11:00:00",
			lastReadMessageId: "msg-9",
			reason: "message-change",
			immediate: true,
		})

		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(0)
	})

	it("运行中已写入 latest 的同游标在终态后可用 immediate 触发上报", async () => {
		const runningTopic = createTopicPatch({
			id: "topic-r1",
			taskStatus: TaskStatus.RUNNING,
			hasUnread: true,
		})
		topicStore.setTopics([runningTopic])
		topicStore.setSelectedTopic(runningTopic)

		vi.mocked(SuperMagicApi.markTopicReadProgress).mockResolvedValue({
			topic_id: "topic-r1",
			last_read_at: "2026-04-16 12:00:00",
			last_read_message_id: "msg-final",
			has_unread: false,
		})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-r1",
			lastReadAt: "2026-04-16 12:00:00",
			lastReadMessageId: "msg-final",
			reason: "message-change",
		})
		await Promise.resolve()
		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(0)

		const finishedTopic = createTopicPatch({
			id: "topic-r1",
			taskStatus: TaskStatus.FINISHED,
			hasUnread: true,
		})
		topicStore.setTopics([finishedTopic])
		topicStore.setSelectedTopic(finishedTopic)

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-r1",
			lastReadAt: "2026-04-16 12:00:00",
			lastReadMessageId: "msg-final",
			reason: "message-change",
		})
		await Promise.resolve()
		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(0)

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-r1",
			lastReadAt: "2026-04-16 12:00:00",
			lastReadMessageId: "msg-final",
			reason: "message-change",
			immediate: true,
		})
		await Promise.resolve()
		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(1)
	})

	it("上报失败后清空发出去重键以便再次 flush 同游标", async () => {
		vi.mocked(SuperMagicApi.markTopicReadProgress)
			.mockRejectedValueOnce(new Error("network"))
			.mockResolvedValueOnce({
				topic_id: "topic-1",
				last_read_at: "2026-04-16 10:00:00",
				last_read_message_id: "msg-1",
				has_unread: false,
			})

		topicReadProgressService.markTopicReadProgress({
			topicId: "topic-1",
			lastReadAt: "2026-04-16 10:00:00",
			lastReadMessageId: "msg-1",
			reason: "message-change",
		})
		await Promise.resolve()
		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(1)

		await topicReadProgressService.flushTopicReadProgress({
			topicId: "topic-1",
			reason: "route-leave",
		})

		expect(SuperMagicApi.markTopicReadProgress).toHaveBeenCalledTimes(2)
	})
})
