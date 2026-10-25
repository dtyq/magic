import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ElementToolStateProvider } from "../../../../../../app/providers/ElementToolStateProvider"
import { ElementTypeEnum, type TextElement } from "../../../../../../runtime/document/types"
import TextContentOptimizationButton from "../index"

const mockCompleteTextContent = vi.fn()
const mockElementManagerUpdate = vi.fn()

let mockSelectedTextElement: TextElement | null = null
let mockIsEditingText = false
let mockCanvas: any

vi.mock("../../../../../../app/hooks/layout/useFloatingComponent", () => ({
	useFloatingComponent: () => ({ containerRef: { current: null } }),
}))

vi.mock("../../../../../../app/hooks/layout/useOverflowChange", () => ({
	useOverflowChange: () => undefined,
}))

vi.mock("../../../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mockCanvas }),
}))

vi.mock("../../../../../../app/providers/HostUiLocaleProvider", () => ({
	useHostUiLocale: () => "zh_CN",
}))

vi.mock("../../../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback: string) => fallback,
	}),
}))

vi.mock("../../useTextToolController", () => ({
	useTextToolController: () => ({
		selectedTextElement: mockSelectedTextElement,
		isEditingText: mockIsEditingText,
	}),
}))

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
	},
}))

function TextContentOptimizationButtonHarness({ show = true }: { show?: boolean }) {
	return (
		<ElementToolStateProvider>
			{show ? <TextContentOptimizationButton /> : null}
		</ElementToolStateProvider>
	)
}

describe("TextContentOptimizationButton", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockIsEditingText = false
		mockSelectedTextElement = {
			id: "text-1",
			type: ElementTypeEnum.Text,
			x: 100,
			y: 200,
			width: 240,
			height: 80,
			zIndex: 1,
			activeContentId: "text-1-content-1",
			mainContentId: "text-1-content-1",
			contents: [
				{
					contentId: "text-1-content-1",
					content: [
						{
							children: [{ type: "text", text: "旧文案" }],
						},
					],
				},
			],
		}
		mockCanvas = {
			magicConfigManager: {
				config: {
					methods: {
						completeTextContent: mockCompleteTextContent,
					},
				},
			},
			elementManager: {
				update: mockElementManagerUpdate,
			},
			eventEmitter: {
				on: vi.fn(() => vi.fn()),
			},
		}
	})

	it("keeps the optimized text when the toolbar button unmounts before completion", async () => {
		let resolveText!: (value: { text: string }) => void
		mockCompleteTextContent.mockReturnValue(
			new Promise((resolve) => {
				resolveText = resolve
			}),
		)

		const { rerender } = render(<TextContentOptimizationButtonHarness />)

		fireEvent.click(screen.getByTestId("text-content-optimization-button"))
		rerender(<TextContentOptimizationButtonHarness show={false} />)

		await act(async () => {
			resolveText({ text: "优化后的文案" })
		})

		rerender(<TextContentOptimizationButtonHarness />)
		fireEvent.click(screen.getByTestId("text-content-optimization-button"))

		expect(await screen.findByText("优化后的文案")).toBeInTheDocument()
		expect(mockCompleteTextContent).toHaveBeenCalledTimes(1)
	})
})
