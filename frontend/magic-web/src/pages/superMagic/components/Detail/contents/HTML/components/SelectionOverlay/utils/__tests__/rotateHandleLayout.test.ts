import { describe, expect, it } from "vitest"
import {
	CONTEXT_TOOLBAR_TOP_CONTROL_CLEARANCE,
	ROTATE_HANDLE_CONNECTOR_HEIGHT,
	ROTATE_HANDLE_SIZE,
	ROTATE_HANDLE_WRAPPER_TOP,
} from "../rotateHandleLayout"

describe("rotateHandleLayout", () => {
	it("keeps the connector from entering the selection box", () => {
		expect(
			ROTATE_HANDLE_WRAPPER_TOP + ROTATE_HANDLE_SIZE + ROTATE_HANDLE_CONNECTOR_HEIGHT,
		).toBe(0)
		expect(ROTATE_HANDLE_WRAPPER_TOP).toBeLessThan(-32)
	})

	it("reserves room above the handle for the angle badge", () => {
		expect(CONTEXT_TOOLBAR_TOP_CONTROL_CLEARANCE).toBeGreaterThan(-ROTATE_HANDLE_WRAPPER_TOP)
	})
})
