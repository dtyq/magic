import type { TreeNode } from "../primitives/custom/Tree/types"
import type { CanvasLayersFilterState } from "../../public/magic-types"
import type { LayerTreeData } from "./types"
import { matchesLayerSearch, matchesStructuredLayerFilter } from "./layerFilters"

export type LayerCheckState = "checked" | "unchecked" | "indeterminate"

/**
 * Collect only nodes that satisfy the active search/filter predicates.
 * Ancestors retained by filterLayerTreeData solely to keep the tree path
 * visible are intentionally excluded from this result.
 */
export function collectMatchingLayerIds(
	nodes: TreeNode<LayerTreeData>[],
	keyword: string,
	filter: CanvasLayersFilterState,
): string[] {
	const matchedIds: string[] = []

	const visit = (items: TreeNode<LayerTreeData>[]) => {
		items.forEach((node) => {
			if (matchesLayerSearch(node, keyword) && matchesStructuredLayerFilter(node, filter)) {
				matchedIds.push(node.id)
			}
			if (node.children?.length) visit(node.children)
		})
	}

	visit(nodes)
	return matchedIds
}

/** Collect every node id currently visible in the layer tree list. */
export function collectAllLayerIds(nodes: TreeNode<LayerTreeData>[]): string[] {
	const ids: string[] = []

	const visit = (items: TreeNode<LayerTreeData>[]) => {
		items.forEach((node) => {
			ids.push(node.id)
			if (node.children?.length) visit(node.children)
		})
	}

	visit(nodes)
	return ids
}

/**
 * Collapse a selection to its outermost selected nodes while preserving tree
 * order. This prevents reordering a child twice when its parent is selected too.
 */
export function getOutermostSelectedLayerIds(
	nodes: TreeNode<LayerTreeData>[],
	selectedIds: string[],
): string[] {
	const selectedIdSet = new Set(selectedIds)
	const result: string[] = []

	const visit = (items: TreeNode<LayerTreeData>[], hasSelectedAncestor = false) => {
		items.forEach((node) => {
			const isSelected = selectedIdSet.has(node.id)
			if (isSelected && !hasSelectedAncestor) result.push(node.id)
			if (node.children?.length) visit(node.children, hasSelectedAncestor || isSelected)
		})
	}

	visit(nodes)
	return result
}

function collectDescendantIds(node: TreeNode<LayerTreeData>): string[] {
	const ids: string[] = []
	const visit = (items: TreeNode<LayerTreeData>[]) => {
		items.forEach((child) => {
			ids.push(child.id)
			if (child.children?.length) visit(child.children)
		})
	}
	if (node.children?.length) visit(node.children)
	return ids
}

function findNodePath(
	nodes: TreeNode<LayerTreeData>[],
	targetId: string,
	path: TreeNode<LayerTreeData>[] = [],
): TreeNode<LayerTreeData>[] | null {
	for (const node of nodes) {
		const nextPath = [...path, node]
		if (node.id === targetId) return nextPath
		if (node.children?.length) {
			const found = findNodePath(node.children, targetId, nextPath)
			if (found) return found
		}
	}
	return null
}

function hasSelectedAncestor(
	nodes: TreeNode<LayerTreeData>[],
	nodeId: string,
	selectedIdSet: ReadonlySet<string>,
): boolean {
	const path = findNodePath(nodes, nodeId)
	if (!path || path.length < 2) return false
	return path.slice(0, -1).some((ancestor) => selectedIdSet.has(ancestor.id))
}

/**
 * Attachment-list style check state: a Frame/Group is checked when itself is
 * selected or every child is checked; indeterminate when only some descendants
 * are selected.
 */
