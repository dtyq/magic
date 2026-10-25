import { describe, expect, it } from "vitest"
import { getMetricControlWidth } from "../../controls/metricControlWidth"
import {
	CONTEXT_TOOLBAR_ACTIONS_WIDTH,
	CONTEXT_TOOLBAR_FONT_ADJUSTER_WIDTH,
	CONTEXT_TOOLBAR_FORMATTING_WIDTH,
	CONTEXT_TOOLBAR_MIN_WIDTH,
	CONTEXT_TOOLBAR_MORE_WIDTH,
	CONTEXT_TOOLBAR_PANEL_MAX_WIDTH,
	CONTEXT_TOOLBAR_ROW_MAX_WIDTH,
	getContextToolbarPanelMaxWidth,
	getContextToolbarRowMaxWidth,
	getContextToolbarRowWidth,
	getContextToolbarTypographyUnits,
	getContextToolbarTypographyWidth,
	partitionContextToolGroups,
	rebalanceOrphanToolbarRows,
	type ContextToolGroup,
} from "../contextToolbarPartition"

const TYPICAL_CONTEXT_GROUPS: ContextToolGroup[] = [
	{ id: "actions", estimatedWidth: 124 },
	{ id: "typography", estimatedWidth: 232 },
	{ id: "formatting", estimatedWidth: 116 },
	{ id: "alignment", estimatedWidth: 96 },
	{ id: "appearance", estimatedWidth: 64 },
	{ id: "more", estimatedWidth: 76 },
]

function headingToolbarGroups(): ContextToolGroup[] {
	const units = getContextToolbarTypographyUnits({
		fontSize: "88",
		lineHeight: "82.72px",
		showAdjuster: true,
	})
	return [
		{ id: "actions", estimatedWidth: CONTEXT_TOOLBAR_ACTIONS_WIDTH },
		{
			id: "typography",
			estimatedWidth: getContextToolbarTypographyWidth({
				fontSize: "88",
				lineHeight: "82.72px",
				showAdjuster: true,
			}),
			items: units,
		},
		{ id: "formatting", estimatedWidth: CONTEXT_TOOLBAR_FORMATTING_WIDTH },
		{ id: "alignment", estimatedWidth: 96 },
		{ id: "appearance", estimatedWidth: 68 },
		{ id: "more", estimatedWidth: CONTEXT_TOOLBAR_MORE_WIDTH },
	]
}

describe("getContextToolbarRowMaxWidth", () => {
	it("keeps the default row cap when the canvas is wide enough", () => {
		expect(getContextToolbarRowMaxWidth(800)).toBe(CONTEXT_TOOLBAR_ROW_MAX_WIDTH)
		expect(getContextToolbarRowMaxWidth(600)).toBe(CONTEXT_TOOLBAR_ROW_MAX_WIDTH)
		expect(getContextToolbarRowMaxWidth(520)).toBe(520)
	})

	it("follows a mid-size width between the minimum and the row cap", () => {
		expect(getContextToolbarRowMaxWidth(480)).toBe(480)
		expect(getContextToolbarRowMaxWidth(448)).toBe(CONTEXT_TOOLBAR_MIN_WIDTH)
	})

	it("keeps a usable minimum when the canvas is extremely narrow", () => {
		expect(getContextToolbarRowMaxWidth(200)).toBe(CONTEXT_TOOLBAR_MIN_WIDTH)
		expect(getContextToolbarRowMaxWidth(80)).toBe(CONTEXT_TOOLBAR_MIN_WIDTH)
		expect(getContextToolbarPanelMaxWidth(200)).toBe(CONTEXT_TOOLBAR_MIN_WIDTH)
		expect(getContextToolbarPanelMaxWidth(800)).toBe(CONTEXT_TOOLBAR_PANEL_MAX_WIDTH)
	})

	it("falls back to the default cap when the canvas width is unknown", () => {
		expect(getContextToolbarRowMaxWidth()).toBe(CONTEXT_TOOLBAR_ROW_MAX_WIDTH)
		expect(getContextToolbarRowMaxWidth(0)).toBe(CONTEXT_TOOLBAR_ROW_MAX_WIDTH)
		expect(getContextToolbarRowMaxWidth(-20)).toBe(CONTEXT_TOOLBAR_ROW_MAX_WIDTH)
	})
})

describe("getContextToolbarTypographyUnits", () => {
	it("keeps font size and A↑A↓ as one wrap unit", () => {
		const units = getContextToolbarTypographyUnits({
			fontSize: "88",
			lineHeight: "82.72px",
			showAdjuster: true,
		})
		expect(units.map((unit) => unit.id)).toEqual(["fontSize", "lineHeight"])
		expect(units[0]?.estimatedWidth).toBe(getMetricControlWidth("88") + 4 + 56)
	})
})

