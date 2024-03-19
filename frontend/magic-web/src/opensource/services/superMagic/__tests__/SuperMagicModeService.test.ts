import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ModelItem } from "@/opensource/pages/superMagic/components/MessageEditor/types"
import { ModelStatusEnum } from "@/opensource/pages/superMagic/components/MessageEditor/types"
import { IconType } from "@/opensource/pages/superMagic/components/AgentSelector/types"
import { MODEL_TYPE_IMAGE, MODEL_TYPE_LLM } from "@/opensource/apis/modules/org-ai-model-provider"

vi.mock("@/opensource/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "test-org",
			userInfo: {
				user_id: "test-user",
			},
		},
	},
}))

vi.mock("@/opensource/utils/storage", () => ({
	platformKey: (value: string) => value,
}))

vi.mock("@/opensource/models/config", () => ({
	configStore: {
		i18n: {
			language: "zh_CN",
		},
	},
}))

vi.mock("@/opensource/stores/interface", () => ({
	interfaceStore: {
		isMobile: false,
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getCrewList: vi.fn(),
	},
}))

vi.mock("../SuperMagicCustomModelService", () => ({
	default: {
		findMyModelById: vi.fn(async () => null),
		toModelItem: vi.fn((model) => ({
			id: model.id,
			group_id: "",
			model_id: model.model_id,
			model_name: model.name,
			provider_model_id: model.model_id,
			model_description: model.description ?? "",
			model_icon: model.icon ?? "",
			model_status: ModelStatusEnum.Normal,
			sort: 0,
		})),
	},
}))

import superMagicModeService from "../SuperMagicModeService"
import superMagicCustomModelService from "../SuperMagicCustomModelService"

function createModelItem({
	id,
	modelId,
	name,
}: {
	id: string
	modelId: string
	name: string
}): ModelItem {
	return {
		id,
		group_id: "group-1",
		model_id: modelId,
		model_name: name,
		provider_model_id: modelId,
		model_description: `${name} description`,
		model_icon: "",
		model_status: ModelStatusEnum.Normal,
		sort: 1,
	}
}

describe("SuperMagicModeService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		superMagicModeService._modeMap = new Map([
			[
				"general",
				{
					mode: {
						id: "general",
						name: "General",
						identifier: "general",
						icon: "",
						color: "",
						icon_url: "",
						icon_type: IconType.Icon,
						sort: 1,
						playbooks: [],
					},
					agent: {
						type: 1,
						category: "frequent",
					},
					groups: [
						{
							group: {
								id: "group-1",
								mode_id: "general",
								icon: "",
								color: "",
								name: "group",
								description: "",
								sort: 1,
								status: true,
								created_at: "",
							},
							models: [
								createModelItem({
									id: "official-1",
									modelId: "shared-model",
									name: "Official Shared Model",
								}),
							],
							image_models: [
								createModelItem({
									id: "official-image-1",
									modelId: "shared-image-model",
									name: "Official Shared Image Model",
								}),
							],
						},
					],
				},
			],
		])
	})

	it("prefers custom language model over official model", async () => {
		vi.mocked(superMagicCustomModelService.findMyModelById).mockResolvedValue({
			id: "custom-1",
			name: "Custom Shared Model",
			model_id: "shared-model",
			model_type: MODEL_TYPE_LLM,
			category: "llm",
			service_provider_config_id: "provider-1",
			description: "Custom description",
			icon: "custom-icon",
		})

		const resolved = await superMagicModeService.resolveModelByMode({
			mode: "general",
			modelId: "shared-model",
			modelType: MODEL_TYPE_LLM,
		})

		expect(superMagicCustomModelService.findMyModelById).toHaveBeenCalledWith({
			modelId: "shared-model",
			modelType: MODEL_TYPE_LLM,
		})
		expect(resolved?.id).toBe("custom-1")
		expect(resolved?.model_name).toBe("Custom Shared Model")
	})

	it("prefers custom image model over official image model", async () => {
		vi.mocked(superMagicCustomModelService.findMyModelById).mockResolvedValue({
			id: "custom-image-1",
			name: "Custom Shared Image Model",
			model_id: "shared-image-model",
			model_type: MODEL_TYPE_IMAGE,
			category: "vlm",
			service_provider_config_id: "provider-2",
			description: "Custom image description",
			icon: "custom-image-icon",
		})

		const resolved = await superMagicModeService.resolveModelByMode({
			mode: "general",
			modelId: "shared-image-model",
			modelType: MODEL_TYPE_IMAGE,
		})

		expect(resolved?.id).toBe("custom-image-1")
		expect(resolved?.model_name).toBe("Custom Shared Image Model")
	})
})
