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
			})[key] ?? key,
	}),
}))

vi.mock("../ModelIcon", () => ({
	default: ({ model }: { model: ModelItem }) => (
		<span data-testid={`model-icon-${model.model_id}`} />
	),
}))

const createModel = (model_id: string, model_name: string): ModelItem =>
	({
		id: model_id,
		model_id,
		model_name,
	}) as ModelItem

describe("ModelPreferenceTooltip", () => {
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
})
