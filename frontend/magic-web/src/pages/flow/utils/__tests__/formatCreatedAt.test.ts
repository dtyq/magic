import { describe, expect, it } from "vitest"
import { formatFlowCardCreatedAt } from "../formatCreatedAt"

describe("formatFlowCardCreatedAt", () => {
	it("formats en_US as long US date", () => {
		expect(formatFlowCardCreatedAt("2026-03-24", "en_US")).toBe("March 24, 2026")
		expect(formatFlowCardCreatedAt("2026-03-24 10:00:00", "en_US")).toBe("March 24, 2026")
	})

	it("formats zh_CN as YYYY-MM-DD", () => {
		expect(formatFlowCardCreatedAt("2026-03-24", "zh_CN")).toBe("2026-03-24")
	})

	it("returns empty for missing input", () => {
		expect(formatFlowCardCreatedAt(undefined, "en_US")).toBe("")
	})
})
