import { describe, expect, it } from "vitest"
import { StylePanelStore } from "../StylePanelStore"

describe("StylePanelStore more styles tab cache", () => {
	it("remembers a tab per selector and clears it on reset", () => {
		const store = new StylePanelStore()

		store.rememberMoreStylesTab("img.hero", "layout")
		store.rememberMoreStylesTab("img.cover", "border")

		expect(store.getMoreStylesTab("img.hero")).toBe("layout")
		expect(store.getMoreStylesTab("img.cover")).toBe("border")

		store.reset()

		expect(store.getMoreStylesTab("img.hero")).toBeUndefined()
		expect(store.getMoreStylesTab("img.cover")).toBeUndefined()
	})

	it("updates selected width and height for live resize previews", () => {
		const store = new StylePanelStore()
		store.selectElement({
			selector: "div.card",
			tagName: "div",
			computedStyles: {
				color: "#000",
				fontSize: "16px",
				fontWeight: "400",
				fontFamily: "sans-serif",
				fontStyle: "normal",
				lineHeight: "24px",
				textAlign: "left",
				textDecoration: "none",
				backgroundColor: "transparent",
				backgroundImage: "none",
				width: "476px",
				height: "324px",
				display: "block",
				position: "relative",
				margin: "0px",
				marginTop: "0px",
				marginRight: "0px",
				marginBottom: "0px",
				marginLeft: "0px",
				padding: "0px",
				paddingTop: "0px",
				paddingRight: "0px",
				paddingBottom: "0px",
				paddingLeft: "0px",
				border: "none",
				borderWidth: "0px",
				borderStyle: "none",
				borderColor: "transparent",
				borderRadius: "0px",
				flexDirection: "row",
				justifyContent: "flex-start",
				alignItems: "stretch",
				flexWrap: "nowrap",
				gap: "0px",
				gridTemplateColumns: "none",
				gridTemplateRows: "none",
				justifyItems: "stretch",
				opacity: "1",
				boxShadow: "none",
				textShadow: "none",
			},
		})

		store.updateComputedStyles({ width: "500px", height: "360px" })

		expect(store.selectedElement?.computedStyles.width).toBe("500px")
		expect(store.selectedElement?.computedStyles.height).toBe("360px")
	})

	it("ignores empty selectors and tabs", () => {
		const store = new StylePanelStore()

		store.rememberMoreStylesTab("", "layout")
		store.rememberMoreStylesTab("img.hero", "")

		expect(store.getMoreStylesTab("img.hero")).toBeUndefined()
		expect(store.getMoreStylesTab("")).toBeUndefined()
	})
})

function styles(rowGap: string, columnGap: string) {
	return {
		color: "#000",
		fontSize: "16px",
		fontWeight: "400",
		fontFamily: "sans-serif",
		fontStyle: "normal",
		lineHeight: "24px",
		textAlign: "left",
		textDecoration: "none",
		backgroundColor: "transparent",
		backgroundImage: "none",
		width: "100px",
		height: "100px",
		display: "flex",
		position: "relative",
		margin: "0px",
		marginTop: "0px",
		marginRight: "0px",
		marginBottom: "0px",
		marginLeft: "0px",
		padding: "0px",
		paddingTop: "0px",
		paddingRight: "0px",
		paddingBottom: "0px",
		paddingLeft: "0px",
		border: "none",
		borderWidth: "0px",
		borderStyle: "none",
		borderColor: "transparent",
		borderRadius: "0px",
		flexDirection: "row",
		justifyContent: "flex-start",
		alignItems: "stretch",
		flexWrap: "nowrap",
		gap: "0px",
		rowGap,
		columnGap,
		gridTemplateColumns: "none",
		gridTemplateRows: "none",
		justifyItems: "stretch",
		opacity: "1",
		boxShadow: "none",
		textShadow: "none",
	}
}

describe("StylePanelStore gap axes lock", () => {
	it("links gap axes when a newly selected element has equal gaps", () => {
		const store = new StylePanelStore()
		store.selectElement({
			selector: "div.cards",
			tagName: "div",
			computedStyles: styles("16px", "16px"),
		})
		expect(store.gapAxesLinked).toBe(true)
		store.setGapAxesLinked(false)
		store.selectElement({
			selector: "div.cards",
			tagName: "div",
			computedStyles: styles("16px", "16px"),
		})
		expect(store.gapAxesLinked).toBe(false)
	})
})