export function getLayerCheckState(
	nodes: TreeNode<LayerTreeData>[],
	selectedIds: readonly string[],
	nodeId: string,
): LayerCheckState {
	const selectedIdSet = new Set(selectedIds)
	const path = findNodePath(nodes, nodeId)
	if (!path) return "unchecked"
	const node = path[path.length - 1]

	if (selectedIdSet.has(node.id) || hasSelectedAncestor(nodes, node.id, selectedIdSet)) {
		return "checked"
	}

	if (!node.children?.length) return "unchecked"

	let checkedCount = 0
	let indeterminateFound = false
	for (const child of node.children) {
		const childState = getLayerCheckState(nodes, selectedIds, child.id)
		if (childState === "checked") checkedCount += 1
		else if (childState === "indeterminate") indeterminateFound = true
	}

	if (indeterminateFound || (checkedCount > 0 && checkedCount < node.children.length)) {
		return "indeterminate"
	}
	return checkedCount === node.children.length ? "checked" : "unchecked"
}

/**
 * Toggle selection like attachment folders: selecting a parent stores only the
 * parent id; unchecking an inherited child expands siblings; indeterminate
 * parent collapses to a full parent selection.
 */
export function toggleLayerTreeSelection(
	nodes: TreeNode<LayerTreeData>[],
	selectedIds: readonly string[],
	nodeId: string,
): string[] {
	const selectedIdSet = new Set(selectedIds)
	const path = findNodePath(nodes, nodeId)
	if (!path) return [...selectedIds]
	const node = path[path.length - 1]
	const checkState = getLayerCheckState(nodes, selectedIds, nodeId)

	if (checkState === "unchecked") {
		return [...selectedIds, nodeId]
	}

	if (checkState === "indeterminate") {
		const descendantSet = new Set(collectDescendantIds(node))
		return selectedIds.filter((id) => !descendantSet.has(id)).concat([nodeId])
	}

	// checked → uncheck
	if (selectedIdSet.has(nodeId)) {
		return selectedIds.filter((id) => id !== nodeId)
	}

	// Inherited check via selected ancestor: expand siblings like attachment list.
	let nearestSelectedAncestor: TreeNode<LayerTreeData> | null = null
	let directChildOfAncestor: TreeNode<LayerTreeData> | null = null
	for (let index = path.length - 2; index >= 0; index -= 1) {
		const ancestor = path[index]
		if (selectedIdSet.has(ancestor.id)) {
			nearestSelectedAncestor = ancestor
			directChildOfAncestor = path[index + 1] ?? null
			break
		}
	}

	if (!nearestSelectedAncestor || !directChildOfAncestor) {
		const descendantSet = new Set(collectDescendantIds(node))
		return selectedIds.filter((id) => id !== nodeId && !descendantSet.has(id))
	}

	const excludeSet = new Set([nodeId, ...collectDescendantIds(node)])
	const siblingIds = (nearestSelectedAncestor.children ?? [])
		.map((child) => child.id)
		.filter((id) => id !== directChildOfAncestor!.id)
	const branchToExpand = collectDescendantIds(directChildOfAncestor).filter(
		(id) => !excludeSet.has(id),
	)

	return selectedIds
		.filter((id) => id !== nearestSelectedAncestor!.id)
		.concat(siblingIds)
		.concat(branchToExpand)
}

/** True when every visible node is checked (directly or via ancestor). */
export function areAllLayersChecked(
	nodes: TreeNode<LayerTreeData>[],
	selectedIds: readonly string[],
): boolean {
	const allIds = collectAllLayerIds(nodes)
	return (
		allIds.length > 0 &&
		allIds.every((id) => getLayerCheckState(nodes, selectedIds, id) === "checked")
	)
}

/** True when some but not all visible nodes are checked. */
export function areSomeLayersChecked(
	nodes: TreeNode<LayerTreeData>[],
	selectedIds: readonly string[],
): boolean {
	if (selectedIds.length === 0) return false
	if (areAllLayersChecked(nodes, selectedIds)) return false
	const allIds = collectAllLayerIds(nodes)
	return allIds.some((id) => getLayerCheckState(nodes, selectedIds, id) !== "unchecked")
}
