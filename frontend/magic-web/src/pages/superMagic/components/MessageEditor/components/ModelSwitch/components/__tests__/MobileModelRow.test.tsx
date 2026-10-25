import { createRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MobileModelRow } from "../MobileModelRow"
import { ModelStatusEnum, type ModelItem } from "../../types"

vi.mock("../ModelIcon", () => ({ default: () => <span /> }))
vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
		visible ? <div data-testid="magic-popup">{children}</div> : null,
}))

beforeEach(() => {
	vi.stubGlobal(
		"ResizeObserver",
		vi.fn(() => ({
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn(),
		})),
	)
})

afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

function model(id = "mock-model"): ModelItem {
	return {
		id,
		model_id: id,
		model_name: id,
		model_description: "Mock description",
		model_icon: "",
		group_id: "mock-group",
		provider_model_id: "mock-provider",
		sort: 0,
		model_status: ModelStatusEnum.Normal,
		reasoning_effort_levels: ["none", "high"],
		billing_multiplier: 0,
	}
}

function setup(overrides: Partial<Parameters<typeof MobileModelRow>[0]> = {}) {
	const item = model()
	const props = {
		model: item,
		selected: true,
		disabled: false,
		selectedItemRef: createRef<HTMLDivElement>(),
		onSelect: vi.fn(),
		...overrides,
	}
	const result = render(<MobileModelRow {...props} />)
	return { ...result, props }
}

describe("移动端模型行", () => {
	it("只展示模型行，介绍弹层默认收起", () => {
		setup()

		expect(screen.getByTestId("mobile-model-row")).toBeTruthy()
		expect(screen.getByText("0.00×")).toBeTruthy()
		expect(screen.queryByText("Mock description")).toBeNull()
		expect(screen.queryByTestId("mobile-model-info-sheet")).toBeNull()
	})

	it("行尾的介绍入口打开与桌面悬停卡相同内容的弹层，且不触发选中", () => {
		const { props } = setup()

		fireEvent.click(screen.getByTestId("mobile-model-info-trigger"))

		expect(props.onSelect).not.toHaveBeenCalled()
		const sheet = screen.getByTestId("mobile-model-info-sheet")
		expect(sheet).toHaveTextContent("mock-model")
		expect(sheet).toHaveTextContent("Mock description")
		expect(sheet).toHaveTextContent("messageEditor.modelSwitch.billingMultiplier")
	})

	it("点击模型行只触发模型选择", () => {
		const { props } = setup()

		fireEvent.click(screen.getByRole("button", { name: "mock-model" }))

		expect(props.onSelect).toHaveBeenCalledWith(props.model)
	})

	it("禁用模型不可选择", () => {
		const { props } = setup({ disabled: true })
		const button = screen.getByRole("button", { name: "mock-model" })

		expect(button).toBeDisabled()
		fireEvent.click(button)
		expect(props.onSelect).not.toHaveBeenCalled()
	})

	it("模型名称过长时保持单行截断", () => {
		setup({ model: { ...model(), model_name: "A very long model name" } })

		expect(screen.getByText("A very long model name")).toHaveClass("truncate")
	})
})
