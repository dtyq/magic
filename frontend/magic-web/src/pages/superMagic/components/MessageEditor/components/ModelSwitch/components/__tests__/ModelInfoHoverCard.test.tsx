import { useRef, type ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	MODEL_INFO_HOVER_OPEN_DELAY_MS,
	MODEL_INFO_HOVER_SCROLL_IDLE_MS,
	MODEL_INFO_HOVER_SWITCH_DELAY_MS,
	ModelInfoHoverCard,
	ModelInfoHoverProvider,
	formatContextWindow,
} from "../ModelInfoHoverCard"
import { ModelStatusEnum, type ModelItem } from "../../types"

const { setReasoningEffort } = vi.hoisted(() => ({
	setReasoningEffort: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { value?: string }) =>
			options?.value ? `${key}:${options.value}` : key,
	}),
}))
vi.mock("@/services/superMagic/topicModel/SuperMagicTopicModelCacheService", () => ({
	default: { getReasoningEffort: () => undefined, setReasoningEffort },
}))

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	setReasoningEffort.mockClear()
})

function createModel(overrides: Partial<ModelItem> = {}): ModelItem {
	return {
		id: "qwen",
		model_id: "qwen3.7-max",
		model_name: "Qwen3.7 Max",
		model_description: "Long context flagship.",
		model_icon: "",
		group_id: "qwen",
		provider_model_id: "qwen3.7-max",
		sort: 0,
		model_status: ModelStatusEnum.Normal,
		max_context_tokens: 128_000,
		billing_multiplier: 0.42,
		...overrides,
	}
}

function List({ children }: { children: ReactNode }) {
	const scrollRef = useRef<HTMLDivElement>(null)
	return (
		<div ref={scrollRef} data-testid="model-list">
			<ModelInfoHoverProvider scrollContainerRef={scrollRef}>
				{children}
			</ModelInfoHoverProvider>
		</div>
	)
}

function renderCard(model = createModel(), onReasoningEffortChange?: (model: ModelItem) => void) {
	const onSelect = vi.fn()
	render(
		<List>
			<ModelInfoHoverCard model={model} onReasoningEffortChange={onReasoningEffortChange}>
				<div data-testid="model-switch-item" onClick={() => onSelect(model)}>
					{model.model_name}
				</div>
			</ModelInfoHoverCard>
		</List>,
	)
	return { model, onSelect }
}

function renderTwoRows() {
	const first = createModel()
	const second = createModel({
		id: "glm",
		model_id: "glm-5",
		model_name: "GLM 5",
		model_description: "Second model.",
	})
	render(
		<List>
			{[first, second].map((model) => (
				<ModelInfoHoverCard key={model.model_id} model={model}>
					<div data-testid={`row-${model.model_id}`}>{model.model_name}</div>
				</ModelInfoHoverCard>
			))}
		</List>,
	)
	return {
		firstRow: screen.getByTestId("row-qwen3.7-max"),
		secondRow: screen.getByTestId("row-glm-5"),
	}
}

function advance(ms: number) {
	act(() => {
		vi.advanceTimersByTime(ms)
	})
}

function hoverRow(row: HTMLElement = screen.getByTestId("model-switch-item")) {
	fireEvent.pointerEnter(row, { pointerType: "mouse" })
	advance(MODEL_INFO_HOVER_OPEN_DELAY_MS)
}

describe("formatContextWindow", () => {
	it("formats tokens into K and M units", () => {
		expect(formatContextWindow(128_000)).toBe("128K")
		expect(formatContextWindow(1_000_000)).toBe("1M")
		expect(formatContextWindow(1_500_000)).toBe("1.5M")
		expect(formatContextWindow(512)).toBe("512")
		expect(formatContextWindow(0)).toBeNull()
		expect(formatContextWindow(null)).toBeNull()
	})
})

