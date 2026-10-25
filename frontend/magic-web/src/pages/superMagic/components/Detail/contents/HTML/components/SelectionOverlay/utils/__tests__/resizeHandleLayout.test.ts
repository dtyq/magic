import { describe, expect, it } from "vitest"
import { getResizeHandleStyles, getResizeHandleTickLength } from "../resizeHandleLayout"

describe("resizeHandleLayout", () => {
	it("shortens mid-edge ticks on small selections", () => {
		expect(getResizeHandleTickLength({ width: 32, height: 24 })).toBe(10)
		expect(getResizeHandleTickLength({ width: 320, height: 200 })).toBe(16)
	})

	it("pins each handle to the selection edge", () => {
		const styles = getResizeHandleStyles()

		expect(styles.right).toMatchObject({
			right: 0,
			transform: "translate(50%, -50%)",
		})
		expect(styles.bottom).toMatchObject({
			bottom: 0,
			transform: "translate(-50%, 50%)",
		})
		expect(styles["bottom-right"]).toMatchObject({
			right: 0,
			bottom: 0,
			transform: "translate(50%, 50%)",
		})
	})
})
