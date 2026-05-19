import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Topic } from "../../pages/Workspace/types"
import { TaskStatus } from "../../pages/Workspace/types"
import { TopicMode } from "../../pages/Workspace/TopicMode"
import usePaginatedTopics from "../usePaginatedTopics"

vi.mock("../../services", () => ({
	default: {
		topic: {
			getSidebarTopicsByProjectId: vi.fn(),
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
	beforeEach(() => {
		window.sessionStorage.clear()
	})

	it("uses latest store topics when paginated snapshot is stale after creating a topic", async () => {
		const topic1 = createTopic("topic-1", "Topic One")
		const topic2 = createTopic("topic-2", "Topic Two")
		const topic3 = createTopic("topic-3", "Topic Three")
		const topicService = {
			getSidebarTopicsByProjectId: vi.fn().mockResolvedValue({
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
			getSidebarTopicsByProjectId: vi.fn().mockResolvedValue({
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
			getSidebarTopicsByProjectId: vi.fn().mockResolvedValue({
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

	it("tracks manual reload state while keeping existing topics visible", async () => {
		const topic1 = createTopic("topic-1", "Topic One")
		const storeTopics = [topic1]
		let resolveReloadRequest: ((value: { list: Topic[]; total: number }) => void) | undefined
		const topicService = {
			getSidebarTopicsByProjectId: vi
				.fn()
				.mockResolvedValueOnce({
					list: [topic1],
					total: 1,
				})
				.mockImplementationOnce(
					() =>
						new Promise<{ list: Topic[]; total: number }>((resolve) => {
							resolveReloadRequest = resolve
						}),
				),
			getTopicDetail: vi.fn(),
		}

		const { result } = renderHook(() =>
			usePaginatedTopics({
				projectId: "project-1",
				selectedTopicId: "topic-1",
				storeTopics,
				topicService: topicService as never,
			}),
		)

		await waitFor(() => {
			expect(result.current.displayTopics.map((topic) => topic.id)).toEqual(["topic-1"])
			expect(result.current.isReloading).toBe(false)
		})

		act(() => {
			result.current.reload()
		})

		await waitFor(() => {
			expect(result.current.isReloading).toBe(true)
			expect(result.current.displayTopics.map((topic) => topic.id)).toEqual(["topic-1"])
		})

		act(() => {
			resolveReloadRequest?.({
				list: [topic1],
				total: 1,
			})
		})

		await waitFor(() => {
			expect(result.current.isReloading).toBe(false)
		})
		expect(topicService.getSidebarTopicsByProjectId).toHaveBeenCalledTimes(2)
	})
})