describe("ModelInfoHoverCard", () => {
	it("opens quickly with the model facts and no reasoning control for models without levels", () => {
		renderCard()
		expect(screen.queryByTestId("model-info-hover-card")).toBeNull()

		hoverRow()

		const card = screen.getByTestId("model-info-hover-card")
		expect(card).toHaveTextContent("Qwen3.7 Max")
		expect(card).toHaveTextContent("Long context flagship.")
		expect(card).toHaveTextContent("messageEditor.modelSwitch.contextWindow")
		expect(card).toHaveTextContent("128K")
		expect(card).toHaveTextContent("messageEditor.modelSwitch.billingMultiplier")
		expect(card).toHaveTextContent("0.42")
		expect(card).toHaveTextContent("messageEditor.modelSwitch.billingMultiplierHint")
		expect(card.querySelectorAll("button")).toHaveLength(0)
		expect(card).not.toHaveTextContent("messageEditor.modelSwitch.reasoning.label")
	})

	it("keeps the row click working and does not open the card instantly", () => {
		const { model, onSelect } = renderCard()
		fireEvent.click(screen.getByTestId("model-switch-item"))
		expect(onSelect).toHaveBeenCalledWith(model)
		expect(screen.queryByTestId("model-info-hover-card")).toBeNull()
	})

	it("offers the same reasoning selector as the footer and keeps the card open while its menu is up", () => {
		const onReasoningEffortChange = vi.fn()
		const { model } = renderCard(
			createModel({
				reasoning_effort_levels: ["low", "high"],
				reasoning_effort_default: "low",
			}),
			onReasoningEffortChange,
		)
		hoverRow()

		const card = screen.getByTestId("model-info-hover-card")
		expect(card).toHaveTextContent("messageEditor.modelSwitch.reasoning.label")
		// 后台默认是 low，没有用户覆盖时触发器上显示它。
		expect(screen.getByTestId("model-switch-reasoning-trigger")).toHaveTextContent(
			"messageEditor.modelSwitch.reasoning.low",
		)

		fireEvent.click(screen.getByTestId("model-switch-reasoning-trigger"))
		expect(screen.getByTestId("model-switch-reasoning-menu")).toBeTruthy()
		expect(screen.queryByTestId("model-switch-reasoning-option-medium")).toBeNull()

		// 菜单打开期间鼠标离开卡片，卡片仍保持打开。
		fireEvent.pointerLeave(screen.getByTestId("model-switch-item"), { pointerType: "mouse" })
		act(() => {
			vi.advanceTimersByTime(1000)
		})
		expect(screen.getByTestId("model-info-hover-card")).toBeTruthy()

		fireEvent.click(screen.getByTestId("model-switch-reasoning-option-high"))
		expect(setReasoningEffort).toHaveBeenCalledWith(model, "high")
		expect(onReasoningEffortChange).toHaveBeenCalledWith({
			...model,
			reasoning_effort: "high",
		})
		// 选完菜单关闭，卡片随之收起。
		expect(screen.queryByTestId("model-switch-reasoning-menu")).toBeNull()
		act(() => {
			vi.advanceTimersByTime(1000)
		})
		expect(screen.queryByTestId("model-info-hover-card")).toBeNull()
	})

	it("hides the reasoning selector when the card is read-only, even if the model has levels", () => {
		renderCard(createModel({ reasoning_effort_levels: ["low", "high"] }))
		hoverRow()
		expect(screen.getByTestId("model-info-hover-card")).not.toHaveTextContent(
			"messageEditor.modelSwitch.reasoning.label",
		)
	})

	it("hides the sections that have no data and skips the card entirely when nothing is left", () => {
		renderCard(createModel({ max_context_tokens: null, billing_multiplier: null }))
		hoverRow()
		const card = screen.getByTestId("model-info-hover-card")
		expect(card).not.toHaveTextContent("messageEditor.modelSwitch.contextWindow")
		expect(card).not.toHaveTextContent("messageEditor.modelSwitch.billingMultiplier")
		cleanup()

		renderCard(
			createModel({
				model_description: "",
				max_context_tokens: null,
				billing_multiplier: null,
			}),
		)
		hoverRow()
		expect(screen.queryByTestId("model-info-hover-card")).toBeNull()
		expect(screen.getByTestId("model-switch-item")).toBeTruthy()
	})

	it("keeps a single card and moves it to the next hovered row", () => {
		const { firstRow, secondRow } = renderTwoRows()
		hoverRow(firstRow)
		expect(screen.getByTestId("model-info-hover-card")).toHaveTextContent("Qwen3.7 Max")

		fireEvent.pointerLeave(firstRow, { pointerType: "mouse" })
		fireEvent.pointerEnter(secondRow, { pointerType: "mouse" })
		advance(MODEL_INFO_HOVER_SWITCH_DELAY_MS)

		const cards = screen.getAllByTestId("model-info-hover-card")
		expect(cards).toHaveLength(1)
		expect(cards[0]).toHaveTextContent("GLM 5")
		expect(cards[0]).not.toHaveTextContent("Qwen3.7 Max")
	})

	it("does not switch to rows the pointer only passes through", () => {
		const { firstRow, secondRow } = renderTwoRows()
		hoverRow(firstRow)

		fireEvent.pointerLeave(firstRow, { pointerType: "mouse" })
		fireEvent.pointerEnter(secondRow, { pointerType: "mouse" })
		advance(MODEL_INFO_HOVER_SWITCH_DELAY_MS / 2)
		fireEvent.pointerLeave(secondRow, { pointerType: "mouse" })
		// 鼠标随即进入卡片，卡片保持在原来那一行上。
		fireEvent.pointerEnter(screen.getByTestId("model-info-hover-card"), {
			pointerType: "mouse",
		})
		advance(1000)

		expect(screen.getByTestId("model-info-hover-card")).toHaveTextContent("Qwen3.7 Max")
	})

	it("closes on scroll and does not open for rows passing under the pointer until scrolling settles", () => {
		const { firstRow, secondRow } = renderTwoRows()
		hoverRow(firstRow)

		fireEvent.scroll(screen.getByTestId("model-list"))
		expect(screen.queryByTestId("model-info-hover-card")).toBeNull()

		// 滚动中鼠标下掠过的行不弹卡。
		fireEvent.pointerEnter(secondRow, { pointerType: "mouse" })
		advance(MODEL_INFO_HOVER_SCROLL_IDLE_MS - 1)
		fireEvent.scroll(screen.getByTestId("model-list"))
		advance(MODEL_INFO_HOVER_OPEN_DELAY_MS)
		expect(screen.queryByTestId("model-info-hover-card")).toBeNull()

		// 停稳后鼠标再动一下，打开当前所在行的卡片。
		advance(MODEL_INFO_HOVER_SCROLL_IDLE_MS)
		fireEvent.pointerMove(secondRow, { pointerType: "mouse" })
		advance(MODEL_INFO_HOVER_OPEN_DELAY_MS)
		expect(screen.getByTestId("model-info-hover-card")).toHaveTextContent("GLM 5")
	})

	it("stays open when focus moves from a clicked row into the card's reasoning selector", () => {
		renderCard(createModel({ reasoning_effort_levels: ["low", "high"] }), vi.fn())
		const row = screen.getByTestId("model-switch-item")
		// 先点选过这一行，焦点留在行上；再悬停打开卡片。
		fireEvent.focus(row)
		hoverRow(row)
		const card = screen.getByTestId("model-info-hover-card")
		fireEvent.pointerLeave(row, { pointerType: "mouse" })
		fireEvent.pointerEnter(card, { pointerType: "mouse" })

		const trigger = screen.getByTestId("model-switch-reasoning-trigger")
		// 按下按钮时焦点从行移进卡片，行先收到 blur。
		fireEvent.blur(row, { relatedTarget: trigger })
		fireEvent.click(trigger)
		advance(1000)

		expect(screen.getByTestId("model-info-hover-card")).toBeTruthy()
		expect(screen.getByTestId("model-switch-reasoning-menu")).toBeTruthy()
	})

	it("closes only the reasoning menu when clicking a blank area of the card", () => {
		renderCard(createModel({ reasoning_effort_levels: ["low", "high"] }), vi.fn())
		hoverRow()
		const card = screen.getByTestId("model-info-hover-card")
		fireEvent.pointerLeave(screen.getByTestId("model-switch-item"), { pointerType: "mouse" })
		fireEvent.pointerEnter(card, { pointerType: "mouse" })

		fireEvent.click(screen.getByTestId("model-switch-reasoning-trigger"))
		expect(screen.getByTestId("model-switch-reasoning-menu")).toBeTruthy()
		// Radix 在下一个计时周期才开始监听外部点击。
		advance(0)

		// 点在卡片的描述区域：菜单收起，卡片保留。
		fireEvent.pointerDown(card.firstElementChild ?? card)
		advance(1000)

		expect(screen.queryByTestId("model-switch-reasoning-menu")).toBeNull()
		expect(screen.getByTestId("model-info-hover-card")).toBeTruthy()
	})
})
