import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { AudioProjectApiItem } from "@/types/audioProject"
import { AudioRecordingsService } from "@/services/audioRecordings/AudioRecordingsService"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		queryAudioProjects: vi.fn(),
		editProject: vi.fn(),
		batchDeleteProjects: vi.fn(),
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
			device_id: "Redmi K70 Ultra",
			audio_source: "recorded",
			current_phase: "summarizing",
			phase_status: "completed",
			tags: [],
		},
		...overrides,
	}
}

describe("AudioRecordingsService", () => {
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
})
