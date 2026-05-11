import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Topic } from "../../pages/Workspace/types"
import { TaskStatus, TopicMode } from "../../pages/Workspace/types"
import usePaginatedTopics from "../usePaginatedTopics"

vi.mock("../../services", () => ({
	default: {
		topic: {
			getTopicsByProjectId: vi.fn(),
			getTopicDetail: vi.fn(),
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

describe("usePaginatedTopics", () => {
	it("uses latest store topics when paginated snapshot is stale after creating a topic", async () => {
		const topic1 = createTopic("topic-1", "Topic One")
		const topic2 = createTopic("topic-2", "Topic Two")
		const topic3 = createTopic("topic-3", "Topic Three")
		const topicService = {
			getTopicsByProjectId: vi.fn().mockResolvedValue({
				list: [topic1, topic2],
				total: 2,
			}),
			getTopicDetail: vi.fn(),
		}

		const { result, rerender } = renderHook(
			({ storeTopics }) =>
				usePaginatedTopics({
					projectId: "project-1",
					selectedTopicId: "topic-1",
					storeTopics,
					topicService: topicService as never,
				}),
			{
				initialProps: {
					storeTopics: [topic1, topic2],
				},
			},
		)

		await waitFor(() => {
			expect(result.current.displayTopics.map((topic) => topic.id)).toEqual([
				"topic-1",
				"topic-2",
			])
			expect(result.current.total).toBe(2)
		})

		rerender({
			storeTopics: [topic3, topic1, topic2],
		})

		await waitFor(() => {
			expect(result.current.displayTopics.map((topic) => topic.id)).toEqual([
				"topic-3",
				"topic-1",
				"topic-2",
			])
			expect(result.current.total).toBe(3)
		})
	})

	it("prefers refreshed store topics when paginated snapshot is stale after renaming", async () => {
		const topic1 = createTopic("topic-1", "Topic One")
		const topic2 = createTopic("topic-2", "Topic Two")
		const topic3 = createTopic("topic-3", "Topic Three")
		const renamedTopic3 = createTopic("topic-3", "Renamed Topic Three")
		const topicService = {
			getTopicsByProjectId: vi.fn().mockResolvedValue({
				list: [topic1, topic2, topic3],
				total: 3,
			}),
			getTopicDetail: vi.fn(),
		}

		const { result, rerender } = renderHook(
			({ storeTopics }) =>
				usePaginatedTopics({
					projectId: "project-1",
					selectedTopicId: "topic-1",
					storeTopics,
					topicService: topicService as never,
				}),
			{
				initialProps: {
					storeTopics: [topic1, topic2],
				},
			},
		)

		await waitFor(() => {
			expect(result.current.displayTopics.map((topic) => topic.topic_name)).toEqual([
				"Topic One",
				"Topic Two",
			])
			expect(result.current.total).toBe(2)
		})

		rerender({
			storeTopics: [topic1, topic2, renamedTopic3],
		})

		await waitFor(() => {
			expect(result.current.displayTopics.map((topic) => topic.topic_name)).toEqual([
				"Topic One",
				"Topic Two",
				"Renamed Topic Three",
			])
			expect(result.current.total).toBe(3)
		})
	})

	it("drops deleted topics and keeps total accurate after store sync", async () => {
		const topic1 = createTopic("topic-1", "Topic One")
		const topic2 = createTopic("topic-2", "Topic Two")
		const topic3 = createTopic("topic-3", "Topic Three")
		const topicService = {
			getTopicsByProjectId: vi.fn().mockResolvedValue({
				list: [topic1, topic2, topic3],
				total: 3,
			}),
			getTopicDetail: vi.fn(),
		}

		const { result, rerender } = renderHook(
			({ storeTopics }) =>
				usePaginatedTopics({
					projectId: "project-1",
					selectedTopicId: "topic-1",
					storeTopics,
					topicService: topicService as never,
				}),
			{
				initialProps: {
					storeTopics: [topic1, topic2, topic3],
				},
			},
		)

		await waitFor(() => {
			expect(result.current.displayTopics.map((topic) => topic.id)).toEqual([
				"topic-1",
				"topic-2",
				"topic-3",
			])
			expect(result.current.total).toBe(3)
		})

		rerender({
			storeTopics: [topic1, topic2],
		})

		await waitFor(() => {
			expect(result.current.displayTopics.map((topic) => topic.id)).toEqual([
				"topic-1",
				"topic-2",
			])
			expect(result.current.total).toBe(2)
		})
	})
})
