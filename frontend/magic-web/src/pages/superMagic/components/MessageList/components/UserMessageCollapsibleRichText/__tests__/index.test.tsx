import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const resizeCallbacks: ResizeObserverCallback[] = []

import { UserMessageCollapsibleRichText } from ".."

class MockResizeObserver {
	callback: ResizeObserverCallback

	/** Keep the rendered content measurable without relying on browser layout in jsdom. */
	constructor(callback: ResizeObserverCallback) {
		this.callback = callback
		resizeCallbacks.push(callback)
	}

	/** Register the observed element for the component contract. */
	observe() {
		return undefined
	}

	/** Release the synthetic observer callback. */
	disconnect() {
		return undefined
	}
}

describe("UserMessageCollapsibleRichText", () => {
	beforeEach(() => {
		resizeCallbacks.length = 0
		vi.stubGlobal("ResizeObserver", MockResizeObserver)
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0)
			return 1
		})
		vi.stubGlobal("cancelAnimationFrame", () => undefined)
	})

	it("uses the two-line cap without changing expanded content behavior", async () => {
		render(<UserMessageCollapsibleRichText content="synthetic content" />)
		const panel = screen.getByTestId("user-message-collapsible-text")
		const content = panel.firstElementChild as HTMLElement
		Object.defineProperty(content, "scrollHeight", { configurable: true, value: 80 })
		act(() => {
			resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver))
		})

		await waitFor(() => expect(panel).toHaveClass("max-h-[44px]"))
		fireEvent.click(panel)
		await waitFor(() => expect(panel).toHaveClass("max-h-[min(70vh,28rem)]"))
	})
})
