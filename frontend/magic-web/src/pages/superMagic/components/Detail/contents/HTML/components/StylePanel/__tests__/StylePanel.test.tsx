import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { StylePanel } from "../StylePanel"

const {
	mockUpdateStyle,
	mockUpdateAttributes,
	mockSelectElement,
	mockSelectedElement,
	mockStylePanelStore,
} = vi.hoisted(() => {
	const mockSelectElement = vi.fn()

	return {
		mockUpdateStyle: vi.fn(),
		mockUpdateAttributes: vi.fn().mockResolvedValue(undefined),
		mockSelectElement,
		mockSelectedElement: {
			current: {
				selector: "img.hero",
				tagName: "img",
				isImageElement: true,
				intrinsicWidth: 800,
				intrinsicHeight: 400,
				intrinsicAspectRatio: 2,
				computedStyles: {
					fontWeight: "400",
					fontStyle: "normal",
					textDecoration: "none",
					textAlign: "left",
					color: "#000000",
					width: "320px",
					height: "160px",
				},
			},
		},
		mockStylePanelStore: {
			selectedElements: [] as Array<unknown>,
			getSelectedSelectors: () => ["img.hero"],
			selectElement: mockSelectElement,
			setPreviewRect: vi.fn(),
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
			updateBatchStyles: mockUpdateStyle,
			updateAttributes: mockUpdateAttributes,
		}
	},
}))

vi.mock("../../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => mockStylePanelStore,
}))

vi.mock("@/hooks/useShowButtonText", () => ({
	useShowButtonText: () => true,
}))

vi.mock("../sections/LayoutSection", () => ({
	default: () => <div data-testid="layout-section" />,
}))

vi.mock("../sections/BackgroundSection", () => ({
	default: () => <div data-testid="background-section" />,
}))

vi.mock("../sections/BorderSection", () => ({
	default: () => <div data-testid="border-section" />,
}))

vi.mock("../sections/ShadowSection", () => ({
	default: () => <div data-testid="shadow-section" />,
}))

vi.mock("../controls", () => ({
	/** Mock style controls to keep the test focused on which toolbar entries are rendered. */
	HistoryActions: () => <div data-testid="history-actions" />,
	FontFamilySelector: () => <div data-testid="font-family-selector" />,
	FontSizeSelector: () => <div data-testid="font-size-selector" />,
	LineHeightSelector: ({
		value,
		fontSize,
		onApply,
	}: {
		value?: string
		fontSize?: string
		onApply?: (value: string) => void
	}) => (
		<button
			type="button"
			data-testid="line-height-selector"
			data-value={value}
			data-font-size={fontSize}
			onClick={() => onApply?.("1.2")}
		/>
	),
	FontSizeAdjuster: () => <div data-testid="font-size-adjuster" />,
	TextFormatTools: () => <div data-testid="text-format-tools" />,
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
	BackgroundImageButton: ({
		selectedElement,
	}: {
		selectedElement?: { isImageElement?: boolean; tagName?: string } | null
	}) =>
		selectedElement &&
		!selectedElement.isImageElement &&
		selectedElement.tagName?.toLowerCase() !== "img" ? (
			<div data-testid="background-image-button" />
		) : null,
	ElementActions: ({ itemMotion }: { itemMotion?: (children: ReactNode) => ReactNode }) =>
		itemMotion ? (
			itemMotion(<div data-testid="element-actions" />)
		) : (
			<div data-testid="element-actions" />
		),
	SizePopover: () => <div data-testid="style-popover-stylePanel.size" />,
	DimensionInput: () => <div data-testid="dimension-input" />,
	NumericDragInput: () => <div data-testid="numeric-drag-input" />,
	SpacingInput: () => <div data-testid="spacing-input" />,
	ContextToolbarMotion: ({
		children,
		open = true,
		as = "div",
	}: {
		children: ReactNode
		open?: boolean
		as?: "div" | "span"
	}) => {
		const MotionTag = as
		return (
			<MotionTag
				data-context-toolbar-motion-item="true"
				className={open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}
			>
				{children}
			</MotionTag>
		)
	},
	ContextMorePopover: ({ onReveal }: { onReveal?: () => void }) => (
		<button
			type="button"
			onClick={() => onReveal?.()}
			data-testid="style-panel-more-styles-trigger"
		>
			stylePanel.moreStyles
		</button>
	),
	StylePopoverButton: ({
		title,
		children,
		triggerTestId,
		contentTestId,
	}: {
		title: string
		children: ReactNode
		triggerTestId?: string
		contentTestId?: string
	}) => (
		<div data-testid={`style-popover-${title}`}>
			<button type="button" data-testid={triggerTestId}>
				{title}
			</button>
			<div data-testid={contentTestId}>{children}</div>
		</div>
	),
}))

