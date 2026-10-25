import { describe, expect, it } from "vitest"
import { resolveVideoEditElementLayout } from "../VideoEditElement.layout"

describe("VideoEditElement layout", () => {
	it("allocates a footer for the merge action without output parameter rows", () => {
		const layout = resolveVideoEditElementLayout(1280, 720)

		expect(layout.footer.height).toBeGreaterThan(0)
		expect(layout.mergeButton.width).toBeGreaterThan(0)
		expect(layout.mergeButton.height).toBeGreaterThan(0)
		expect(layout).not.toHaveProperty("footerParameterRows")
		expect(layout).not.toHaveProperty("footerOutput")
	})
})
