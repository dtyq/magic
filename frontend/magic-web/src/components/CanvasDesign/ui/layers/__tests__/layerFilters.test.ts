import { describe, expect, it } from "vitest"
import { ElementTypeEnum } from "../../../runtime/document/types"
import type { TreeNode } from "../../primitives/custom/Tree/types"
import type { LayerTreeData } from "../types"
import {
	DEFAULT_LAYERS_FILTER,
	collectExpandableNodeIds,
	filterLayerTreeData,
	hasActiveLayersFilter,
	normalizeLayersFilter,
} from "../layerFilters"

function node(
	id: string,
	type: LayerTreeData["type"],
	options: Partial<Pick<LayerTreeData, "visible" | "locked">> = {},
	children?: TreeNode<LayerTreeData>[],
): TreeNode<LayerTreeData> {
	return {
		id,
		label: id,
		data: { id, type, visible: true, locked: false, ...options } as LayerTreeData,
		children,
	}
}

const tree = [
	node("frame", ElementTypeEnum.Frame, {}, [
		node("hidden-image", ElementTypeEnum.Image, { visible: false }),
		node("locked-text", ElementTypeEnum.Text, { locked: true }),
	]),
	node("visible-video", ElementTypeEnum.Video),
]

describe("layer filters", () => {
	it("returns the complete tree for default filters", () => {
		expect(filterLayerTreeData(tree, "", DEFAULT_LAYERS_FILTER)).toBe(tree)
	})

	it("combines status filters with OR type selection", () => {
		const result = filterLayerTreeData(tree, "", {
			visibility: "visible",
			locked: "all",
			types: [ElementTypeEnum.Image, ElementTypeEnum.Video],
		})

		expect(result.map((item) => item.id)).toEqual(["visible-video"])
	})

	it("matches locked and unlocked elements by their own state", () => {
		expect(
			filterLayerTreeData(tree, "", {
				visibility: "all",
				locked: "locked",
				types: [],
			}),
		).toEqual([
			{
				...tree[0],
				children: [tree[0]?.children?.[1]],
			},
		])
		expect(
			filterLayerTreeData(tree, "", {
				visibility: "all",
				locked: "unlocked",
				types: [ElementTypeEnum.Text],
			}),
		).toEqual([])
	})

	it("keeps ancestor paths and filters children independently", () => {
		const result = filterLayerTreeData(tree, "", {
			visibility: "hidden",
			locked: "all",
			types: [],
		})

		expect(result).toHaveLength(1)
		expect(result[0]?.id).toBe("frame")
		expect(result[0]?.children?.map((item) => item.id)).toEqual(["hidden-image"])
		expect(Array.from(collectExpandableNodeIds(result))).toEqual(["frame"])
	})

	it("preserves the existing parent-name search subtree behavior", () => {
		const result = filterLayerTreeData(tree, "frame", DEFAULT_LAYERS_FILTER)

		expect(result[0]).toBe(tree[0])
	})

	it("combines name search with structured filters", () => {
		const result = filterLayerTreeData(tree, "locked", {
			visibility: "all",
			locked: "locked",
			types: [ElementTypeEnum.Text],
		})

		expect(result[0]?.id).toBe("frame")
		expect(result[0]?.children?.map((item) => item.id)).toEqual(["locked-text"])
	})

	it("normalizes invalid persisted values", () => {
		expect(
			normalizeLayersFilter({
				visibility: "invalid",
				locked: "locked",
				types: [ElementTypeEnum.Image, "removed-type", ElementTypeEnum.Image],
			}),
		).toEqual({ visibility: "all", locked: "locked", types: [ElementTypeEnum.Image] })
		expect(hasActiveLayersFilter(DEFAULT_LAYERS_FILTER)).toBe(false)
	})
})
