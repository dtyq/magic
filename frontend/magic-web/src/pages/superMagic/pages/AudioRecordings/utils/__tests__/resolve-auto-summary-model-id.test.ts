import { beforeEach, describe, expect, it, vi } from "vitest"
import { ModelStatusEnum } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		fetchModeList: vi.fn(),
		getModelListByMode: vi.fn(),
	},
}))

import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { resolveAutoSummaryModelId } from "../resolve-auto-summary-model-id"

describe("resolveAutoSummaryModelId", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(superMagicModeService.fetchModeList).mockResolvedValue([])
	})

	it("returns auto model_id from summary mode list API", async () => {
		vi.mocked(superMagicModeService.getModelListByMode).mockReturnValue([
			{
				id: "gpt-4",
				group_id: "group-1",
				model_id: "gpt-4",
				model_name: "GPT-4",
				provider_model_id: "gpt-4",
				model_description: "",
				model_icon: "",
				sort: 1,
				model_status: ModelStatusEnum.Normal,
			},
			{
				id: "auto",
				group_id: "group-1",
				model_id: "auto-model-from-api",
				model_name: "auto",
				provider_model_id: "auto",
				model_description: "",
				model_icon: "",
				sort: 0,
				model_status: ModelStatusEnum.Normal,
			},
		])

		const modelId = await resolveAutoSummaryModelId()

		expect(superMagicModeService.fetchModeList).toHaveBeenCalled()
		expect(superMagicModeService.getModelListByMode).toHaveBeenCalledWith(TopicMode.RecordSummary)
		expect(modelId).toBe("auto-model-from-api")
	})

	it("returns undefined when summary mode list has no auto model", async () => {
		vi.mocked(superMagicModeService.getModelListByMode).mockReturnValue([
			{
				id: "gpt-4",
				group_id: "group-1",
				model_id: "gpt-4",
				model_name: "GPT-4",
				provider_model_id: "gpt-4",
				model_description: "",
				model_icon: "",
				sort: 1,
				model_status: ModelStatusEnum.Normal,
			},
		])

		const modelId = await resolveAutoSummaryModelId()

		expect(modelId).toBeUndefined()
	})
})
