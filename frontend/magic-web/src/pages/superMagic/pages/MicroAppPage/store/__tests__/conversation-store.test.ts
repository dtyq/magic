import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProjectListItem, Topic } from "../../../Workspace/types"

const mocks = vi.hoisted(() => ({
	getProjectDetail: vi.fn(),
	getTopicsByProjectId: vi.fn(),
	takeProjectRenameTask: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getProjectDetail: mocks.getProjectDetail,
		getTopicsByProjectId: mocks.getTopicsByProjectId,
	},
}))

vi.mock("@/pages/superMagic/services/messageSendRenameTask", () => ({
	takeProjectRenameTask: mocks.takeProjectRenameTask,
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({ error: vi.fn() }),
	},
}))

import { AppConversationStore } from "../conversation-store"

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise
	})

	return { promise, resolve }
}

function createTopic(id: string, projectId: string): Topic {
	return {
		id,
		project_id: projectId,
		topic_name: id,
	} as Topic
}

describe("AppConversationStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getTopicsByProjectId.mockResolvedValue({ list: [] })
		mocks.takeProjectRenameTask.mockReturnValue(null)
	})

	it("replaces the selected topic when project context is rehydrated", () => {
		const store = new AppConversationStore()
		const firstProject = { id: "project-1" } as ProjectListItem
		const secondProject = { id: "project-2" } as ProjectListItem
		const firstTopic = createTopic("topic-1", firstProject.id)
		const secondTopic = createTopic("topic-2", secondProject.id)

		store.hydrate({
			project: firstProject,
			topics: [firstTopic],
			selectedTopicId: firstTopic.id,
		})
		store.hydrate({
			project: secondProject,
			topics: [secondTopic],
			selectedTopicId: secondTopic.id,
		})

		expect(store.selectedProject).toMatchObject(secondProject)
		expect(store.topicStore.selectedTopic).toMatchObject(secondTopic)

		store.hydrate({ project: secondProject, topics: [], selectedTopicId: null })
		expect(store.topicStore.selectedTopic).toBeNull()
	})

	it("refreshes project detail after a pending homepage rename completes", async () => {
		const rename = createDeferred<{
			topicId: string
			topicName: string
		} | null>()
		mocks.takeProjectRenameTask.mockReturnValue(rename.promise)
		mocks.getTopicsByProjectId.mockResolvedValue({
			list: [{ id: "topic-1", project_id: "project-1", topic_name: "" }],
		})
		mocks.getProjectDetail
			.mockResolvedValueOnce({
				id: "project-1",
				project_name: "",
				current_topic_id: "topic-1",
			})
			.mockResolvedValueOnce({ id: "project-1", project_name: "客户跟进看板" })
		const store = new AppConversationStore()

		await store.loadProjectContext("project-1")
		expect(store.selectedProject?.project_name).toBe("")

		rename.resolve({ topicId: "topic-1", topicName: "客户跟进看板" })
		await vi.waitFor(() => {
			expect(store.selectedProject?.project_name).toBe("客户跟进看板")
			expect(store.topicStore.selectedTopic?.topic_name).toBe("客户跟进看板")
			expect(store.topicStore.topics[0]?.topic_name).toBe("客户跟进看板")
		})

		expect(mocks.getProjectDetail).toHaveBeenCalledTimes(2)
		expect(mocks.getProjectDetail).toHaveBeenLastCalledWith(
			{ id: "project-1" },
			{ enableErrorMessagePrompt: false },
		)
	})

	it("does not refresh again when homepage rename fails", async () => {
		mocks.takeProjectRenameTask.mockReturnValue(Promise.resolve(null))
		mocks.getProjectDetail.mockResolvedValue({ id: "project-1", project_name: "" })
		const store = new AppConversationStore()

		await store.loadProjectContext("project-1")
		await Promise.resolve()

		expect(mocks.getProjectDetail).toHaveBeenCalledTimes(1)
	})

	it("keeps the renamed topic visible when the project refresh fails", async () => {
		const rename = createDeferred<{
			topicId: string
			topicName: string
		} | null>()
		mocks.takeProjectRenameTask.mockReturnValue(rename.promise)
		mocks.getTopicsByProjectId.mockResolvedValue({
			list: [{ id: "topic-1", project_id: "project-1", topic_name: "" }],
		})
		mocks.getProjectDetail
			.mockResolvedValueOnce({
				id: "project-1",
				project_name: "",
				current_topic_id: "topic-1",
			})
			.mockRejectedValueOnce(new Error("project refresh failed"))
		const store = new AppConversationStore()

		await store.loadProjectContext("project-1")
		rename.resolve({ topicId: "topic-1", topicName: "客户跟进看板" })

		await vi.waitFor(() => {
			expect(store.topicStore.selectedTopic?.topic_name).toBe("客户跟进看板")
			expect(store.topicStore.topics[0]?.topic_name).toBe("客户跟进看板")
		})
		expect(store.selectedProject?.project_name).toBe("")
		expect(mocks.getProjectDetail).toHaveBeenCalledTimes(2)
	})

	it("does not apply an old rename result after switching projects", async () => {
		const rename = createDeferred<{
			topicId: string
			topicName: string
		} | null>()
		mocks.takeProjectRenameTask.mockReturnValue(rename.promise)
		mocks.getProjectDetail.mockResolvedValue({ id: "project-1", project_name: "" })
		const store = new AppConversationStore()

		await store.loadProjectContext("project-1")
		store.hydrate({
			project: { id: "project-2", project_name: "第二个项目" } as ProjectListItem,
			topics: [],
		})
		rename.resolve({ topicId: "topic-1", topicName: "旧项目名称" })
		await Promise.resolve()
		await Promise.resolve()

		expect(store.selectedProject?.id).toBe("project-2")
		expect(mocks.getProjectDetail).toHaveBeenCalledTimes(1)
	})
})
