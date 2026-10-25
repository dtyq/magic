import { describe, expect, it } from "vitest"
import {
	DEFAULT_STRUCTURE_RATIO,
	SIDEBAR_DEFAULT_WIDTH,
	SIDEBAR_MIN_WIDTH,
	STYLES_MIN_HEIGHT,
	STYLES_MIN_WIDTH,
	STRUCTURE_MIN_HEIGHT,
	getSidebarSectionLayout,
	getStructureRatioFromPointer,
} from "../sidebarSplit"

describe("getSidebarSectionLayout", () => {
	it("splits remaining height 1:1 when both sections are open", () => {
		const layout = getSidebarSectionLayout(800, DEFAULT_STRUCTURE_RATIO, true, true)

		expect(layout.showSplitter).toBe(true)
		expect(layout.structureHeight).toBe(400)
		expect(layout.stylesHeight).toBe(400)
	})

	it("clamps each section to its minimum height", () => {
		const layout = getSidebarSectionLayout(400, DEFAULT_STRUCTURE_RATIO, true, true)

		expect(layout.structureHeight).toBe(STRUCTURE_MIN_HEIGHT)
		expect(layout.stylesHeight).toBe(STYLES_MIN_HEIGHT)
	})

	it("gives the open section the full height when the other is collapsed", () => {
		expect(getSidebarSectionLayout(500, 0.5, true, false)).toEqual({
			structureHeight: 500,
			stylesHeight: 0,
			showSplitter: false,
		})
		expect(getSidebarSectionLayout(500, 0.5, false, true)).toEqual({
			structureHeight: 0,
			stylesHeight: 500,
			showSplitter: false,
		})
	})

	it("scales both minima when the rail is shorter than their sum", () => {
		const layout = getSidebarSectionLayout(200, 0.5, true, true)

		expect(layout.structureHeight).toBeCloseTo(80)
		expect(layout.stylesHeight).toBeCloseTo(120)
		expect(layout.showSplitter).toBe(true)
	})
})

describe("sidebar width floors", () => {
	it("keeps the rail at least as wide as the styles panel", () => {
		expect(SIDEBAR_MIN_WIDTH).toBe(STYLES_MIN_WIDTH)
		expect(SIDEBAR_MIN_WIDTH).toBeGreaterThanOrEqual(320)
		expect(SIDEBAR_DEFAULT_WIDTH).toBeGreaterThan(SIDEBAR_MIN_WIDTH)
	})
})

describe("getStructureRatioFromPointer", () => {
	it("maps the pointer to a 0-1 ratio inside the rail", () => {
		expect(getStructureRatioFromPointer(300, 100, 400)).toBe(0.5)
		expect(getStructureRatioFromPointer(0, 100, 400)).toBe(0)
		expect(getStructureRatioFromPointer(900, 100, 400)).toBe(1)
	})
})
