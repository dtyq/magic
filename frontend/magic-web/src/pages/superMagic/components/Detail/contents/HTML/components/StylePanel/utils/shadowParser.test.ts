import { describe, expect, it } from "vitest"
import { DEFAULT_BOX_SHADOW, parseBoxShadow } from "./shadowParser"

describe("parseBoxShadow", () => {
	it("parses CSSOM color-first shadow values", () => {
		expect(parseBoxShadow("rgba(17, 17, 17, 0.2) 5px 6px 7px 8px")).toEqual({
			offsetX: 5,
			offsetY: 6,
			blur: 7,
			spread: 8,
			color: "rgba(17, 17, 17, 0.2)",
			inset: false,
		})
	})

	it("keeps the default editable values when shadow is disabled", () => {
		expect(parseBoxShadow("none")).toEqual(DEFAULT_BOX_SHADOW)
	})
})
