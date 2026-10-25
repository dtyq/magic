import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ElementEditPopover } from "../ElementEditPopover"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight")

afterEach(() => {
	vi.useRealTimers()
	if (originalScrollHeight) {
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight)
	}
})

function renderPopover(scrollHeight: number, containerHeight = 500) {
	Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
		configurable: true,
		get: () => scrollHeight,
	})

	render(
		<ElementEditPopover
			box={{ left: 40, top: 40, width: 120, height: 80 }}
			containerWidth={640}
			containerHeight={containerHeight}
			instruction=""
			onInstructionChange={vi.fn()}
			onConfirm={vi.fn()}
			onCancel={vi.fn()}
		/>,
	)

	return screen.getByTestId("element-inspector-edit-popover")
}

describe("ElementEditPopover", () => {
	it("does not show a scrollbar when the content fits", () => {
		const popover = renderPopover(240)
		const content = screen.getByTestId("element-inspector-edit-content")

		expect(popover).toHaveStyle({ overflow: "hidden" })
		expect(content).toHaveClass("overflow-y-auto", "no-scrollbar")
		expect(screen.getByTestId("element-inspector-edit-footer")).toHaveClass("shrink-0")
		expect(screen.getByTestId("element-inspector-edit-close-button")).toBeInTheDocument()
		expect(screen.getByTestId("element-inspector-instruction-input")).toBeInTheDocument()
		expect(screen.getByTestId("element-inspector-edit-cancel-button")).toBeInTheDocument()
		expect(screen.getByTestId("element-inspector-edit-confirm-button")).toBeDisabled()
	})

	it("only enables scrolling when content exceeds the available height", () => {
		const popover = renderPopover(360, 280)
		const content = screen.getByTestId("element-inspector-edit-content")

		expect(popover).toHaveStyle({ height: "272px", overflow: "hidden" })
		expect(content).toHaveClass("overflow-y-auto", "no-scrollbar")
		expect(screen.getByTestId("element-inspector-edit-footer")).toHaveClass("shrink-0")
	})

	it("does not derive the next height from the constrained outer popover", () => {
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			get() {
				return this.getAttribute("data-testid") === "element-inspector-edit-content"
					? 360
					: 1
			},
		})

		render(
			<ElementEditPopover
				box={{ left: 40, top: 40, width: 120, height: 80 }}
				containerWidth={640}
				containerHeight={500}
				instruction=""
				onInstructionChange={vi.fn()}
				onConfirm={vi.fn()}
				onCancel={vi.fn()}
			/>,
		)
		const popover = screen.getByTestId("element-inspector-edit-popover")

		expect(popover).toHaveStyle({ height: "360px" })
	})

	it("shows the screenshot loading state in the preview area", () => {
		render(
			<ElementEditPopover
				box={{ left: 40, top: 40, width: 120, height: 80 }}
				containerWidth={640}
				containerHeight={500}
				screenshotLoading
				instruction=""
				onInstructionChange={vi.fn()}
				onConfirm={vi.fn()}
				onCancel={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("element-inspector-screenshot-preview")).toHaveTextContent(
			"stylePanel.inspector.screenshotProcessing",
		)
		expect(screen.getByRole("status")).toBeInTheDocument()
	})

	it("shows success feedback before confirming the target", () => {
		vi.useFakeTimers()
		const onConfirm = vi.fn()
		render(
			<ElementEditPopover
				box={{ left: 40, top: 40, width: 120, height: 80 }}
				containerWidth={640}
				containerHeight={500}
				instruction="Move this section"
				onInstructionChange={vi.fn()}
				onConfirm={onConfirm}
				onCancel={vi.fn()}
			/>,
		)

		const popover = screen.getByTestId("element-inspector-edit-popover")
		const button = screen.getByTestId("element-inspector-edit-confirm-button")
		expect(button).toBe(screen.getByRole("button", { name: "stylePanel.inspector.confirm" }))
		fireEvent.click(button)

		expect(popover).toHaveAttribute("data-confirming", "true")
		expect(button).toBeDisabled()
		expect(screen.getByTestId("element-inspector-confirm-success")).toHaveAttribute(
			"data-state",
			"in",
		)
		expect(screen.getByTestId("element-inspector-target-flight")).toBeInTheDocument()
		expect(onConfirm).not.toHaveBeenCalled()

		act(() => vi.advanceTimersByTime(519))
		expect(onConfirm).not.toHaveBeenCalled()
		act(() => vi.advanceTimersByTime(1))
		expect(onConfirm).toHaveBeenCalledOnce()
	})

	it("shows delete only when editing an existing target", () => {
		const onDelete = vi.fn()
		render(
			<ElementEditPopover
				box={{ left: 40, top: 40, width: 120, height: 80 }}
				containerWidth={640}
				containerHeight={500}
				instruction="Move this section"
				onInstructionChange={vi.fn()}
				onConfirm={vi.fn()}
				onCancel={vi.fn()}
				onDelete={onDelete}
			/>,
		)

		const deleteButton = screen.getByTestId("element-inspector-remove-target-button")
		expect(deleteButton).toBeInTheDocument()
		fireEvent.click(deleteButton)
		expect(onDelete).toHaveBeenCalledOnce()
	})
})
