import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { AudioProjectApiItem, AudioProjectListItem } from "@/types/audioProject"

const { summaryProgressPollerMock } = vi.hoisted(() => ({
	summaryProgressPollerMock: {
		addTask: vi.fn(),
		dispose: vi.fn(),
		setCallbacks: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		queryAudioProjects: vi.fn(),
		getRecordingSummaryResult: vi.fn(),
		summarizeRecordedTask: vi.fn(),
		batchTaskProgress: vi.fn(),
		editProject: vi.fn(),
		batchDeleteProjects: vi.fn(),
	},
}))

vi.mock("../../utils/resolve-auto-summary-model-id", () => ({
	resolveAutoSummaryModelId: vi.fn(),
}))

vi.mock("../../services/summary-progress-poller", () => ({
	summaryProgressPoller: summaryProgressPollerMock,
}))

import { resolveAutoSummaryModelId } from "../../utils/resolve-auto-summary-model-id"
import { AudioRecordingsStore } from "../audio-recordings-store"

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

function createApiItem(
	id: string,
	overrides: Partial<AudioProjectApiItem> = {},
): AudioProjectApiItem {
	return {
		id,
		project_name: `Recording ${id}`,
		created_at: 1780657155,
		project_status: "finished",
		project_mode: "audio",
		extra: {
			duration: 120,
			device_id: "Redmi K70 Ultra",
			audio_source: "recorded",
			current_phase: "summarizing",
			phase_status: "completed",
			tags: [],
		},
		...overrides,
	}
}

