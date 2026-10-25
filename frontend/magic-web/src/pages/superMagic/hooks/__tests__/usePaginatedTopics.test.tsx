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

describe("server topic type filtering", () => {
	beforeEach(() => window.sessionStorage.clear())

	it("does not inject a selected topic or unfiltered store into an empty filtered result", async () => {
		const storeTopics = [createTopic("ordinary", "Same name")]
		const service = {
			getSidebarTopicsByProjectId: vi.fn().mockResolvedValue({ list: [], total: 0 }),
			getTopicDetail: vi.fn(),
		}
		const { result } = renderHook(() =>
			usePaginatedTopics({
				projectId: "project-1",
				storeTopics,
				selectedTopicId: "ordinary",
				topicType: "scheduled_task",
				topicService: service as never,
			}),
		)
		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.displayTopics).toEqual([])
		expect(result.current.total).toBe(0)
		expect(service.getTopicDetail).not.toHaveBeenCalled()
		expect(service.getSidebarTopicsByProjectId).toHaveBeenCalledWith(
			expect.objectContaining({ topicType: "scheduled_task" }),
		)
	})

	it("ignores a late previous-filter response and sends the current type when paging", async () => {
		let resolveOld!: (value: { list: Topic[]; total: number }) => void
		const storeTopics: Topic[] = []
		const service = {
			getSidebarTopicsByProjectId: vi.fn().mockImplementation(({ topicType, page }) => {
				if (topicType === "topic")
					return new Promise((resolve) => {
						resolveOld = resolve
					})
				return Promise.resolve({
					list: [createTopic(`scheduled-${page}`, "Same name")],
					total: 2,
				})
			}),
			getTopicDetail: vi.fn(),
		}
		const { result, rerender } = renderHook(
			({ type }: { type: "topic" | "scheduled_task" }) =>
				usePaginatedTopics({
					projectId: "project-1",
					storeTopics,
					topicType: type,
					pageSize: 1,
					topicService: service as never,
				}),
			{ initialProps: { type: "topic" } },
		)
		rerender({ type: "scheduled_task" })
		await waitFor(() => expect(result.current.displayTopics[0]?.id).toBe("scheduled-1"))
		await act(async () =>
			resolveOld({ list: [createTopic("ordinary", "Same name")], total: 1 }),
		)
		expect(result.current.displayTopics[0].id).toBe("scheduled-1")
		await act(async () => result.current.loadMore())
		expect(service.getSidebarTopicsByProjectId).toHaveBeenLastCalledWith(
			expect.objectContaining({ page: 2, topicType: "scheduled_task" }),
		)
		expect(result.current.displayTopics.map((topic) => topic.id)).toEqual([
			"scheduled-1",
			"scheduled-2",
		])
	})

	it("isolates type caches and exposes failure instead of falling back to all topics", async () => {
		const storeTopics = [createTopic("ordinary", "Ordinary")]
		window.sessionStorage.setItem(
			"super-magic-topic-history-session-cache",
			JSON.stringify({ "project-1": { topics: storeTopics, total: 1 } }),
		)
		const service = {
			getSidebarTopicsByProjectId: vi.fn().mockRejectedValue(new Error("offline")),
			getTopicDetail: vi.fn(),
		}
		const { result } = renderHook(() =>
			usePaginatedTopics({
				projectId: "project-1",
				storeTopics,
				topicType: "scheduled_task",
				topicService: service as never,
			}),
		)
		await waitFor(() => expect(result.current.error?.message).toBe("offline"))
		expect(result.current.displayTopics).toEqual([])
		expect(result.current.isLoading).toBe(false)
	})

	it("keeps loaded topics and retries the same page when loading more fails", async () => {
		const service = {
			getSidebarTopicsByProjectId: vi
				.fn()
				.mockResolvedValueOnce({ list: [createTopic("page-1", "One")], total: 2 })
				.mockRejectedValueOnce(new Error("offline"))
				.mockResolvedValueOnce({ list: [createTopic("page-2", "Two")], total: 2 }),
			getTopicDetail: vi.fn(),
		}
		// Stable reference: storeTopics is an effect dependency of the hook.
		const storeTopics: Topic[] = []
		const { result } = renderHook(() =>
			usePaginatedTopics({
				projectId: "project-1",
				storeTopics,
				topicType: "topic",
				pageSize: 1,
				topicService: service as never,
			}),
		)
		await waitFor(() => expect(result.current.displayTopics).toHaveLength(1))

		await act(async () => result.current.loadMore())
		expect(result.current.loadMoreError?.message).toBe("offline")
		expect(result.current.error).toBeNull()
		expect(result.current.hasMore).toBe(true)
		expect(result.current.displayTopics.map((topic) => topic.id)).toEqual(["page-1"])

		await act(async () => result.current.loadMore())
		expect(service.getSidebarTopicsByProjectId).toHaveBeenLastCalledWith(
			expect.objectContaining({ page: 2 }),
		)
		expect(result.current.loadMoreError).toBeNull()
		expect(result.current.displayTopics.map((topic) => topic.id)).toEqual(["page-1", "page-2"])
	})
})
