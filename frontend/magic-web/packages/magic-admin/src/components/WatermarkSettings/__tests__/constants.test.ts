import { describe, expect, it } from "vitest"
import {
	WATERMARK_DEPTH_OPTIONS,
	WATERMARK_FIELD_ORDER,
	normalizeWatermarkDepth,
	normalizeWatermarkFields,
} from "../constants"

describe("watermark settings constants", () => {
	it("keeps the render order and depth options as the single source of truth", () => {
		expect(WATERMARK_FIELD_ORDER).toEqual([
			"real_name",
			"employee_no",
			"visit_time",
			"department",
			"phone",
			"email",
		])
		expect(WATERMARK_DEPTH_OPTIONS).toEqual(["light", "standard", "strong"])
	})

	it("drops unknown fields, removes duplicates and restores the render order", () => {
		expect(normalizeWatermarkFields(["email", "unknown", "real_name", "email", 42])).toEqual([
			"real_name",
			"email",
		])
	})

	it("keeps an explicitly empty field list and tolerates non-array input", () => {
		expect(normalizeWatermarkFields([])).toEqual([])
		expect(normalizeWatermarkFields(undefined)).toEqual([])
		expect(normalizeWatermarkFields("real_name")).toEqual([])
	})

	it("falls back to light when the intensity is unknown or missing", () => {
		expect(normalizeWatermarkDepth("strong")).toBe("strong")
		expect(normalizeWatermarkDepth("ultra")).toBe("light")
		expect(normalizeWatermarkDepth(undefined)).toBe("light")
	})
})