describe("StylePanel", () => {
	afterEach(() => {
		cleanup()
	})

	beforeEach(() => {
		mockUpdateStyle.mockReset()
		mockUpdateAttributes.mockReset()
		mockUpdateAttributes.mockResolvedValue(undefined)
		mockSelectElement.mockReset()
		mockSelectedElement.current = {
			selector: "img.hero",
			tagName: "img",
			isImageElement: true,
			intrinsicWidth: 800,
			intrinsicHeight: 400,
			intrinsicAspectRatio: 2,
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "160px",
			},
		}
	})

	it("should render a dedicated size popover button for selected images", () => {
		render(<StylePanel editorRef={{ current: null }} />)

		expect(screen.getByTestId("style-popover-stylePanel.size")).toBeInTheDocument()
	})

	it("should keep the size control out of the context toolbar", () => {
		render(<StylePanel editorRef={{ current: null }} variant="context" />)

		expect(screen.queryByTestId("style-popover-stylePanel.size")).not.toBeInTheDocument()
		expect(screen.getByTestId("style-panel-more-styles-trigger")).toBeInTheDocument()
	})

	it("should hide text controls and show image controls for image nodes", () => {
		render(<StylePanel editorRef={{ current: null }} />)

		expect(screen.queryByTestId("font-family-selector")).not.toBeInTheDocument()
		expect(screen.queryByTestId("font-size-selector")).not.toBeInTheDocument()
		expect(screen.getByTestId("html-style-panel-image-section")).toBeInTheDocument()
		expect(screen.getByTestId("html-style-panel-layout-trigger")).toBeInTheDocument()
		expect(screen.getByTestId("html-style-panel-image-trigger")).toBeInTheDocument()
		expect(screen.getByTestId("html-style-panel-border-trigger")).toBeInTheDocument()
		expect(screen.getByTestId("html-style-panel-shadow-trigger")).toBeInTheDocument()
	})

	it("should expose a page-structure entry without a duplicate tooltip", () => {
		render(
			<StylePanel
				editorRef={{ current: null }}
				variant="global"
				domTreeOpen={false}
				onToggleDomTree={vi.fn()}
			/>,
		)

		const toggle = screen.getByTestId("html-editor-dom-tree-toggle-button")
		expect(toggle).toHaveTextContent("stylePanel.domTree.title")
		expect(toggle).toHaveAttribute("aria-label", "stylePanel.domTree.title")
		expect(toggle).toHaveAttribute("aria-expanded", "false")
		expect(toggle.className).not.toContain("bg-secondary")
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
	})

	it("should show a pressed collapse control when the sidebar is open", () => {
		render(
			<StylePanel
				editorRef={{ current: null }}
				variant="global"
				domTreeOpen
				onToggleDomTree={vi.fn()}
			/>,
		)

		const toggle = screen.getByTestId("html-editor-dom-tree-toggle-button")
		expect(toggle).toHaveTextContent("stylePanel.sidebar.collapseSection")
		expect(toggle).toHaveAttribute("aria-label", "stylePanel.sidebar.collapseSection")
		expect(toggle).toHaveAttribute("aria-expanded", "true")
		expect(toggle.className).toContain("bg-secondary")
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
	})

	it("should place toolbar-end actions before the page-structure toggle", () => {
		const toolbarEndRef = { current: null as HTMLDivElement | null }

		render(
			<StylePanel
				editorRef={{ current: null }}
				variant="global"
				domTreeOpen={false}
				onToggleDomTree={vi.fn()}
				toolbarEndRef={toolbarEndRef}
			/>,
		)

		const toolbarEnd = screen.getByTestId("html-style-panel-toolbar-end")
		const structureToggle = screen.getByTestId("html-editor-dom-tree-toggle-button")
		expect(toolbarEnd.nextElementSibling).toBe(structureToggle)
	})

	it("should show the selected tag and size in the toolbar gap", () => {
		render(
			<StylePanel
				editorRef={{ current: null }}
				variant="global"
				domTreeOpen={false}
				onToggleDomTree={vi.fn()}
			/>,
		)

		const readout = screen.getByTestId("html-editor-selection-readout")
		expect(readout).toHaveTextContent("stylePanel.domTree.semantic.image")
		expect(readout).not.toHaveTextContent("IMG")
		expect(readout).toHaveTextContent("320")
		expect(readout).toHaveTextContent("160")
		expect(screen.getByTestId("history-actions").nextElementSibling).toBe(readout)
	})

	it("should show a heading level instead of an HTML tag", () => {
		mockSelectedElement.current = {
			...mockSelectedElement.current,
			selector: "h1.title",
			tagName: "h1",
			isImageElement: false,
			isTextElement: true,
		}

		render(
			<StylePanel
				editorRef={{ current: null }}
				variant="global"
				domTreeOpen={false}
				onToggleDomTree={vi.fn()}
			/>,
		)

		const readout = screen.getByTestId("html-editor-selection-readout")
		expect(readout).toHaveTextContent("stylePanel.domTree.semantic.heading1")
		expect(readout).not.toHaveTextContent("H1")
	})

	it("should show an empty readout when nothing is selected", () => {
		mockSelectedElement.current = null

		render(
			<StylePanel
				editorRef={{ current: null }}
				variant="global"
				domTreeOpen={false}
				onToggleDomTree={vi.fn()}
			/>,
		)

		const readout = screen.getByTestId("html-editor-selection-readout")
		expect(readout).toHaveTextContent("stylePanel.selectionReadoutEmpty")
		expect(readout).not.toHaveTextContent("×")
		expect(screen.getByTestId("history-actions").nextElementSibling).toBe(readout)
	})

	it("should wrap the context toolbar and expose one more entry", () => {
		mockSelectedElement.current = {
			selector: "a.cta",
			tagName: "a",
			isTextElement: true,
			hasDirectTextContent: true,
			attributes: { href: "/docs", target: "_blank" },
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				lineHeight: "24px",
				color: "#000000",
				width: "320px",
				height: "40px",
			},
		}

		render(<StylePanel editorRef={{ current: null }} variant="context" />)

		expect(
			screen
				.getByTestId("html-editor-context-style-toolbar")
				.querySelector("[data-context-toolbar-row='0']"),
		).toBeTruthy()
		expect(
			screen
				.getByTestId("html-editor-context-style-toolbar")
				.querySelector("[data-context-toolbar-row='1']"),
		).toBeTruthy()
		expect(screen.queryByTestId("font-family-selector")).not.toBeInTheDocument()
		expect(screen.getByTestId("font-size-selector")).toBeInTheDocument()
		expect(screen.getByTestId("line-height-selector")).toHaveAttribute("data-value", "normal")
		expect(screen.getByTestId("text-format-tools")).toBeInTheDocument()
		expect(screen.getByTestId("text-align-tools")).toBeInTheDocument()
		const colorPicker = screen.getByTestId("color-picker")
		const backgroundImageButton = screen.getByTestId("background-image-button")
		expect(
			colorPicker.compareDocumentPosition(backgroundImageButton) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		expect(screen.getByTestId("style-panel-more-styles-trigger")).toBeInTheDocument()
		expect(document.querySelectorAll('[data-slot="separator"]')).toHaveLength(4)
	})

	it("shows an inline pixel line-height only when it was authored", () => {
		mockSelectedElement.current = {
			selector: "h1.title",
			tagName: "h1",
			isTextElement: true,
			hasDirectTextContent: true,
			inlineStyles: { lineHeight: "24px" },
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				lineHeight: "24px",
				fontSize: "16px",
				color: "#000000",
				width: "320px",
				height: "40px",
			},
		}

		render(<StylePanel editorRef={{ current: null }} variant="context" />)

		expect(screen.getByTestId("line-height-selector")).toHaveAttribute("data-value", "24px")
	})

	it("preserves a selected ratio when computed line-height refreshes to pixels", async () => {
		mockSelectedElement.current = {
			selector: "p.copy",
			tagName: "p",
			isTextElement: true,
			hasDirectTextContent: true,
			computedStyles: {
				fontSize: "100px",
				lineHeight: "120px",
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "120px",
			},
		}
		const { rerender } = render(<StylePanel editorRef={{ current: null }} variant="context" />)

		const lineHeightSelector = screen.getByTestId("line-height-selector")
		expect(lineHeightSelector).toHaveAttribute("data-value", "normal")
		expect(lineHeightSelector).toHaveAttribute("data-font-size", "100")

		fireEvent.click(lineHeightSelector)
		await waitFor(() => {
			expect(mockUpdateStyle).toHaveBeenCalledWith("lineHeight", "1.2")
			expect(lineHeightSelector).toHaveAttribute("data-value", "1.2")
		})

		mockSelectedElement.current = {
			...mockSelectedElement.current,
			computedStyles: {
				...mockSelectedElement.current.computedStyles,
				lineHeight: "120px",
			},
		}
		rerender(<StylePanel editorRef={{ current: null }} variant="context" />)

		await waitFor(() =>
			expect(screen.getByTestId("line-height-selector")).toHaveAttribute("data-value", "1.2"),
		)
	})

	it("discards a preserved line-height when the same selector changes externally", async () => {
		mockSelectedElement.current = {
			selector: "p.copy",
			tagName: "p",
			isTextElement: true,
			hasDirectTextContent: true,
			computedStyles: {
				fontSize: "100px",
				lineHeight: "120px",
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "120px",
			},
		}
		const { rerender } = render(<StylePanel editorRef={{ current: null }} variant="context" />)

		fireEvent.click(screen.getByTestId("line-height-selector"))
		await waitFor(() =>
			expect(screen.getByTestId("line-height-selector")).toHaveAttribute("data-value", "1.2"),
		)

		mockSelectedElement.current = {
			...mockSelectedElement.current,
			computedStyles: {
				...mockSelectedElement.current.computedStyles,
				lineHeight: "24px",
			},
		}
		rerender(<StylePanel editorRef={{ current: null }} variant="context" />)

		await waitFor(() =>
			expect(screen.getByTestId("line-height-selector")).toHaveAttribute(
				"data-value",
				"normal",
			),
		)
	})

	it("should animate element actions with the context toolbar open state", async () => {
		const { rerender } = render(
			<StylePanel
				editorRef={{ current: null }}
				variant="context"
				contextToolbarOpen={false}
			/>,
		)

		const elementActions = screen.getByTestId("element-actions")
		expect(elementActions.parentElement).toHaveClass("translate-y-2", "opacity-0")

		rerender(<StylePanel editorRef={{ current: null }} variant="context" contextToolbarOpen />)
		await waitFor(() =>
			expect(elementActions.parentElement).toHaveClass("translate-y-0", "opacity-100"),
		)
	})

	it("should keep only font-size adjustment for containers with descendant-only text", () => {
		mockSelectedElement.current = {
			selector: "div.card",
			tagName: "div",
			isTextElement: true,
			hasDirectTextContent: false,
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "120px",
			},
		}

		render(<StylePanel editorRef={{ current: null }} variant="context" />)

		expect(screen.queryByTestId("font-size-selector")).not.toBeInTheDocument()
		expect(screen.getByTestId("font-size-adjuster")).toBeInTheDocument()
		expect(screen.queryByTestId("text-format-tools")).not.toBeInTheDocument()
		expect(screen.queryByText("stylePanel.textContent")).not.toBeInTheDocument()
	})

	it("hides text content editing when a container has no direct-text metadata", () => {
		mockSelectedElement.current = {
			selector: "div.legacy-card",
			tagName: "div",
			isTextElement: true,
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "120px",
			},
		} as never

		render(<StylePanel editorRef={{ current: null }} variant="context" />)

		expect(screen.queryByText("stylePanel.textContent")).not.toBeInTheDocument()
	})

	it("should show only font-size adjustment for an empty container", () => {
		mockSelectedElement.current = {
			selector: "div.empty",
			tagName: "div",
			isTextElement: false,
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "120px",
			},
		}

		render(<StylePanel editorRef={{ current: null }} variant="context" />)

		expect(screen.queryByTestId("font-size-selector")).not.toBeInTheDocument()
		expect(screen.getByTestId("font-size-adjuster")).toBeInTheDocument()
		expect(screen.queryByTestId("text-format-tools")).not.toBeInTheDocument()
	})

	it("reveals the sidebar More Styles section from the context toolbar", () => {
		const onRevealMoreStyles = vi.fn()
		mockSelectedElement.current = {
			selector: "p.copy",
			tagName: "p",
			isTextElement: true,
			hasDirectTextContent: true,
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "40px",
			},
		}

		render(
			<StylePanel
				editorRef={{ current: null }}
				variant="context"
				onRevealMoreStyles={onRevealMoreStyles}
			/>,
		)

		fireEvent.click(screen.getByTestId("style-panel-more-styles-trigger"))
		expect(onRevealMoreStyles).toHaveBeenCalledTimes(1)
	})

	it("should expose the more styles entry in context mode", () => {
		mockSelectedElement.current = {
			selector: "p.copy",
			tagName: "p",
			isTextElement: true,
			hasDirectTextContent: true,
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "40px",
			},
		}
		render(<StylePanel editorRef={{ current: null }} variant="context" />)

		expect(screen.getByTestId("style-panel-more-styles-trigger")).toBeInTheDocument()
		expect(screen.queryByTestId("background-section")).not.toBeInTheDocument()
	})

	it("should keep text alignment for a text element inside a flex container", async () => {
		mockSelectedElement.current = {
			selector: "p.copy",
			tagName: "p",
			isTextElement: true,
			hasDirectTextContent: true,
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "40px",
				display: "block",
				parentSelector: "div.layout",
				parentDisplay: "flex",
				parentFlexDirection: "row",
				parentJustifyContent: "flex-start",
			},
		}

		render(<StylePanel editorRef={{ current: null }} />)

		const alignmentTools = screen.getByTestId("text-align-tools")
		expect(alignmentTools).toHaveAttribute("data-mode", "text")
		expect(alignmentTools).toHaveAttribute("data-value", "left")

		fireEvent.click(alignmentTools)

		await waitFor(() => {
			expect(mockUpdateStyle).toHaveBeenCalledWith("textAlign", "center")
		})
	})

	it("should hide flex alignment tools for a non-text flex item", () => {
		mockSelectedElement.current = {
			selector: "div.card",
			tagName: "div",
			isTextElement: false,
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "40px",
				display: "block",
				parentSelector: "div.layout",
				parentDisplay: "flex",
				parentFlexDirection: "row",
				parentJustifyContent: "flex-start",
			},
		}

		render(<StylePanel editorRef={{ current: null }} />)

		expect(screen.queryByTestId("text-align-tools")).not.toBeInTheDocument()
	})

	it("should keep text alignment for a regular text element", async () => {
		mockSelectedElement.current = {
			selector: "p.copy",
			tagName: "p",
			isTextElement: true,
			hasDirectTextContent: true,
			computedStyles: {
				fontWeight: "400",
				fontStyle: "normal",
				textDecoration: "none",
				textAlign: "left",
				color: "#000000",
				width: "320px",
				height: "40px",
				display: "block",
			},
		}

		render(<StylePanel editorRef={{ current: null }} />)
		fireEvent.click(screen.getByTestId("text-align-tools"))

		await waitFor(() => {
			expect(mockUpdateStyle).toHaveBeenCalledWith("textAlign", "center")
		})
	})
})
