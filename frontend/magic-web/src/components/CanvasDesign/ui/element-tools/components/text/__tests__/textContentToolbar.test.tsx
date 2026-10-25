import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ElementTypeEnum, type TextElement } from "../../../../../runtime/document/types"
import RichTextAdvancedButton from "../RichTextAdvancedButton"
import RichTextTextAlign from "../RichTextTextAlign"

const mocks = vi.hoisted(() => ({
	controller: {} as Record<string, unknown>,
}))

vi.mock("../../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback: string) => fallback,
	}),
}))

vi.mock("../useTextToolController", () => ({
	useTextToolController: () => mocks.controller,
}))

function createSelectedTextElement(): TextElement {
	return {
		id: "text-1",
		type: ElementTypeEnum.Text,
		activeContentId: "active-content",
		mainContentId: "main-content",
		contents: [
			{
				contentId: "active-content",
				content: [
					{
						children: [{ type: "text", text: "active" }],
						style: { lineHeight: 1.8, listType: "ordered", textAlign: "center" },
					},
				],
			},
			{
				contentId: "main-content",
				content: [
					{
						children: [{ type: "text", text: "main" }],
						style: { lineHeight: 2.2, listType: "bullet", textAlign: "right" },
					},
				],
			},
		],
	}
}

describe("text Content toolbar", () => {
	beforeEach(() => {
		mocks.controller = {
			state: {
				lineHeight: null,
				letterSpacing: null,
				underline: null,
				strikethrough: null,
				listType: null,
				textAlign: null,
			},
			selectedTextElement: createSelectedTextElement(),
			isEditingText: false,
			resolvedDefaultStyle: {},
			restoreSelection: vi.fn(),
			setLineHeight: vi.fn(),
			setLetterSpacing: vi.fn(),
			setUnderline: vi.fn(),
			setStrikethrough: vi.fn(),
			setListType: vi.fn(),
			setTextAlign: vi.fn(),
		}
	})

	it("reads alignment from the active Content instead of the main Content", () => {
		render(<RichTextTextAlign />)

		expect(screen.getByLabelText("居中对齐")).toHaveAttribute("data-selected", "true")
		expect(screen.getByLabelText("右对齐")).toHaveAttribute("data-selected", "false")
	})

	it("reads advanced paragraph metrics from the active Content", async () => {
		render(<RichTextAdvancedButton />)
		fireEvent.click(screen.getByText("高级"))

		const inputs = await screen.findAllByRole("textbox")
		expect(inputs[0]).toHaveValue("1.8")
	})
})
