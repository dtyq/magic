import { describe, expect, it } from "vitest"
import { getLayoutConstraintHints } from "../layoutConstraintHint"

describe("getLayoutConstraintHints", () => {
	it("explains distributed alignment when gap cannot close leftover space", () => {
		const hints = getLayoutConstraintHints({
			display: "flex",
			justifyContent: "space-between",
			flexDirection: "row",
		})
		expect(hints).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "distributed-alignment",
					fix: { justifyContent: "flex-start" },
				}),
			]),
		)
	})

	it("does not hint when alignment already uses fixed packing", () => {
		expect(
			getLayoutConstraintHints({
				display: "flex",
				justifyContent: "flex-start",
			}),
		).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: "distributed-alignment" })]),
		)
	})

	it("explains a stretched flex item whose width is owned by the parent", () => {
		const hints = getLayoutConstraintHints({
			display: "block",
			width: "320px",
			parentDisplay: "flex",
			parentFlexDirection: "row",
			parentAlignItems: "stretch",
			flexGrow: "1",
			alignSelf: "auto",
		})
		expect(hints).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "parent-owned-size",
					axis: "width",
					fix: {
						flexGrow: "0",
						flexShrink: "0",
						width: "320px",
					},
				}),
			]),
		)
	})

	it("explains a stretched cross-axis size when that axis is auto", () => {
		const hints = getLayoutConstraintHints({
			display: "block",
			height: "80px",
			declaredHeight: "auto",
			parentDisplay: "flex",
			parentFlexDirection: "row",
			parentAlignItems: "stretch",
			alignSelf: "auto",
			flexGrow: "0",
		})
		expect(hints).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "parent-owned-size",
					axis: "height",
					fix: {
						alignSelf: "flex-start",
						height: "80px",
					},
				}),
			]),
		)
	})

	it("does not treat an explicit cross-axis size as parent-owned stretch", () => {
		const hints = getLayoutConstraintHints({
			display: "block",
			height: "80px",
			declaredHeight: "80px",
			parentDisplay: "flex",
			parentFlexDirection: "row",
			parentAlignItems: "stretch",
			alignSelf: "auto",
			flexGrow: "0",
		})
		expect(hints).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: "parent-owned-size" })]),
		)
	})

	it("does not infer stretch from a computed used size alone", () => {
		const hints = getLayoutConstraintHints({
			display: "block",
			height: "80px",
			parentDisplay: "flex",
			parentFlexDirection: "row",
			parentAlignItems: "stretch",
			alignSelf: "auto",
			flexGrow: "0",
		})
		expect(hints).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "parent-owned-size", axis: "height" }),
			]),
		)
	})

	it("reports flex-grow and stretch on different axes together", () => {
		const hints = getLayoutConstraintHints({
			display: "block",
			width: "320px",
			height: "80px",
			declaredHeight: "auto",
			parentDisplay: "flex",
			parentFlexDirection: "row",
			parentAlignItems: "stretch",
			flexGrow: "1",
			alignSelf: "auto",
		})
		expect(hints).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "parent-owned-size",
					axis: "width",
					fix: {
						flexGrow: "0",
						flexShrink: "0",
						width: "320px",
					},
				}),
				expect.objectContaining({
					kind: "parent-owned-size",
					axis: "height",
					fix: {
						alignSelf: "flex-start",
						height: "80px",
					},
				}),
			]),
		)
	})
})
