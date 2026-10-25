import { describe, expect, it, vi } from "vitest"
import { distributeActions } from "../distributeActions"

function createCanvas() {
	return {
		selectionManager: {
			getSelectedIds: vi.fn(() => ["image-1"]),
		},
		alignmentManager: {
			canExecuteCurrentSelection: vi.fn(() => true),
			arrange: vi.fn(),
			distribute: vi.fn(),
		},
		permissionManager: {
			can: vi.fn(() => true),
			canAlignCurrentSelection: vi.fn(() => true),
		},
	}
}

describe("distributeActions", () => {
	it("routes the new arrangement payload to the selected mode", () => {
		const canvas = createCanvas()
		const action = distributeActions.find((item) => item.id === "distribute.arrange")

		expect(action).toBeDefined()
		action?.execute(canvas as never, { mode: "layered" })

		expect(canvas.alignmentManager.arrange).toHaveBeenCalledWith("layered")
	})

	it("keeps the legacy auto-layout action mapped to smart mode", () => {
		const canvas = createCanvas()
		const action = distributeActions.find((item) => item.id === "distribute.auto-layout")

		action?.execute(canvas as never)

		expect(canvas.alignmentManager.arrange).toHaveBeenCalledWith("smart")
	})

	it("keeps a non-empty invalid scope requestable so the manager can explain it", () => {
		const canvas = createCanvas()
		canvas.alignmentManager.canExecuteCurrentSelection.mockReturnValue(false)
		const action = distributeActions.find((item) => item.id === "distribute.arrange")

		expect(action?.canExecute(canvas as never)).toBe(true)
		expect(canvas.alignmentManager.canExecuteCurrentSelection).not.toHaveBeenCalled()
	})
})
