import type { ComponentProps } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EditorSidebar } from "../EditorSidebar"
import { STRUCTURE_MIN_HEIGHT, STYLES_MIN_HEIGHT } from "../sidebarSplit"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

function renderSidebar(overrides: Partial<ComponentProps<typeof EditorSidebar>> = {}) {
	const props = {
		structureExpanded: true,
		stylesExpanded: true,
		onStructureExpandedChange: vi.fn(),
		onStylesExpandedChange: vi.fn(),
		structure: <div data-testid="structure-slot">structure</div>,
		styles: <div data-testid="styles-slot">styles</div>,
		...overrides,
	}
	return { ...render(<EditorSidebar {...props} />), props }
}

let observedRailHeight = 401

class ResizeObserverMock {
	callback: ResizeObserverCallback

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback
	}

	observe(target: Element) {
		this.callback(
			[
				{
					target,
					contentRect: {
						height: observedRailHeight,
						width: 400,
						top: 0,
						left: 0,
						bottom: observedRailHeight,
						right: 400,
						x: 0,
						y: 0,
						toJSON: () => ({}),
					},
					borderBoxSize: [],
					contentBoxSize: [],
					devicePixelContentBoxSize: [],
				},
			],
			this as unknown as ResizeObserver,
		)
	}

	unobserve() {
		return undefined
	}

	disconnect() {
		return undefined
	}
}

describe("EditorSidebar", () => {
	beforeEach(() => {
		observedRailHeight = 401
		vi.stubGlobal("ResizeObserver", ResizeObserverMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("renders both sections, a splitter, and rail chrome", () => {
		renderSidebar()

		expect(screen.getByTestId("html-editor-sidebar")).toHaveAttribute(
			"aria-label",
			"stylePanel.sidebar.title",
		)
		expect(screen.getByTestId("html-editor-sidebar-structure")).toBeInTheDocument()
		expect(screen.getByTestId("html-editor-sidebar-styles")).toBeInTheDocument()
		expect(screen.getByTestId("html-editor-sidebar-splitter")).toBeInTheDocument()
		expect(screen.getByTestId("html-editor-sidebar-resize-handle")).toHaveClass("z-30")
		expect(
			within(screen.getByTestId("html-editor-sidebar-resize-handle")).getByTestId(
				"resize-grip",
			),
		).toHaveAttribute("data-orientation", "vertical")
		expect(
			within(screen.getByTestId("html-editor-sidebar-splitter")).getByTestId("resize-grip"),
		).toHaveAttribute("data-orientation", "horizontal")
		expect(screen.getByTestId("html-editor-sidebar-splitter").className).toContain("h-2")
		expect(screen.getByTestId("html-editor-sidebar-splitter").className).toContain(
			"bg-transparent",
		)
		expect(screen.getByTestId("html-editor-sidebar-splitter").className).toContain(
			"before:bg-gradient-to-r",
		)
		expect(screen.getByTestId("html-editor-sidebar-resize-handle").className).toContain(
			"before:bg-gradient-to-b",
		)
		expect(screen.getByTestId("html-editor-sidebar-resize-handle").className).toContain(
			"absolute",
		)
		expect(screen.getByTestId("html-editor-sidebar-splitter-line").className).toContain(
			"bg-border/70",
		)
		expect(screen.getByTestId("html-editor-sidebar-splitter-line").className).not.toContain(
			"mask-image",
		)
		expect(screen.queryByTestId("resize-splitter-track")).not.toBeInTheDocument()
		expect(screen.getByTestId("html-editor-sidebar-structure-chrome")).toBeInTheDocument()
		expect(screen.queryByTestId("html-editor-sidebar-close-button")).not.toBeInTheDocument()
		expect(screen.getByTestId("structure-slot")).toBeInTheDocument()
		expect(screen.getByTestId("styles-slot")).toBeInTheDocument()
	})

	it("hides the splitter and collapsed section body", () => {
		renderSidebar({ stylesExpanded: false })

		expect(screen.queryByTestId("html-editor-sidebar-splitter")).not.toBeInTheDocument()
		expect(screen.queryByTestId("styles-slot")).not.toBeInTheDocument()
		expect(screen.getByTestId("structure-slot")).toBeInTheDocument()
		const collapsedStylesHeader = screen.getByTestId(
			"html-editor-sidebar-styles-toggle",
		).parentElement
		expect(collapsedStylesHeader).toHaveClass("border-t")
		expect(collapsedStylesHeader).not.toHaveClass("border-b")
	})

	it("toggles a section from its header", () => {
		const { props } = renderSidebar()

		fireEvent.click(screen.getByTestId("html-editor-sidebar-styles-toggle"))
		expect(props.onStylesExpandedChange).toHaveBeenCalledWith(false)
	})

	it("clamps section heights when the rail is shorter than both minima", () => {
		renderSidebar()

		expect(screen.getByTestId("html-editor-sidebar-structure")).toHaveStyle({
			height: `${STRUCTURE_MIN_HEIGHT}px`,
		})
		expect(screen.getByTestId("html-editor-sidebar-styles")).toHaveStyle({
			height: `${STYLES_MIN_HEIGHT}px`,
		})
	})

	it("splits against the rail, not the 1px splitter wrapper", () => {
		observedRailHeight = 801
		renderSidebar()

		const rail = screen.getByTestId("html-editor-sidebar-rail")
		const line = screen.getByTestId("html-editor-sidebar-splitter-line")
		vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({
			x: 0,
			y: 0,
			width: 400,
			height: 800,
			top: 0,
			left: 0,
			bottom: 800,
			right: 400,
			toJSON: () => ({}),
		} as DOMRect)
		vi.spyOn(line, "getBoundingClientRect").mockReturnValue({
			x: 0,
			y: 400,
			width: 400,
			height: 1,
			top: 400,
			left: 0,
			bottom: 401,
			right: 400,
			toJSON: () => ({}),
		} as DOMRect)

		function dispatchPointer(target: EventTarget, type: string, clientY: number) {
			const event = new Event(type, { bubbles: true, cancelable: true })
			Object.defineProperties(event, {
				button: { value: 0 },
				clientY: { value: clientY },
				isPrimary: { value: true },
				pointerId: { value: 1 },
				pointerType: { value: "mouse" },
			})
			fireEvent(target, event)
		}

		dispatchPointer(screen.getByTestId("html-editor-sidebar-splitter"), "pointerdown", 400)
		dispatchPointer(window, "pointermove", 300)

		expect(screen.getByTestId("html-editor-sidebar-structure")).toHaveStyle({
			height: "300px",
		})
		expect(screen.getByTestId("html-editor-sidebar-styles")).toHaveStyle({
			height: "500px",
		})
	})
})
