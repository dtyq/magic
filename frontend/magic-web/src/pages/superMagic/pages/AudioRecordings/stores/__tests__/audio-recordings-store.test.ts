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
		getSuperMagicTopicModel: vi.fn(),
		summarizeRecordedTask: vi.fn(),
		resummarizeRecordedTask: vi.fn(),
		batchTaskProgress: vi.fn(),
		editProject: vi.fn(),
		batchDeleteProjects: vi.fn(),
	},
}))

vi.mock("@/models/config/stores/theme.store", () => ({
	// The recordings store tests do not exercise theme persistence, so a stub avoids
	// pulling the storage-backed global theme store into a localStorage-less runner.
	themeStore: {
		theme: "light",
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
			device_id: "mock-recorder-device",
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

	it("defaults desktop list sorting to updated_at desc and forwards it on first fetch", async () => {
		const store = new AudioRecordingsStore()
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [],
			total: 0,
		})

		// The desktop list should align with mobile by sorting newest updates first on initial load.
		expect(store.sortBy).toBe("updated_at")
		expect(store.sortOrder).toBe("desc")

		await store.fetchList({ page: 1 })

		expect(SuperMagicApi.queryAudioProjects).toHaveBeenCalledWith(
			expect.objectContaining({
				sort_by: "updated_at",
				sort_order: "desc",
			}),
		)
	})

	it("hydrates persisted list filters before building the first query", async () => {
		const store = new AudioRecordingsStore()
		store.hydrateFiltersFromSession({
			summaryFilter: "not_summarized",
			datePreset: "week",
			sortBy: "created_at",
			sortOrder: "desc",
			searchKeyword: "mock persisted keyword",
			groupId: "mock-group-id",
		})

		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [],
			total: 0,
		})

		await store.fetchList({ page: 1, keyword: "mock persisted keyword" })

		expect(SuperMagicApi.queryAudioProjects).toHaveBeenCalledWith(
			expect.objectContaining({
				current_phase: ["waiting", "merging"],
				created_at_start: expect.any(Number),
				created_at_end: expect.any(Number),
				sort_by: "created_at",
				sort_order: "desc",
				workspace_id: "mock-group-id",
				keyword: "mock persisted keyword",
			}),
		)
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

	it("maps not_summarized filter to waiting and merging phases in request payload", async () => {
		const store = new AudioRecordingsStore()
		store.setSummaryFilter("not_summarized")

		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({ list: [], total: 0 })

		await store.fetchList({ page: 1 })

		expect(SuperMagicApi.queryAudioProjects).toHaveBeenCalledWith(
			expect.objectContaining({
				current_phase: ["waiting", "merging"],
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
						device_id: "mock-recorder-device",
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

	it("keeps waiting and merging in progress items visible on the all tab", async () => {
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
						task_key: "task-merging-visible",
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

		expect(store.list).toHaveLength(3)
		expect(store.list.map((item) => item.id)).toEqual(["waiting", "merging", "done"])
		expect(store.list.map((item) => item.card_status)).toEqual([
			"waiting",
			"processing",
			"summarized",
		])
		expect(summaryProgressPollerMock.addTask).toHaveBeenCalledWith("task-merging-visible")
		expect(store.hasMore).toBe(false)
	})

	it("keeps processing items on page 1 and still stops pagination when total is exhausted", async () => {
		const store = new AudioRecordingsStore()
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [
				createApiItem("app-processing", {
					project_status: "",
					extra: {
						duration: 60,
						current_phase: "merging",
						phase_status: "in_progress",
						task_key: "task-app-processing",
						tags: [],
					},
				}),
			],
			total: 1,
		})

		await store.fetchList({ page: 1 })

		expect(store.list).toHaveLength(1)
		expect(store.list[0]?.card_status).toBe("processing")
		expect(summaryProgressPollerMock.addTask).toHaveBeenCalled()
		expect(store.hasMore).toBe(false)
		expect(SuperMagicApi.queryAudioProjects).toHaveBeenCalledTimes(1)
	})

	it("keeps processing items in the not_summarized tab", async () => {
		const store = new AudioRecordingsStore()
		store.setSummaryFilter("not_summarized")
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [
				createApiItem("processing", {
					project_status: "",
					extra: {
						duration: 90,
						current_phase: "merging",
						phase_status: "in_progress",
						tags: [],
						task_key: "task-processing",
					},
				}),
				createApiItem("ready", {
					project_status: "",
					extra: {
						duration: 120,
						current_phase: "merging",
						phase_status: "completed",
						tags: [],
					},
				}),
			],
			total: 2,
		})

		await store.fetchList({ page: 1 })

		expect(store.list.map((item) => item.id)).toEqual(["processing", "ready"])
		expect(store.list.map((item) => item.card_status)).toEqual(["processing", "not_summarized"])
	})

	it("keeps waiting items in the not_summarized tab", async () => {
		const store = new AudioRecordingsStore()
		store.setSummaryFilter("not_summarized")
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [
				createApiItem("waiting", {
					project_status: "",
					extra: {
						duration: 30,
						current_phase: "waiting",
						phase_status: "in_progress",
						tags: [],
					},
				}),
				createApiItem("processing", {
					project_status: "",
					extra: {
						duration: 90,
						current_phase: "merging",
						phase_status: "in_progress",
						task_key: "task-processing",
						tags: [],
					},
				}),
				createApiItem("ready", {
					project_status: "",
					extra: {
						duration: 120,
						current_phase: "merging",
						phase_status: "completed",
						tags: [],
					},
				}),
			],
			total: 3,
		})

		await store.fetchList({ page: 1 })

		expect(store.list.map((item) => item.id)).toEqual(["waiting", "processing", "ready"])
		expect(store.list.map((item) => item.card_status)).toEqual([
			"waiting",
			"processing",
			"not_summarized",
		])
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

	it("optimistically updates matching optimistic item after submitSummary when authoritative row has not landed yet", async () => {
		const store = new AudioRecordingsStore()
		const item: AudioProjectListItem = {
			id: "project-opt-1",
			project_name: "Import optimistic",
			created_at: 1780657155,
			duration: 120,
			tags: [],
			device_id: "device",
			audio_source: "imported",
			current_phase: "merging",
			phase_status: "completed",
			card_status: "not_summarized",
			is_summarized: false,
			task_key: "session-Android-opt-1",
			topic_id: "topic-opt-1",
			audio_file_id: "file-opt-1",
			model_id: "model-1",
		}

		store.optimisticItems = [item]
		vi.mocked(SuperMagicApi.getRecordingSummaryResult).mockResolvedValue({
			success: true,
			task_key: "session-Android-opt-1",
			project_id: "project-opt-1",
			chat_topic_id: "",
			conversation_id: "",
			topic_id: "topic-opt-1",
			project_name: "Import optimistic",
			workspace_name: "",
		})

		await store.submitSummary(item)

		expect(store.optimisticItems[0]?.card_status).toBe("summarizing")
		expect(store.optimisticItems[0]?.phase_status).toBe("in_progress")
		expect(summaryProgressPollerMock.addTask).toHaveBeenCalledWith("session-Android-opt-1")
	})

	it("uses API auto model when extra.model_id is missing", async () => {
		const store = new AudioRecordingsStore()
		const item: AudioProjectListItem = {
			id: "project-2",
			project_name: "Mock recorded entry",
			created_at: 1780657155,
			duration: 120,
			tags: [],
			device_id: "mock-device",
			audio_source: "recorded",
			current_phase: "merging",
			phase_status: "completed",
			card_status: "not_summarized",
			is_summarized: false,
			task_key: "session-Android-2",
			topic_id: "topic-2",
		}

		store.list = [item]
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({})
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

	it("uses default_audio recording setting model before API auto model", async () => {
		const store = new AudioRecordingsStore()
		const item: AudioProjectListItem = {
			id: "mock-project-recording-setting",
			project_name: "Mock recording setting entry",
			created_at: 1780657155,
			duration: 120,
			tags: [],
			device_id: "mock-device",
			audio_source: "recorded",
			current_phase: "merging",
			phase_status: "completed",
			card_status: "not_summarized",
			is_summarized: false,
			task_key: "mock-session-recording-setting",
			topic_id: "mock-topic-recording-setting",
		}

		store.list = [item]
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
			model: { model_id: "mock-top-level-model" },
			extra: {
				model: { model_id: "mock-default-audio-model" },
			},
		})
		vi.mocked(SuperMagicApi.summarizeRecordedTask).mockResolvedValue({
			success: true,
			task_key: "mock-session-recording-setting",
		})

		await store.submitSummary(item)

		expect(SuperMagicApi.getSuperMagicTopicModel).toHaveBeenCalledWith({
			topic_id: "default_audio",
		})
		expect(resolveAutoSummaryModelId).not.toHaveBeenCalled()
		expect(SuperMagicApi.summarizeRecordedTask).toHaveBeenCalledWith({
			task_key: "mock-session-recording-setting",
			topic_id: "mock-topic-recording-setting",
			model_id: "mock-default-audio-model",
		})
	})

	it("resubmits summary with model only and starts polling", async () => {
		const store = new AudioRecordingsStore()
		const item: AudioProjectListItem = {
			id: "mock-project-resummary",
			project_name: "Mock resummary entry",
			created_at: 1780657155,
			duration: 120,
			tags: [],
			device_id: "mock-device",
			audio_source: "recorded",
			current_phase: "summarizing",
			phase_status: "failed",
			card_status: "summary_failed",
			is_summarized: false,
			task_key: "mock-task-key-resummary",
			topic_id: "mock-topic-resummary",
			model_id: "mock-model-resummary",
		}

		store.list = [item]
		vi.mocked(SuperMagicApi.resummarizeRecordedTask).mockResolvedValue({
			success: true,
			task_key: "mock-task-key-resummary",
		})

		await store.resubmitSummary(item)

		expect(SuperMagicApi.resummarizeRecordedTask).toHaveBeenCalledWith({
			task_key: "mock-task-key-resummary",
			model_id: "mock-model-resummary",
		})
		expect(store.list[0]?.card_status).toBe("summarizing")
		expect(store.list[0]?.phase_status).toBe("in_progress")
		expect(summaryProgressPollerMock.addTask).toHaveBeenCalledWith("mock-task-key-resummary")
	})

	it("optimistically marks resummary as summarizing before API resolves", async () => {
		const store = new AudioRecordingsStore()
		const item: AudioProjectListItem = {
			id: "mock-project-resummary-pending",
			project_name: "Mock pending resummary entry",
			created_at: 1780657155,
			duration: 120,
			tags: [],
			device_id: "mock-device",
			audio_source: "recorded",
			current_phase: "summarizing",
			phase_status: "failed",
			card_status: "summary_failed",
			is_summarized: false,
			task_key: "mock-task-key-resummary-pending",
			topic_id: "mock-topic-resummary-pending",
			model_id: "mock-model-resummary-pending",
		}
		let resolveRequest: ((value: { success: boolean; task_key: string }) => void) | undefined

		store.list = [item]
		vi.mocked(SuperMagicApi.resummarizeRecordedTask).mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve
			}),
		)

		const submitPromise = store.resubmitSummary(item)

		expect(store.list[0]?.card_status).toBe("summarizing")
		expect(store.list[0]?.phase_status).toBe("in_progress")
		// Item already exists in authoritative list — should not be duplicated in optimisticItems
		expect(store.optimisticItems).toHaveLength(0)
		if (!resolveRequest) throw new Error("mock resummary resolver was not initialized")
		resolveRequest({
			success: true,
			task_key: "mock-task-key-resummary-pending",
		})
		await submitPromise
	})

	it("rolls back optimistic resummary state when API submission fails", async () => {
		const store = new AudioRecordingsStore()
		const item: AudioProjectListItem = {
			id: "mock-project-resummary-failed-submit",
			project_name: "Mock failed resummary submit entry",
			created_at: 1780657155,
			duration: 120,
			tags: [],
			device_id: "mock-device",
			audio_source: "recorded",
			current_phase: "summarizing",
			phase_status: "failed",
			card_status: "summary_failed",
			is_summarized: false,
			task_key: "mock-task-key-resummary-failed-submit",
			topic_id: "mock-topic-resummary-failed-submit",
			model_id: "mock-model-resummary-failed-submit",
		}

		store.list = [item]
		vi.mocked(SuperMagicApi.resummarizeRecordedTask).mockRejectedValue(
			new Error("mock resummary submit failure"),
		)

		const result = await store.resubmitSummary(item)

		expect(result).toEqual({ ok: false, reason: "api" })
		expect(store.list[0]).toMatchObject({
			card_status: "summary_failed",
			phase_status: "failed",
		})
		expect(store.optimisticItems.some((entry) => entry.id === item.id)).toBe(false)
		expect(summaryProgressPollerMock.addTask).not.toHaveBeenCalledWith(
			"mock-task-key-resummary-failed-submit",
		)
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

	it("keeps progress summarizing when previous list item still has finished flags", () => {
		const store = new AudioRecordingsStore()
		store.list = [
			{
				id: "mock-project-progress-resummary",
				project_name: "Mock progress resummary",
				created_at: 1780657155,
				duration: 120,
				tags: [],
				device_id: "mock-device",
				audio_source: "recorded",
				current_phase: "summarizing",
				phase_status: "completed",
				card_status: "summarized",
				is_summarized: true,
				project_status: "finished",
				current_topic_status: "finished",
				task_key: "mock-task-progress-resummary",
			},
		]

		store.patchListItemFromProgress({
			exists: true,
			task_key: "mock-task-progress-resummary",
			project_id: "mock-project-progress-resummary",
			current_phase: "summarizing",
			phase_status: "in_progress",
			phase_percent: 0,
		})

		expect(store.list[0]?.card_status).toBe("summarizing")
		expect(store.list[0]?.phase_status).toBe("in_progress")
		expect(store.list[0]?.is_summarized).toBe(false)
	})

	it("patches list item duration from progress duration_seconds", () => {
		const store = new AudioRecordingsStore()
		store.list = [
			{
				id: "project-1",
				project_name: "Mock recording",
				created_at: 1780657155,
				duration: 0,
				tags: [],
				device_id: "mock-device",
				audio_source: "recorded",
				current_phase: "summarizing",
				phase_status: "in_progress",
				card_status: "summarizing",
				is_summarized: false,
				task_key: "session-mock-duration",
			},
		]

		store.patchListItemFromProgress({
			exists: true,
			task_key: "session-mock-duration",
			project_id: "project-1",
			current_phase: "summarizing",
			phase_status: "in_progress",
			duration_seconds: 23,
		})

		expect(store.list[0]?.duration).toBe(23)
		expect(store.list[0]?.card_status).toBe("summarizing")
	})

	it("patches optimistic item duration from progress duration_seconds", () => {
		const store = new AudioRecordingsStore()
		store.optimisticItems = [
			{
				id: "project-optimistic",
				project_name: "Mock optimistic recording",
				created_at: 1780657155,
				duration: 0,
				tags: [],
				device_id: "mock-device",
				audio_source: "recorded",
				current_phase: "summarizing",
				phase_status: "in_progress",
				card_status: "summarizing",
				is_summarized: false,
				task_key: "session-mock-optimistic-duration",
			},
		]

		store.patchListItemFromProgress({
			exists: true,
			task_key: "session-mock-optimistic-duration",
			project_id: "project-optimistic",
			current_phase: "summarizing",
			phase_status: "in_progress",
			duration_seconds: 45,
		})

		expect(store.optimisticItems[0]?.duration).toBe(45)
		expect(store.optimisticItems[0]?.card_status).toBe("summarizing")
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

vi.mock("@/services/recordSummary/projectDeletionRecordingGuard", () => ({
	assertProjectDeletionAllowed: vi.fn(),
	ProjectDeletionBlockedByRecordingError: class extends Error {},
}))
