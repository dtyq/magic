import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"
import type { DomTreeNode } from "../../../iframe-bridge/types/messages"
import {
	getDomTreeNodeDisplayLabel,
	getDomTreeSemanticLabel,
	getTextInsertPlacementLabel,
	getSemanticKey,
} from "../domTreeModel"

const translate = ((key: string) => key) as TFunction

function createNode(textContent?: string): DomTreeNode {
	return {
		nodeId: "section-1",
		selector: "section.hero",
		tagName: "section",
		label: "section",
		textContent,
		children: [],
		editable: true,
		canHaveChildren: true,
		canDelete: true,
		canMove: true,
	}
}

describe("domTreeModel", () => {
	it("uses the semantic label and direct text for a node display label", () => {
		expect(getDomTreeNodeDisplayLabel(createNode("工作方向二"), "容器")).toBe(
			"容器 · 工作方向二",
		)
	})

	it("uses only the semantic label when a node has no direct text", () => {
		expect(getDomTreeNodeDisplayLabel(createNode(), "容器")).toBe("容器")
	})

	it("maps semantic keys to literal translation keys", () => {
		expect(getDomTreeSemanticLabel(translate, getSemanticKey("span"))).toBe(
			"stylePanel.domTree.semantic.text",
		)
		expect(getDomTreeSemanticLabel(translate, getSemanticKey("section"))).toBe(
			"stylePanel.domTree.semantic.container",
		)
	})

	it("maps heading tags to level-specific labels", () => {
		expect(getDomTreeSemanticLabel(translate, getSemanticKey("h1"))).toBe(
			"stylePanel.domTree.semantic.heading1",
		)
		expect(getDomTreeSemanticLabel(translate, getSemanticKey("h2"))).toBe(
			"stylePanel.domTree.semantic.heading2",
		)
		expect(getDomTreeSemanticLabel(translate, getSemanticKey("H3"))).toBe(
			"stylePanel.domTree.semantic.heading3",
		)
	})

	it("maps every text insertion placement to its literal translation key", () => {
		expect(getTextInsertPlacementLabel(translate, "before")).toBe(
			"stylePanel.domTree.addTextDialog.placements.before",
		)
		expect(getTextInsertPlacementLabel(translate, "inside")).toBe(
			"stylePanel.domTree.addTextDialog.placements.inside",
		)
		expect(getTextInsertPlacementLabel(translate, "after")).toBe(
			"stylePanel.domTree.addTextDialog.placements.after",
		)
	})
})
