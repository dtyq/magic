import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ModelPreferenceTooltip } from "../ModelPreferenceTooltip"
import type { ModelItem } from "../../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"messageEditor.pleaseSelectModel": "请选择模型",
				"messageEditor.modelSwitch.tooltipLanguageModel": "语言模型",
				"messageEditor.modelSwitch.tooltipImageModel": "生图模型",
				"messageEditor.modelSwitch.tooltipVideoModel": "视频模型",
				"messageEditor.modelSwitch.reasoning.label": "思考强度",
				"messageEditor.modelSwitch.reasoning.high": "高",
			})[key] ?? key,
	}),
}))

vi.mock("../ModelIcon", () => ({
	default: ({ model }: { model: ModelItem }) => (
		<span data-testid={`model-icon-${model.model_id}`} />
	),
}))

vi.mock("@/services/superMagic/topicModel/SuperMagicTopicModelCacheService", () => ({
	default: {
		getReasoningEffort: vi.fn(() => "high"),
	},
}))

const createModel = (model_id: string, model_name: string): ModelItem =>
	({
		id: model_id,
		model_id,
		model_name,
	}) as ModelItem

describe("ModelPreferenceTooltip", () => {
	it("显式恢复默认时显示后台档位，不回读旧偏好", () => {
		render(
			<ModelPreferenceTooltip
				selectedLanguageModel={{
					...createModel("mock-model", "Mock"),
					reasoning_effort_levels: ["high"],
					reasoning_effort_default: "high",
					reasoning_effort: null,
				}}
				selectedImageModel={null}
				selectedVideoModel={null}
			/>,
		)
		expect(screen.getByText("高")).toBeInTheDocument()
	})

	it("hides model sections that do not have a selected model", () => {
		render(
			<ModelPreferenceTooltip
				selectedLanguageModel={createModel("qwen3-coder-plus", "qwen3-coder-plus")}
				selectedImageModel={createModel("qwen-image", "qwen-image")}
				selectedVideoModel={null}
			/>,
		)

		expect(screen.getByText("语言模型")).toBeInTheDocument()
		expect(screen.getByText("qwen3-coder-plus")).toBeInTheDocument()
		expect(screen.getByText("生图模型")).toBeInTheDocument()
		expect(screen.getByText("qwen-image")).toBeInTheDocument()
		expect(screen.queryByText("视频模型")).not.toBeInTheDocument()
		expect(screen.queryByText("请选择模型")).not.toBeInTheDocument()
	})

	it("shows the current reasoning effort beneath the language model", () => {
		const model = {
			...createModel("glm-5.2", "GLM 5.2"),
			reasoning_effort_levels: ["low", "high"],
			reasoning_effort: "high",
		} as ModelItem

		render(
			<ModelPreferenceTooltip
				selectedLanguageModel={model}
				selectedImageModel={null}
				selectedVideoModel={null}
			/>,
		)

		expect(screen.getByText("思考强度")).toBeInTheDocument()
		expect(screen.getByText("高")).toBeInTheDocument()
	})

	it("uses the saved reasoning effort when the model snapshot has no override", () => {
		const model = {
			...createModel("glm-5.2", "GLM 5.2"),
			reasoning_effort_levels: ["low", "high"],
		} as ModelItem

		render(
			<ModelPreferenceTooltip
				selectedLanguageModel={model}
				selectedImageModel={null}
				selectedVideoModel={null}
			/>,
		)

		expect(screen.getByText("高")).toBeInTheDocument()
	})
})
