import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ModelReasoningFooter, resolveReasoningFooterModel } from "../ModelReasoningFooter"
import { ModelStatusEnum, type ModelItem } from "../../types"

const { setReasoningEffort } = vi.hoisted(() => ({
	setReasoningEffort: vi.fn(),
}))

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/services/superMagic/topicModel/SuperMagicTopicModelCacheService", () => ({
	default: { getReasoningEffort: () => "high", setReasoningEffort },
}))

afterEach(() => {
	cleanup()
	setReasoningEffort.mockClear()
})

function createModel(levels: ModelItem["reasoning_effort_levels"] = ["none", "high"]): ModelItem {
	return {
		id: "qwen",
		model_id: "qwen3.7-max",
		model_name: "Qwen3.7 Max",
		model_description: "A long model description that must stay out of the effort menu.",
		model_icon: "",
		group_id: "qwen",
		provider_model_id: "qwen3.7-max",
		sort: 0,
		model_status: ModelStatusEnum.Normal,
		reasoning_effort_levels: levels,
		billing_multiplier: 5.49,
	}
}

function renderFooter(model = createModel()) {
	const onReasoningEffortChange = vi.fn()
	render(
		<div className="flex h-40 flex-col">
			<ModelReasoningFooter model={model} onReasoningEffortChange={onReasoningEffortChange} />
		</div>,
	)
	return { model, onReasoningEffortChange }
}

function hoverFooter() {
	const footer = screen.getByTestId("model-switch-reasoning-footer")
	fireEvent.pointerOver(footer, { pointerType: "mouse" })
	fireEvent.mouseOver(footer)
}

function openMenu() {
	fireEvent.click(screen.getByTestId("model-switch-reasoning-trigger"))
}

describe("resolveReasoningFooterModel", () => {
	it("uses the listed model's effort levels and keeps an explicit selection", () => {
		const selected = {
			...createModel([]),
			reasoning_effort: "none" as const,
		}
		const listed = createModel(["none", "high"])

		expect(
			resolveReasoningFooterModel({
				activeTab: "language",
				selectedModel: selected,
				groups: [{ models: [listed] }],
			}),
		).toEqual({ ...listed, reasoning_effort: "none" })
	})

	it("hides the footer on non-language tabs and keeps language models without effort levels", () => {
		const model = createModel(["high"])
		expect(
			resolveReasoningFooterModel({
				activeTab: "image",
				selectedModel: model,
				groups: [{ models: [model] }],
			}),
		).toBeNull()
		const languageModel = createModel([])
		expect(
			resolveReasoningFooterModel({
				activeTab: "language",
				selectedModel: languageModel,
				groups: [{ models: [languageModel] }],
			}),
		).toBe(languageModel)
	})
})

describe("ModelReasoningFooter (panel)", () => {
	it("sits in normal flow and shows only the saved effort, not the model name", () => {
		renderFooter()
		const footer = screen.getByTestId("model-switch-reasoning-footer")
		expect(footer.className).not.toContain("absolute")
		expect(footer.className).toContain("shrink-0")
		expect(screen.queryByText("Qwen3.7 Max")).toBeNull()
		expect(screen.getByText("messageEditor.modelSwitch.reasoning.high")).toBeTruthy()
	})

	it("opens the effort choices on click and ignores hover", () => {
		renderFooter()
		hoverFooter()
		expect(screen.queryByTestId("model-switch-reasoning-menu")).toBeNull()

		openMenu()
		expect(screen.getByTestId("model-switch-reasoning-menu")).toBeTruthy()
		expect(screen.getByTestId("model-switch-reasoning-option-default")).toBeTruthy()
		expect(screen.getByTestId("model-switch-reasoning-option-none")).toBeTruthy()
		expect(screen.getByTestId("model-switch-reasoning-option-high")).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		expect(screen.queryByTestId("model-switch-reasoning-option-low")).toBeNull()
		expect(
			screen.queryByText("A long model description that must stay out of the effort menu."),
		).toBeNull()
	})

	it("saves the selected effort without mutating the source model and closes the menu", () => {
		const { model, onReasoningEffortChange } = renderFooter()
		openMenu()
		fireEvent.click(screen.getByTestId("model-switch-reasoning-option-none"))

		expect(setReasoningEffort).toHaveBeenCalledWith(model, "none")
		expect(onReasoningEffortChange).toHaveBeenCalledWith({
			...model,
			reasoning_effort: "none",
		})
		expect(model).not.toHaveProperty("reasoning_effort")
		expect(screen.queryByTestId("model-switch-reasoning-menu")).toBeNull()
		expect(screen.getByTestId("model-switch-reasoning-trigger")).toBeTruthy()
	})

	it("treats default as an explicit choice that clears the saved effort", () => {
		const { model, onReasoningEffortChange } = renderFooter()
		openMenu()
		fireEvent.click(screen.getByTestId("model-switch-reasoning-option-default"))

		expect(setReasoningEffort).toHaveBeenCalledWith(model, undefined)
		expect(onReasoningEffortChange).toHaveBeenCalledWith({
			...model,
			reasoning_effort: null,
		})

		openMenu()
		fireEvent.click(screen.getByTestId("model-switch-reasoning-option-default"))
		expect(setReasoningEffort).toHaveBeenLastCalledWith(model, undefined)
	})

	it("shows a locked default when the model has no effort levels", () => {
		const { onReasoningEffortChange } = renderFooter(createModel([]))
		const locked = screen.getByTestId("model-switch-reasoning-locked")
		expect(locked).toHaveTextContent("messageEditor.modelSwitch.reasoning.default")
		expect(locked).toBeDisabled()
		expect(screen.queryByTestId("model-switch-reasoning-trigger")).toBeNull()

		hoverFooter()
		fireEvent.click(locked)
		expect(screen.queryByTestId("model-switch-reasoning-menu")).toBeNull()
		expect(onReasoningEffortChange).not.toHaveBeenCalled()
	})

	describe("focus handling", () => {
		it("moves focus to the current level when the menu is opened from the keyboard", () => {
			renderFooter()
			const trigger = screen.getByTestId("model-switch-reasoning-trigger")
			fireEvent.keyDown(trigger, { key: "Enter" })
			fireEvent.click(trigger)

			// 缓存里的档位是 high，键盘打开后焦点落在它上面。
			expect(document.activeElement).toBe(
				screen.getByTestId("model-switch-reasoning-option-high"),
			)
		})

		it("leaves focus alone when the menu is opened with the mouse", () => {
			renderFooter()
			const trigger = screen.getByTestId("model-switch-reasoning-trigger")
			trigger.focus()
			fireEvent.pointerDown(trigger, { pointerType: "mouse" })
			fireEvent.click(trigger)

			expect(screen.getByTestId("model-switch-reasoning-menu")).toBeTruthy()
			expect(document.activeElement).toBe(trigger)
		})
	})
})
