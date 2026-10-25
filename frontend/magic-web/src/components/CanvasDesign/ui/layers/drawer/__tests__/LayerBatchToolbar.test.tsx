import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CanvasDesignI18nProvider } from "../../../../app/providers/I18nProvider"
import { ElementMenuContext } from "../../../panels/menu/ElementMenuContext"
import LayerBatchToolbar from "../LayerBatchToolbar"

describe("LayerBatchToolbar", () => {
	it("opens the shared element menu anchored to the batch button", () => {
		const openMenuAt = vi.fn()
		render(
			<CanvasDesignI18nProvider>
				<ElementMenuContext.Provider
					value={{
						openMenu: vi.fn(),
						openMenuAt,
					}}
				>
					<LayerBatchToolbar selectedIds={["one", "two"]} />
				</ElementMenuContext.Provider>
			</CanvasDesignI18nProvider>,
		)

		const button = screen.getByTestId("layers-batch-operations-button")
		fireEvent.click(button)

		expect(openMenuAt).toHaveBeenCalledTimes(1)
		expect(openMenuAt.mock.calls[0][0]).toBe("one")
		expect(openMenuAt.mock.calls[0][3]).toBe("layers")
	})

	it("hides the batch button when nothing is selected", () => {
		const openMenuAt = vi.fn()
		render(
			<CanvasDesignI18nProvider>
				<ElementMenuContext.Provider
					value={{
						openMenu: vi.fn(),
						openMenuAt,
					}}
				>
					<LayerBatchToolbar selectedIds={[]} />
				</ElementMenuContext.Provider>
			</CanvasDesignI18nProvider>,
		)

		expect(screen.queryByTestId("layers-batch-operations-button")).toBeNull()
		expect(openMenuAt).not.toHaveBeenCalled()
	})
})
