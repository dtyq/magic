import { describe, expect, it } from "vitest"
import {
	MAX_PROJECT_NAME_LENGTH,
	MAX_WORKSPACE_NAME_LENGTH,
	clampProjectName,
	isProjectNameAtLimit,
	isProjectNameOverLimit,
} from "../mobileProjectNameLimit"

describe("mobileProjectNameLimit", () => {
	/**
	 * Verify that MAX_PROJECT_NAME_LENGTH is configured to 100 characters.
	 */
	it("defines MAX_PROJECT_NAME_LENGTH as 100", () => {
		expect(MAX_PROJECT_NAME_LENGTH).toBe(100)
	})

	/**
	 * Verify that MAX_WORKSPACE_NAME_LENGTH is configured to 50 characters.
	 */
	it("defines MAX_WORKSPACE_NAME_LENGTH as 50", () => {
		expect(MAX_WORKSPACE_NAME_LENGTH).toBe(50)
	})

	/**
	 * Test isProjectNameOverLimit for various name lengths.
	 */
	describe("isProjectNameOverLimit", () => {
		it("returns false for undefined, null, or empty string", () => {
			expect(isProjectNameOverLimit(undefined)).toBe(false)
			expect(isProjectNameOverLimit(null)).toBe(false)
			expect(isProjectNameOverLimit("")).toBe(false)
		})

		it("returns false for names within or at 100 characters", () => {
			expect(isProjectNameOverLimit("mock-chat-name")).toBe(false)
			expect(isProjectNameOverLimit("x".repeat(100))).toBe(false)
		})

		it("returns true for names exceeding 100 characters", () => {
			expect(isProjectNameOverLimit("x".repeat(101))).toBe(true)
			expect(isProjectNameOverLimit("x".repeat(200))).toBe(true)
		})
	})

	/**
	 * Test isProjectNameAtLimit for boundary detection.
	 */
	describe("isProjectNameAtLimit", () => {
		it("returns false when name length is less than limit", () => {
			expect(isProjectNameAtLimit("short name")).toBe(false)
			expect(isProjectNameAtLimit("x".repeat(99))).toBe(false)
		})

		it("returns true when name length exactly equals limit", () => {
			expect(isProjectNameAtLimit("x".repeat(100))).toBe(true)
		})

		it("returns false when name length exceeds limit", () => {
			expect(isProjectNameAtLimit("x".repeat(101))).toBe(false)
		})
	})

	/**
	 * Test clampProjectName for defensive trimming and slicing.
	 */
	describe("clampProjectName", () => {
		it("handles empty or nil values gracefully", () => {
			expect(clampProjectName(undefined)).toBe("")
			expect(clampProjectName(null)).toBe("")
			expect(clampProjectName("")).toBe("")
		})

		it("preserves names that are within the 100 character boundary", () => {
			const validName = "valid-project-name"
			expect(clampProjectName(validName)).toBe(validName)
		})

		it("trims whitespace before measuring and clamping", () => {
			const paddedName = "   trimmed-project-name   "
			expect(clampProjectName(paddedName)).toBe("trimmed-project-name")
		})

		it("clamps oversized names to exactly 100 characters", () => {
			const oversizedName = "prefix-" + "y".repeat(120)
			const clamped = clampProjectName(oversizedName)

			expect(clamped.length).toBe(100)
			expect(clamped).toBe(oversizedName.slice(0, 100))
		})
	})
})
