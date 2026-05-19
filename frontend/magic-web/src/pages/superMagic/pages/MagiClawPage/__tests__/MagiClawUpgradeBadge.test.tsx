import { describe, expect, it } from "vitest"
import { shouldShowMagiClawUpgradeBadge } from "../MagiClawUpgradeBadge"

describe("shouldShowMagiClawUpgradeBadge", () => {
	it("should return true only when upgrade is available", () => {
		expect(shouldShowMagiClawUpgradeBadge(true)).toBe(true)
		expect(shouldShowMagiClawUpgradeBadge(false)).toBe(false)
		expect(shouldShowMagiClawUpgradeBadge(undefined)).toBe(false)
		expect(shouldShowMagiClawUpgradeBadge(null)).toBe(false)
	})
})
