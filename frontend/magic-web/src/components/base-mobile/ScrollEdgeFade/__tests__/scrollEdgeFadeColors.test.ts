import { describe, expect, it } from "vitest"

import { getScrollEdgeFadeGradients, getScrollEdgeFadeRgb } from "../scrollEdgeFadeColors"

describe("scrollEdgeFadeColors", () => {
	it("maps mobile-background to the mobile page RGB token", () => {
		expect(getScrollEdgeFadeRgb("mobile-background")).toBe(
			"rgb(var(--mobile-background-rgb) / 1)",
		)
	})

	it("builds top and bottom gradients from the fade color token", () => {
		const gradients = getScrollEdgeFadeGradients("muted")

		expect(gradients.top).toContain("rgb(var(--muted-rgb) / 1)")
		expect(gradients.bottom).toContain("rgb(var(--muted-rgb) / 1)")
	})
})
