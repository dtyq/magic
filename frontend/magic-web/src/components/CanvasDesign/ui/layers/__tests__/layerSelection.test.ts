import { describe, expect, it } from "vitest"
import { ElementTypeEnum } from "../../../runtime/document/types"
import type { TreeNode } from "../../primitives/custom/Tree/types"
import type { LayerTreeData } from "../types"
import {
	areAllLayersChecked,
	areSomeLayersChecked,
	collectAllLayerIds,
	collectMatchingLayerIds,
	getLayerCheckState,
	getOutermostSelectedLayerIds,
	toggleLayerTreeSelection,
} from "../layerSelection"

function node(
	id: string,
	data: Partial<LayerTreeData>,
	children?: TreeNode<LayerTreeData>[],
): TreeNode<LayerTreeData> {
	return { id, label: id, data: data as LayerTreeData, children }
}

const defaultFilter = { visibility: "all" as const, locked: "all" as const, types: [] }

describe("layerSelection", () => {
	it("collects matching nodes without retaining path-only ancestors", () => {
		const tree = [
			node("frame", { type: ElementTypeEnum.Frame }, [
				node("hidden-image", { type: ElementTypeEnum.Image, visible: false }),
			]),
		]

		expect(
			collectMatchingLayerIds(tree, "", { ...defaultFilter, visibility: "hidden" }),
		).toEqual(["hidden-image"])
	})

	it("returns an empty result when no layer matches", () => {
		expect(
			collectMatchingLayerIds(
				[node("image", { type: ElementTypeEnum.Image, visible: true })],
				"missing",
				defaultFilter,
			),
		).toEqual([])
	})

	it("collects every node id in tree order", () => {
		const tree = [
			node("frame", { type: ElementTypeEnum.Frame }, [
				node("child", { type: ElementTypeEnum.Image }),
			]),
			node("other", { type: ElementTypeEnum.Text }),
		]

		expect(collectAllLayerIds(tree)).toEqual(["frame", "child", "other"])
	})

	it("keeps only outermost selected nodes for reorder operations", () => {
		const tree = [
			node("frame", { type: ElementTypeEnum.Frame }, [
				node("child", { type: ElementTypeEnum.Image }),
			]),
			node("other", { type: ElementTypeEnum.Text }),
		]

		expect(getOutermostSelectedLayerIds(tree, ["child", "frame", "other"])).toEqual([
			"frame",
			"other",
		])
	})

	it("derives checked / indeterminate states for frame children like attachment folders", () => {
		const tree = [
			node("frame", { type: ElementTypeEnum.Frame }, [
				node("a", { type: ElementTypeEnum.Image }),
				node("b", { type: ElementTypeEnum.Image }),
			]),
		]

		expect(getLayerCheckState(tree, ["frame"], "frame")).toBe("checked")
		expect(getLayerCheckState(tree, ["frame"], "a")).toBe("checked")
		expect(getLayerCheckState(tree, ["a"], "frame")).toBe("indeterminate")
		expect(getLayerCheckState(tree, ["a"], "a")).toBe("checked")
		expect(getLayerCheckState(tree, ["a"], "b")).toBe("unchecked")
	})

	it("toggles parent selection compactly and expands siblings when unchecking an inherited child", () => {
		const tree = [
			node("frame", { type: ElementTypeEnum.Frame }, [
				node("a", { type: ElementTypeEnum.Image }),
				node("b", { type: ElementTypeEnum.Image }),
				node("c", { type: ElementTypeEnum.Image }),
			]),
		]

		expect(toggleLayerTreeSelection(tree, [], "frame")).toEqual(["frame"])
		expect([...toggleLayerTreeSelection(tree, ["frame"], "b")].sort()).toEqual(["a", "c"])
		expect(toggleLayerTreeSelection(tree, ["a"], "frame")).toEqual(["frame"])
	})

	it("reports all / some checked for header select-all state", () => {
		const tree = [
			node("frame", { type: ElementTypeEnum.Frame }, [
				node("a", { type: ElementTypeEnum.Image }),
			]),
			node("other", { type: ElementTypeEnum.Text }),
		]

		expect(areAllLayersChecked(tree, ["frame", "other"])).toBe(true)
		expect(areAllLayersChecked(tree, ["frame"])).toBe(false)
		expect(areSomeLayersChecked(tree, ["frame"])).toBe(true)
		expect(areSomeLayersChecked(tree, [])).toBe(false)
	})
})
