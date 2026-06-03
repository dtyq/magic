import { describe, expect, it } from "vitest"
import { shouldShowInitialListSkeleton } from "../should-show-initial-list-skeleton"

describe("shouldShowInitialListSkeleton", () => {
	it("returns true only when loading with zero items", () => {
		expect(shouldShowInitialListSkeleton(true, 0)).toBe(true)
		expect(shouldShowInitialListSkeleton(true, 2)).toBe(false)
		expect(shouldShowInitialListSkeleton(false, 0)).toBe(false)
	})
})
