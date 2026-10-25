import { describe, expect, it } from "vitest"
import { ToolbarButton } from "../../types"
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_MOBILE_LAYOUT_CONFIG } from "../constant"

describe("message editor default layout", () => {
	it("keeps internet search on the desktop toolbar", () => {
		expect(DEFAULT_LAYOUT_CONFIG.bottomRight[0]).toBe(ToolbarButton.INTERNET_SEARCH)
		expect(DEFAULT_LAYOUT_CONFIG.bottomRight).toContain(ToolbarButton.INTERNET_SEARCH)
	})

	it("keeps internet search on the mobile toolbar", () => {
		expect(DEFAULT_MOBILE_LAYOUT_CONFIG.bottomLeft[0]).toBe(ToolbarButton.INTERNET_SEARCH)
		expect(DEFAULT_MOBILE_LAYOUT_CONFIG.bottomLeft).toContain(ToolbarButton.INTERNET_SEARCH)
	})
})
