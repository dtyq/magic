import type { TreeNode } from "../primitives/custom/Tree/types"
import { ElementTypeEnum, type ElementType } from "../../runtime/document/types"
import type { CanvasLayersFilterState } from "../../public/magic-types"
import type { LayerTreeData } from "./types"

export type LayersFilterState = CanvasLayersFilterState

export const DEFAULT_LAYERS_FILTER: LayersFilterState = {
	visibility: "all",
	locked: "all",
	types: [],
}

const ELEMENT_TYPES = Object.values(ElementTypeEnum) as ElementType[]

export function normalizeLayersFilter(value: unknown): LayersFilterState {
	if (!value || typeof value !== "object") {
		return { ...DEFAULT_LAYERS_FILTER }
	}

	const candidate = value as Partial<LayersFilterState>
	const visibility =
		candidate.visibility === "visible" || candidate.visibility === "hidden"
			? candidate.visibility
			: "all"
	const locked =
		candidate.locked === "locked" || candidate.locked === "unlocked" ? candidate.locked : "all"
	const types = Array.isArray(candidate.types)
		? Array.from(
				new Set(
					candidate.types.filter(
						(type): type is ElementType =>
							typeof type === "string" && ELEMENT_TYPES.includes(type as ElementType),
					),
				),
			)
		: []

	return { visibility, locked, types }
}

export function isDefaultLayersFilter(filter: LayersFilterState): boolean {
	return filter.visibility === "all" && filter.locked === "all" && filter.types.length === 0
}

export function hasActiveLayersFilter(filter: LayersFilterState): boolean {
	return !isDefaultLayersFilter(filter)
}

export function matchesStructuredLayerFilter(
	node: TreeNode<LayerTreeData>,
	filter: LayersFilterState,
) {
	const data = node.data
	if (!data) return false

	if (filter.visibility === "visible" && data.visible === false) return false
	if (filter.visibility === "hidden" && data.visible !== false) return false
	if (filter.locked === "locked" && data.locked !== true) return false
	if (filter.locked === "unlocked" && data.locked === true) return false
	if (filter.types.length > 0 && !filter.types.includes(data.type)) return false

	return true
}

export function matchesLayerSearch(node: TreeNode<LayerTreeData>, keyword: string): boolean {
	const normalizedKeyword = keyword.trim().toLowerCase()
	return !normalizedKeyword || node.label.trim().toLowerCase().includes(normalizedKeyword)
}

/**
 * 过滤图层树：保留命中节点及其祖先路径；结构化条件下子节点会继续独立过滤。
 * 仅名称搜索且父节点命中时保留原有的完整子树行为。
 */
export function filterLayerTreeData(
	nodes: TreeNode<LayerTreeData>[],
	keyword: string,
	filter: LayersFilterState = DEFAULT_LAYERS_FILTER,
): TreeNode<LayerTreeData>[] {
	const normalizedKeyword = keyword.trim().toLowerCase()
	const hasStructuredFilter = hasActiveLayersFilter(filter)
	if (!normalizedKeyword && !hasStructuredFilter) return nodes

	const filterNodes = (items: TreeNode<LayerTreeData>[]): TreeNode<LayerTreeData>[] => {
		return items.reduce<TreeNode<LayerTreeData>[]>((result, node) => {
			const matchesKeyword = matchesLayerSearch(node, normalizedKeyword)
			const matchesFilter = matchesStructuredLayerFilter(node, filter)
			const children = node.children ? filterNodes(node.children) : []

			if (matchesKeyword && matchesFilter) {
				if (!hasStructuredFilter && normalizedKeyword) {
					result.push(node)
				} else {
					result.push({ ...node, children: children.length > 0 ? children : undefined })
				}
				return result
			}

			if (children.length > 0) {
				result.push({ ...node, children })
			}

			return result
		}, [])
	}

	return filterNodes(nodes)
}

export function collectExpandableNodeIds(
	nodes: TreeNode<LayerTreeData>[],
	result = new Set<string>(),
): Set<string> {
	nodes.forEach((node) => {
		if (node.children?.length) {
			result.add(node.id)
			collectExpandableNodeIds(node.children, result)
		}
	})
	return result
}