describe("AudioRecordingsStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("normalizes API items and uses total for hasMore", async () => {
		const store = new AudioRecordingsStore()
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: Array.from({ length: 20 }, (_, index) => createApiItem(String(index + 1))),
			total: 40,
			page: 1,
			page_size: 20,
		})

		await store.fetchList({ page: 1 })

		expect(store.list).toHaveLength(20)
		expect(store.list[0]?.duration).toBe(120)
		expect(store.list[0]?.card_status).toBe("summarized")
		expect(store.hasMore).toBe(true)
	})

	it("appends unique items when loading more", async () => {
		const store = new AudioRecordingsStore()
		vi.mocked(SuperMagicApi.queryAudioProjects)
			.mockResolvedValueOnce({
				list: Array.from({ length: 20 }, (_, index) => createApiItem(String(index + 1))),
				total: 21,
			})
			.mockResolvedValueOnce({
				list: [createApiItem("21")],
				total: 21,
			})

		await store.fetchList({ page: 1 })
		await store.loadMore()

		expect(store.list.map((item) => item.id)).toContain("21")
		expect(store.page).toBe(2)
		expect(store.hasMore).toBe(false)
	})

	it("maps summary filter to merging phase in request payload", async () => {
		const store = new AudioRecordingsStore()
		store.setSummaryFilter("not_summarized")

		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({ list: [], total: 0 })

		await store.fetchList({ page: 1 })

		expect(SuperMagicApi.queryAudioProjects).toHaveBeenCalledWith(
			expect.objectContaining({
				current_phase: ["merging"],
				is_hidden: 0,
			}),
		)
	})

	it("marks merging completed items as not summarized", async () => {
		const store = new AudioRecordingsStore()
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [
				createApiItem("1", {
					project_status: "",
					extra: {
						duration: 379,
						current_phase: "merging",
						phase_status: "completed",
						audio_source: "imported",
						device_id: "Redmi K70 Ultra",
						tags: [],
					},
				}),
			],
			total: 1,
		})

		await store.fetchList({ page: 1 })

		expect(store.list[0]?.duration).toBe(379)
		expect(store.list[0]?.card_status).toBe("not_summarized")
		expect(store.list[0]?.is_summarized).toBe(false)
	})

	it("excludes waiting and merging in progress items from the list", async () => {
		const store = new AudioRecordingsStore()
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [
				createApiItem("waiting", {
					project_status: "",
					extra: {
						duration: 60,
						current_phase: "waiting",
						phase_status: "in_progress",
						tags: [],
					},
				}),
				createApiItem("merging", {
					project_status: "",
					extra: {
						duration: 90,
						current_phase: "merging",
						phase_status: "in_progress",
						tags: [],
					},
				}),
				createApiItem("done", {
					project_status: "finished",
					extra: {
						duration: 120,
						current_phase: "summarizing",
						phase_status: "completed",
						tags: [],
					},
				}),
			],
			total: 3,
		})

		await store.fetchList({ page: 1 })

		expect(store.list).toHaveLength(1)
		expect(store.list[0]?.id).toBe("done")
		expect(store.hasMore).toBe(false)
	})

	it("stops pagination when all items on page 1 are filtered out but total is positive", async () => {
		const store = new AudioRecordingsStore()
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [
				createApiItem("app-processing", {
					project_status: "",
					extra: {
						duration: 60,
						current_phase: "merging",
						phase_status: "in_progress",
						tags: [],
					},
				}),
			],
			total: 1,
		})

		await store.fetchList({ page: 1 })

		expect(store.list).toHaveLength(0)
		expect(store.hasMore).toBe(false)
		expect(SuperMagicApi.queryAudioProjects).toHaveBeenCalledTimes(1)
	})

	it("does not load more after client summary tab filters out the only visible item", async () => {
		const store = new AudioRecordingsStore()
		store.setSummaryFilter("summarized")
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [
				createApiItem("summarizing", {
					project_status: "",
					extra: {
						duration: 120,
						current_phase: "summarizing",
						phase_status: "in_progress",
						tags: [],
					},
				}),
			],
			total: 1,
		})

		await store.fetchList({ page: 1 })

		expect(store.list).toHaveLength(0)
		expect(store.hasMore).toBe(false)
	})

	it("optimistically updates item after submitSummary for imported audio", async () => {
		const store = new AudioRecordingsStore()
		const item: AudioProjectListItem = {
			id: "project-1",
			project_name: "Import demo",
			created_at: 1780657155,
			duration: 120,
			tags: [],
			device_id: "device",
			audio_source: "imported",
			current_phase: "merging",
			phase_status: "completed",
			card_status: "not_summarized",
			is_summarized: false,
			task_key: "session-Android-1",
			topic_id: "topic-1",
			audio_file_id: "file-1",
			model_id: "model-1",
		}

		store.list = [item]
		vi.mocked(SuperMagicApi.getRecordingSummaryResult).mockResolvedValue({
			success: true,
			task_key: "session-Android-1",
			project_id: "project-1",
			chat_topic_id: "",
			conversation_id: "",
			topic_id: "topic-1",
			project_name: "Import demo",
			workspace_name: "",
		})

		await store.submitSummary(item)

		expect(SuperMagicApi.getRecordingSummaryResult).toHaveBeenCalledWith(
			expect.objectContaining({
				project_id: "project-1",
				topic_id: "topic-1",
				file_id: "file-1",
				model_id: "model-1",
			}),
		)
		expect(store.list[0]?.card_status).toBe("summarizing")
		expect(store.list[0]?.phase_status).toBe("in_progress")
		expect(summaryProgressPollerMock.addTask).toHaveBeenCalledWith("session-Android-1")
	})

	it("uses API auto model when extra.model_id is missing", async () => {
		const store = new AudioRecordingsStore()
		const item: AudioProjectListItem = {
			id: "project-2",
			project_name: "Recorded demo",
			created_at: 1780657155,
			duration: 120,
			tags: [],
			device_id: "device",
			audio_source: "recorded",
			current_phase: "merging",
			phase_status: "completed",
			card_status: "not_summarized",
			is_summarized: false,
			task_key: "session-Android-2",
			topic_id: "topic-2",
		}

		store.list = [item]
		vi.mocked(resolveAutoSummaryModelId).mockResolvedValue("auto-model-from-api")
		vi.mocked(SuperMagicApi.summarizeRecordedTask).mockResolvedValue({
			success: true,
			task_key: "session-Android-2",
		})

		await store.submitSummary(item)

		expect(resolveAutoSummaryModelId).toHaveBeenCalled()
		expect(SuperMagicApi.summarizeRecordedTask).toHaveBeenCalledWith({
			task_key: "session-Android-2",
			topic_id: "topic-2",
			model_id: "auto-model-from-api",
		})
	})

	it("patches list item when progress reports summarizing completed", () => {
		const store = new AudioRecordingsStore()
		store.list = [
			{
				id: "project-1",
				project_name: "Demo",
				created_at: 1780657155,
				duration: 120,
				tags: [],
				device_id: "device",
				audio_source: "recorded",
				current_phase: "summarizing",
				phase_status: "in_progress",
				card_status: "summarizing",
				is_summarized: false,
				task_key: "session-Android-1",
			},
		]

		store.patchListItemFromProgress({
			exists: true,
			task_key: "session-Android-1",
			project_id: "project-1",
			current_phase: "summarizing",
			phase_status: "completed",
			phase_percent: 100,
		})

		expect(store.list[0]?.card_status).toBe("summarized")
		expect(store.list[0]?.is_summarized).toBe(true)
	})

	it("filters summarized tab to completed items only", async () => {
		const store = new AudioRecordingsStore()
		store.setSummaryFilter("summarized")

		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [
				createApiItem("in-progress", {
					project_status: "",
					extra: {
						duration: 60,
						current_phase: "summarizing",
						phase_status: "in_progress",
						tags: [],
					},
				}),
				createApiItem("finished", {
					project_status: "finished",
					extra: {
						duration: 120,
						current_phase: "summarizing",
						phase_status: "completed",
						tags: [],
					},
				}),
			],
			total: 2,
		})

		await store.fetchList({ page: 1 })

		expect(store.list).toHaveLength(1)
		expect(store.list[0]?.id).toBe("finished")
		expect(store.list[0]?.card_status).toBe("summarized")
	})

	it("renames a project and patches the local list", async () => {
		const store = new AudioRecordingsStore()
		store.list = [
			{
				id: "project-1",
				project_name: "Old name",
				created_at: 1780657155,
				duration: 120,
				tags: [],
				device_id: "Device",
				audio_source: "recorded",
				current_phase: "summarizing",
				phase_status: "completed",
				card_status: "summarized",
				is_summarized: true,
			},
		]

		vi.mocked(SuperMagicApi.editProject).mockResolvedValue({ project_name: "New name" })

		const success = await store.renameProject("project-1", "New name")

		expect(success).toBe(true)
		expect(SuperMagicApi.editProject).toHaveBeenCalledWith({
			id: "project-1",
			project_name: "New name",
			project_description: "",
		})
		expect(store.list[0]?.project_name).toBe("New name")
	})

	it("deletes a project via batch-delete API and removes it from the local list", async () => {
		const store = new AudioRecordingsStore()
		store.list = [
			{
				id: "project-1",
				project_name: "Recording",
				created_at: 1780657155,
				duration: 120,
				tags: [],
				device_id: "Device",
				audio_source: "recorded",
				current_phase: "summarizing",
				phase_status: "completed",
				card_status: "summarized",
				is_summarized: true,
			},
		]

		vi.mocked(SuperMagicApi.batchDeleteProjects).mockResolvedValue(undefined)

		const success = await store.deleteProject("project-1")

		expect(success).toBe(true)
		expect(SuperMagicApi.batchDeleteProjects).toHaveBeenCalledWith({
			project_ids: ["project-1"],
		})
		expect(store.list).toHaveLength(0)
	})

	it("batch-deletes multiple projects and updates total count", async () => {
		const store = new AudioRecordingsStore()
		store.list = [
			{
				id: "project-1",
				project_name: "Recording 1",
				created_at: 1780657155,
				duration: 120,
				tags: [],
				device_id: "Device",
				audio_source: "recorded",
				current_phase: "summarizing",
				phase_status: "completed",
				card_status: "summarized",
				is_summarized: true,
			},
			{
				id: "project-2",
				project_name: "Recording 2",
				created_at: 1780657156,
				duration: 90,
				tags: [],
				device_id: "Device",
				audio_source: "recorded",
				current_phase: "summarizing",
				phase_status: "completed",
				card_status: "summarized",
				is_summarized: true,
			},
		]

		vi.mocked(SuperMagicApi.batchDeleteProjects).mockResolvedValue(undefined)

		const success = await store.batchDeleteProjects(["project-1", "project-2"])

		expect(success).toBe(true)
		expect(SuperMagicApi.batchDeleteProjects).toHaveBeenCalledWith({
			project_ids: ["project-1", "project-2"],
		})
		expect(store.list).toHaveLength(0)
	})
})
