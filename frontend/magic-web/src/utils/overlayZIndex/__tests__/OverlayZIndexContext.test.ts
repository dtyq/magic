import { describe, expect, it } from "vitest"
import { omitZIndexClassNames, resolveEffectiveOverlayZIndex } from "../OverlayZIndexContext"

describe("omitZIndexClassNames", () => {
	it("strips important and token z-index classes", () => {
		expect(omitZIndexClassNames("!z-[960] max-w-48 text-xs")).toBe("max-w-48 text-xs")
		expect(omitZIndexClassNames("z-tooltip w-fit")).toBe("w-fit")
		expect(omitZIndexClassNames("zoom-in-95 z-modal")).toBe("zoom-in-95")
	})

	it("returns undefined when every class is a z-index token", () => {
		expect(omitZIndexClassNames("!z-[920]")).toBeUndefined()
	})
})

describe("resolveEffectiveOverlayZIndex", () => {
	it("keeps Tailwind defaults outside an overlay host", () => {
		expect(resolveEffectiveOverlayZIndex(null)).toBeUndefined()
		expect(resolveEffectiveOverlayZIndex(null, 1050)).toBe(1050)
	})

	it("raises nested layers above the host overlay", () => {
		expect(resolveEffectiveOverlayZIndex(1010)).toBe(1020)
		expect(resolveEffectiveOverlayZIndex(1060, 1050)).toBe(1070)
	})
})
