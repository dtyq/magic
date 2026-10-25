import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ContextStyleToolbar } from "../ContextStyleToolbar"

const { mockUpdateStyle, mockSelectedElement, mockStylePanelStore } = vi.hoisted(() => {
	return {
		mockUpdateStyle: vi.fn(),
		mockSelectedElement: {
			current: {
				selector: "h1.title",
				tagName: "h1",
				isTextElement: true,
				hasDirectTextContent: true,
				computedStyles: {
					fontWeight: "400",
					fontStyle: "normal",
					textDecoration: "none",
					textAlign: "center",
					color: "#000000",
					fontSize: "131px",
					lineHeight: "125.76px",
					display: "block",
				},
			},
		},
		mockStylePanelStore: {
			selectedElements: [] as Array<unknown>,
			textSelection: null,
			getSelectedSelectors: () => ["h1.title"],
			setPreviewRect: vi.fn(),
			rememberMoreStylesTab: vi.fn(),
		},
	}
})

vi.mock("@dtyq/magic-admin", () => ({}))
vi.mock("@dtyq/magic-admin/components", () => ({}))
vi.mock("@dtyq/magic-admin/provider", () => ({}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init() {
			// noop
		},
	},
}))

vi.mock("../hooks/useSelectedElement", () => ({
	useSelectedElement: function useSelectedElement() {
		return {
			selectedElement: mockSelectedElement.current,
			updateStyle: mockUpdateStyle,
		}
	},
}))

vi.mock("../../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => mockStylePanelStore,
}))

vi.mock("../controls", async () => {
	const { TextFormatTools } = await import("../controls/TextFormatTools")

	return {
		TextFormatTools,
		ElementActions: () => <div data-testid="element-actions" />,
		FontSizeSelector: () => <div data-testid="font-size-selector" />,
		FontSizeAdjuster: () => <div data-testid="font-size-adjuster" />,
		LineHeightSelector: () => <div data-testid="line-height-selector" />,
		TextAlignTools: ({
			mode,
			value,
			onAlign,
		}: {
			mode?: string
			value?: string
			onAlign?: (value: string) => void
		}) => (
			<button
				type="button"
				data-testid="text-align-tools"
				data-mode={mode}
				data-value={value}
				onClick={() => onAlign?.("center")}
			/>
		),

		ColorPicker: () => <div data-testid="color-picker" />,
		BackgroundImageButton: () => <div data-testid="background-image-button" />,
		ContextMorePopover: () => <div data-testid="context-more-popover" />,
		ContextToolbarMotion: ({ children }: { children: ReactNode }) => <>{children}</>,
	}
})

describe("ContextStyleToolbar text format buttons", () => {
	it("opens the selected element's navigation settings from the toolbar", () => {
		const onRevealMoreStyles = vi.fn()
		render(
			<ContextStyleToolbar
				editorRef={{ current: null }}
				onRevealMoreStyles={onRevealMoreStyles}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: "stylePanel.clickLink" }))
		expect(mockStylePanelStore.rememberMoreStylesTab).toHaveBeenCalledWith("h1.title", "link")
		expect(onRevealMoreStyles).toHaveBeenCalledOnce()
	})

	beforeEach(() => {
		mockUpdateStyle.mockReset()
		mockSelectedElement.current.computedStyles = {
			fontWeight: "400",
			fontStyle: "normal",
			textDecoration: "none",
			textAlign: "center",
			color: "#000000",
			fontSize: "131px",
			lineHeight: "125.76px",
			display: "block",
		}
	})

	it("applies fontWeight when bold is toggled on", () => {
		render(<ContextStyleToolbar editorRef={{ current: null }} />)

		fireEvent.click(screen.getByTestId("html-editor-text-format-bold-button"))

		expect(mockUpdateStyle).toHaveBeenCalledWith("fontWeight", "700")
	})

	it("applies fontStyle when italic is toggled on", () => {
		render(<ContextStyleToolbar editorRef={{ current: null }} />)

		fireEvent.click(screen.getByTestId("html-editor-text-format-italic-button"))

		expect(mockUpdateStyle).toHaveBeenCalledWith("fontStyle", "italic")
	})

	it("applies underline when none is set", () => {
		render(<ContextStyleToolbar editorRef={{ current: null }} />)

		fireEvent.click(screen.getByTestId("html-editor-text-format-underline-button"))

		expect(mockUpdateStyle).toHaveBeenCalledWith("textDecoration", "underline")
	})

	it("applies line-through when none is set", () => {
		render(<ContextStyleToolbar editorRef={{ current: null }} />)

		fireEvent.click(screen.getByTestId("html-editor-text-format-strikethrough-button"))

		expect(mockUpdateStyle).toHaveBeenCalledWith("textDecoration", "line-through")
	})

	it("keeps underline when strikethrough is toggled on", () => {
		mockSelectedElement.current.computedStyles.textDecoration = "underline"
		render(<ContextStyleToolbar editorRef={{ current: null }} />)

		fireEvent.click(screen.getByTestId("html-editor-text-format-strikethrough-button"))

		expect(mockUpdateStyle).toHaveBeenCalledWith("textDecoration", "underline line-through")
	})

	it("keeps line-through when underline is toggled on", () => {
		mockSelectedElement.current.computedStyles.textDecoration = "line-through"
		render(<ContextStyleToolbar editorRef={{ current: null }} />)

		fireEvent.click(screen.getByTestId("html-editor-text-format-underline-button"))

		expect(mockUpdateStyle).toHaveBeenCalledWith("textDecoration", "underline line-through")
	})

	it("keeps underline when strikethrough is toggled off", () => {
		mockSelectedElement.current.computedStyles.textDecoration = "underline line-through"
		render(<ContextStyleToolbar editorRef={{ current: null }} />)

		fireEvent.click(screen.getByTestId("html-editor-text-format-strikethrough-button"))

		expect(mockUpdateStyle).toHaveBeenCalledWith("textDecoration", "underline")
	})

	it("keeps line-through when underline is toggled off", () => {
		mockSelectedElement.current.computedStyles.textDecoration = "underline line-through"
		render(<ContextStyleToolbar editorRef={{ current: null }} />)

		fireEvent.click(screen.getByTestId("html-editor-text-format-underline-button"))

		expect(mockUpdateStyle).toHaveBeenCalledWith("textDecoration", "line-through")
	})

	it("shows text alignment for a text element inside a flex container", () => {
		mockSelectedElement.current = {
			...mockSelectedElement.current,
			computedStyles: Object.assign({}, mockSelectedElement.current.computedStyles, {
				textAlign: "left",
				display: "block",
				parentSelector: "div.layout",
				parentDisplay: "flex",
				parentFlexDirection: "row",
				parentJustifyContent: "flex-start",
			}),
		}

		render(<ContextStyleToolbar editorRef={{ current: null }} />)

		const alignmentTools = screen.getByTestId("text-align-tools")
		expect(alignmentTools).toHaveAttribute("data-mode", "text")
		expect(alignmentTools).toHaveAttribute("data-value", "left")

		fireEvent.click(alignmentTools)

		expect(mockUpdateStyle).toHaveBeenCalledWith("textAlign", "center")
	})
})
