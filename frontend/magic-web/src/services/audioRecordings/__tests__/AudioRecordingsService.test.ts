import { assertProjectDeletionAllowed } from "@/services/recordSummary/projectDeletionRecordingGuard"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { AudioProjectApiItem } from "@/types/audioProject"
import { AudioRecordingsService } from "@/services/audioRecordings/AudioRecordingsService"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		queryAudioProjects: vi.fn(),
		editProject: vi.fn(),
		batchDeleteProjects: vi.fn(),
		batchMoveProjects: vi.fn(),
		getRecordingSummaryResult: vi.fn(),
		summarizeRecordedTask: vi.fn(),
	},
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

vi.mock("i18next", () => {
	const chainable = {
		use: vi.fn(() => chainable),
		init: vi.fn(() => Promise.resolve()),
		changeLanguage: vi.fn(() => Promise.resolve()),
		t: (key: string) => key,
	}
	return { default: chainable }
})

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
			device_id: "mock-device-alpha",
			audio_source: "recorded",
			current_phase: "summarizing",
			phase_status: "completed",
			tags: [],
		},
		...overrides,
	}
}

describe("AudioRecordingsService", () => {
	it("does not issue any batch delete when an unfinished recording blocks one project", async () => {
		const error = new Error("unfinished recording")
		vi.mocked(assertProjectDeletionAllowed).mockImplementationOnce(() => {
			throw error
		})
		await expect(
			new AudioRecordingsService().batchDeleteProjects(["project-active", "project-2"]),
		).rejects.toBe(error)
		expect(SuperMagicApi.batchDeleteProjects).not.toHaveBeenCalled()
	})
	const service = new AudioRecordingsService()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("normalizes API rows and applies client summary filter", async () => {
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

		const result = await service.queryProjects({
			page: 1,
			pageSize: 20,
			keyword: "",
			summaryFilter: "summarized",
			sortBy: "created_at",
			sortOrder: "desc",
		})

		expect(result.list).toHaveLength(1)
		expect(result.list[0]?.id).toBe("finished")
		expect(result.list[0]?.card_status).toBe("summarized")
	})

	it("maps not_summarized filter to merging phase in request payload", async () => {
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({ list: [], total: 0 })

		await service.queryProjects({
			page: 1,
			pageSize: 20,
			keyword: "",
			summaryFilter: "not_summarized",
			sortBy: "created_at",
			sortOrder: "desc",
		})

		expect(SuperMagicApi.queryAudioProjects).toHaveBeenCalledWith(
			expect.objectContaining({
				current_phase: ["merging"],
				is_hidden: 0,
			}),
		)
	})

	it("passes workspace id and preserves workspace metadata on normalized rows", async () => {
		vi.mocked(SuperMagicApi.queryAudioProjects).mockResolvedValue({
			list: [
				createApiItem("workspace-row", {
					workspace_id: "workspace-audio-001",
					workspace_name: "Mock audio workspace",
				}),
			],
			total: 1,
		})

		const result = await service.queryProjects({
			page: 1,
			pageSize: 20,
			keyword: "",
			summaryFilter: "all",
			sortBy: "created_at",
			sortOrder: "desc",
			workspaceId: "workspace-audio-001",
		})

		expect(SuperMagicApi.queryAudioProjects).toHaveBeenCalledWith(
			expect.objectContaining({
				workspace_id: "workspace-audio-001",
			}),
		)
		expect(result.list[0]?.workspace_id).toBe("workspace-audio-001")
		expect(result.list[0]?.workspace_name).toBe("Mock audio workspace")
	})

	it("moves projects in batches of 20", async () => {
		vi.mocked(SuperMagicApi.batchMoveProjects).mockResolvedValue(undefined)
		const projectIds = Array.from({ length: 45 }, (_, index) => `project-${index + 1}`)

		await service.batchMoveProjects(projectIds, "target-workspace")

		expect(SuperMagicApi.batchMoveProjects).toHaveBeenCalledTimes(3)
		expect(SuperMagicApi.batchMoveProjects).toHaveBeenNthCalledWith(1, {
			project_ids: projectIds.slice(0, 20),
			target_workspace_id: "target-workspace",
		})
		expect(SuperMagicApi.batchMoveProjects).toHaveBeenNthCalledWith(2, {
			project_ids: projectIds.slice(20, 40),
			target_workspace_id: "target-workspace",
		})
		expect(SuperMagicApi.batchMoveProjects).toHaveBeenNthCalledWith(3, {
			project_ids: projectIds.slice(40),
			target_workspace_id: "target-workspace",
		})
	})
})

vi.mock("@/services/recordSummary/projectDeletionRecordingGuard", () => ({
	assertProjectDeletionAllowed: vi.fn(),
}))
