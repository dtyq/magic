import { describe, expect, it } from "vitest"
import { ToolbarButton } from "../../../../MessageEditor/types"
import { MOBILE_LAYOUT_CONFIG } from "../constant"

describe("main input mobile layout", () => {
	it("keeps internet search after the model switch", () => {
		expect(MOBILE_LAYOUT_CONFIG.bottomLeft).toEqual([
			ToolbarButton.MODEL_SWITCH,
			ToolbarButton.INTERNET_SEARCH,
			ToolbarButton.AT,
			ToolbarButton.MCP,
			ToolbarButton.UPLOAD,
		])
	})
})
