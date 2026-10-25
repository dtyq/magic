import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReasoningEffortSheet } from "../ReasoningEffortSheet"
import { ModelStatusEnum, type ModelItem } from "../../types"

const { setReasoningEffort } = vi.hoisted(() => ({
	setReasoningEffort: vi.fn(),
}))

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/services/superMagic/topicModel/SuperMagicTopicModelCacheService", () => ({
	default: { getReasoningEffort: () => undefined, setReasoningEffort },
}))
vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
		visible ? <div data-testid="magic-popup">{children}</div> : null,
}))

afterEach(() => {
	cleanup()
	setReasoningEffort.mockClear()
})

function createModel(): ModelItem {
	return {
		id: "qwen",
		model_id: "qwen3.7-max",
		model_name: "Qwen3.7 Max",
		model_description: "",
		model_icon: "",
		group_id: "qwen",
		provider_model_id: "qwen3.7-max",
		sort: 0,
		model_status: ModelStatusEnum.Normal,
		reasoning_effort_levels: ["none", "high"],
		reasoning_effort_default: "high",
	}
}

describe("ReasoningEffortSheet", () => {
	it("lists default plus the model's levels and marks the effective one", () => {
		render(
			<ReasoningEffortSheet
				visible
				onClose={vi.fn()}
				model={createModel()}
				onReasoningEffortChange={vi.fn()}
			/>,
		)
		expect(screen.getByTestId("mobile-reasoning-effort-sheet")).toBeTruthy()
		expect(screen.getByTestId("model-switch-reasoning-option-default")).toBeTruthy()
		expect(screen.getByTestId("model-switch-reasoning-option-none")).toBeTruthy()
		expect(screen.getByTestId("model-switch-reasoning-option-high")).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		expect(screen.queryByTestId("model-switch-reasoning-option-low")).toBeNull()
	})

	it("saves the tapped level, reports a snapshot and closes", () => {
		const onClose = vi.fn()
		const onReasoningEffortChange = vi.fn()
		const model = createModel()
		render(
			<ReasoningEffortSheet
				visible
				onClose={onClose}
				model={model}
				onReasoningEffortChange={onReasoningEffortChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("model-switch-reasoning-option-none"))
		expect(setReasoningEffort).toHaveBeenCalledWith(model, "none")
		expect(onReasoningEffortChange).toHaveBeenCalledWith({ ...model, reasoning_effort: "none" })
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(model).not.toHaveProperty("reasoning_effort")

		fireEvent.click(screen.getByTestId("model-switch-reasoning-option-default"))
		expect(setReasoningEffort).toHaveBeenLastCalledWith(model, undefined)
		expect(onReasoningEffortChange).toHaveBeenLastCalledWith({
			...model,
			reasoning_effort: null,
		})
	})

	it("renders nothing while hidden", () => {
		render(
			<ReasoningEffortSheet
				visible={false}
				onClose={vi.fn()}
				model={createModel()}
				onReasoningEffortChange={vi.fn()}
			/>,
		)
		expect(screen.queryByTestId("mobile-reasoning-effort-sheet")).toBeNull()
	})
})