describe("rebalanceOrphanToolbarRows", () => {
	it("moves the previous group down so More Styles is not alone", () => {
		const rows = rebalanceOrphanToolbarRows(
			[
				[
					{ id: "lineHeight", estimatedWidth: 140 },
					{ id: "formatting", estimatedWidth: CONTEXT_TOOLBAR_FORMATTING_WIDTH },
					{ id: "alignment", estimatedWidth: 96 },
					{ id: "appearance", estimatedWidth: 68 },
				],
				[{ id: "more", estimatedWidth: CONTEXT_TOOLBAR_MORE_WIDTH }],
			],
			480,
		)

		expect(rows.map((row) => row.map((group) => group.id))).toEqual([
			["lineHeight", "formatting", "alignment"],
			["appearance", "more"],
		])
	})
})

describe("partitionContextToolGroups", () => {
	it("returns a single row when group list is empty or has one item", () => {
		expect(partitionContextToolGroups([])).toEqual([[]])
		const single: ContextToolGroup[] = [{ id: "actions", estimatedWidth: 120 }]
		expect(partitionContextToolGroups(single)).toEqual([single])
	})

	it("keeps a single row when total width is within maxRowWidth", () => {
		const groups: ContextToolGroup[] = [
			{ id: "actions", estimatedWidth: 120 },
			{ id: "background", estimatedWidth: 36 },
			{ id: "more", estimatedWidth: 76 },
		]
		const result = partitionContextToolGroups(groups, CONTEXT_TOOLBAR_ROW_MAX_WIDTH)
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual(groups)
	})

	it("splits into two balanced rows when total width exceeds maxRowWidth", () => {
		const groups: ContextToolGroup[] = [
			{ id: "actions", estimatedWidth: 124 },
			{ id: "typography", estimatedWidth: 232 },
			{ id: "formatting", estimatedWidth: 116 },
			{ id: "alignment", estimatedWidth: 96 },
			{ id: "appearance", estimatedWidth: 64 },
			{ id: "more", estimatedWidth: 76 },
		]
		const result = partitionContextToolGroups(groups, 500)
		expect(result).toHaveLength(2)
		expect(result[0].map((g) => g.id)).toEqual(["actions", "typography"])
		expect(result[1].map((g) => g.id)).toEqual([
			"formatting",
			"alignment",
			"appearance",
			"more",
		])
	})

	it("balances rows without leaving a single group on the first row", () => {
		const groups: ContextToolGroup[] = [
			{ id: "heavy", estimatedWidth: 300 },
			{ id: "a", estimatedWidth: 80 },
			{ id: "b", estimatedWidth: 80 },
			{ id: "c", estimatedWidth: 80 },
		]
		const result = partitionContextToolGroups(groups, 400)
		expect(result).toHaveLength(2)
		expect(result[0].map((g) => g.id)).toEqual(["heavy", "a"])
		expect(result[1].map((g) => g.id)).toEqual(["b", "c"])
	})

	it("re-splits typical tools so each row fits a sidebar-narrowed canvas", () => {
		const availableWidth = getContextToolbarRowMaxWidth(400)
		const result = partitionContextToolGroups(TYPICAL_CONTEXT_GROUPS, availableWidth)

		expect(result).toHaveLength(2)
		for (const row of result) {
			expect(getContextToolbarRowWidth(row)).toBeLessThanOrEqual(availableWidth)
		}
	})

	it("wraps extra rows when value-sized controls overflow a balanced split", () => {
		const typographyWidth = getContextToolbarTypographyWidth({
			fontSize: "88",
			lineHeight: "82.72px",
			showAdjuster: true,
		})
		expect(typographyWidth).toBeGreaterThan(232)
		expect(typographyWidth).toBe(
			getMetricControlWidth("88") + 56 + getMetricControlWidth("82.72px") + 8,
		)

		const groups: ContextToolGroup[] = [
			{ id: "actions", estimatedWidth: 124 },
			{ id: "typography", estimatedWidth: typographyWidth },
			{ id: "formatting", estimatedWidth: 116 },
			{ id: "alignment", estimatedWidth: 96 },
			{ id: "appearance", estimatedWidth: 64 },
			{ id: "more", estimatedWidth: 76 },
		]
		const availableWidth = 400
		const result = partitionContextToolGroups(groups, availableWidth)

		expect(result.length).toBeGreaterThan(2)
		for (const row of result) {
			expect(getContextToolbarRowWidth(row)).toBeLessThanOrEqual(availableWidth)
		}
	})

	it("fills leftover space with font size and A↑A↓ together", () => {
		const units = getContextToolbarTypographyUnits({
			fontSize: "88",
			lineHeight: "82.72px",
			showAdjuster: true,
		})
		const groups: ContextToolGroup[] = [
			{ id: "actions", estimatedWidth: CONTEXT_TOOLBAR_ACTIONS_WIDTH },
			{
				id: "typography",
				estimatedWidth: getContextToolbarTypographyWidth({
					fontSize: "88",
					lineHeight: "82.72px",
					showAdjuster: true,
				}),
				items: units,
			},
			{ id: "formatting", estimatedWidth: CONTEXT_TOOLBAR_FORMATTING_WIDTH },
		]

		const result = partitionContextToolGroups(groups, 400)

		expect(result[0].map((group) => group.id)).toEqual(["actions", "typography"])
		expect(result[0][1]?.items?.map((item) => item.id)).toEqual(["fontSize"])
		expect(result[1]?.[0]?.items?.map((item) => item.id)).toEqual(["lineHeight"])
		for (const row of result) {
			expect(getContextToolbarRowWidth(row)).toBeLessThanOrEqual(400)
			expect(
				row.some((group) => group.items?.every((item) => item.id === "fontAdjuster")),
			).toBe(false)
		}
	})

	it("keeps a compact actions toolbar on one row at the minimum width", () => {
		const groups: ContextToolGroup[] = [
			{ id: "actions", estimatedWidth: CONTEXT_TOOLBAR_ACTIONS_WIDTH },
			{
				id: "typography",
				estimatedWidth: CONTEXT_TOOLBAR_FONT_ADJUSTER_WIDTH,
				items: [{ id: "fontSize", estimatedWidth: CONTEXT_TOOLBAR_FONT_ADJUSTER_WIDTH }],
			},
			{ id: "appearance", estimatedWidth: 32 },
			{ id: "more", estimatedWidth: CONTEXT_TOOLBAR_MORE_WIDTH },
		]

		const result = partitionContextToolGroups(groups, CONTEXT_TOOLBAR_MIN_WIDTH)

		expect(result).toHaveLength(1)
		expect(result[0]?.map((group) => group.id)).toEqual([
			"actions",
			"typography",
			"appearance",
			"more",
		])
	})

	it("does not leave only the actions group on the first row", () => {
		const groups: ContextToolGroup[] = [
			{ id: "actions", estimatedWidth: CONTEXT_TOOLBAR_ACTIONS_WIDTH },
			{
				id: "typography",
				estimatedWidth: CONTEXT_TOOLBAR_FONT_ADJUSTER_WIDTH,
				items: [{ id: "fontSize", estimatedWidth: CONTEXT_TOOLBAR_FONT_ADJUSTER_WIDTH }],
			},
			{ id: "appearance", estimatedWidth: 32 },
			{ id: "more", estimatedWidth: CONTEXT_TOOLBAR_MORE_WIDTH },
		]

		const result = partitionContextToolGroups(groups, 400)

		expect(result[0]?.map((group) => group.id)).not.toEqual(["actions"])
		expect(result[0]?.length).toBeGreaterThan(1)
	})

	it("packs a typical heading toolbar into two rows at the default cap", () => {
		const result = partitionContextToolGroups(
			headingToolbarGroups(),
			CONTEXT_TOOLBAR_ROW_MAX_WIDTH,
		)

		expect(result).toHaveLength(2)
		expect(result.some((row) => row.map((group) => group.id).includes("more"))).toBe(true)
		expect(result[result.length - 1]?.length).toBeGreaterThan(1)
		for (const row of result) {
			expect(getContextToolbarRowWidth(row)).toBeLessThanOrEqual(
				CONTEXT_TOOLBAR_ROW_MAX_WIDTH,
			)
		}
	})

	it("packs a typical heading toolbar into at most three rows", () => {
		const result = partitionContextToolGroups(headingToolbarGroups(), 392)

		expect(result.length).toBeLessThanOrEqual(3)
		expect(result[0]?.map((group) => group.id)).toEqual(["actions", "typography"])
		expect(result[0]?.[1]?.items?.map((item) => item.id)).toEqual(["fontSize"])
		expect(result.some((row) => row.length === 1 && row[0]?.id === "alignment")).toBe(false)
		expect(result.some((row) => row.length === 1 && row[0]?.id === "more")).toBe(false)
		for (const row of result) {
			expect(getContextToolbarRowWidth(row)).toBeLessThanOrEqual(392)
		}
	})

	it("keeps More Styles with appearance instead of leaving it alone", () => {
		const result = partitionContextToolGroups(headingToolbarGroups(), 480)

		expect(result.some((row) => row.length === 1 && row[0]?.id === "more")).toBe(false)
		expect(result[result.length - 1]?.map((group) => group.id)).toEqual(["appearance", "more"])
		for (const row of result) {
			expect(getContextToolbarRowWidth(row)).toBeLessThanOrEqual(480)
		}
	})
})
