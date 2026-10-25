import type React from "react"
import type { AttachmentItem } from "../hooks/types"
import { resolveAttachmentKey } from "./attachmentIndex"
import type { TreeNodeData } from "./treeDataConverter"

export interface VisibleTreeNodeRow {
	node: TreeNodeData
	parentNode: TreeNodeData | null
	ancestorKeys: string[]
}

export interface VisibleTreeScrollAnchor {
	key: string
	index: number
	offsetPx: number
}

function createVisibleAttachmentNode(
	item: AttachmentItem,
	level: number,
	fallbackKey: string,
	renamingItemId?: string | null,
): TreeNodeData {
	const key = resolveAttachmentKey(item, fallbackKey)
	const hasChildren = Boolean(
		item.is_directory &&
		(item.children?.length ||
			(item.directoryLoadState && item.directoryLoadState !== "loaded")),
	)

	return {
		key,
		title: null,
		item,
		isVirtual: (item as { isVirtual?: boolean })?.isVirtual,
		level,
		disabled: renamingItemId === key || (item as { isVirtual?: boolean })?.isVirtual,
		isLeaf: !hasChildren,
	}
}

export function flattenVisibleAttachmentTreeRows(
	attachments: AttachmentItem[],
	expandedKeySet: ReadonlySet<string>,
	renamingItemId?: string | null,
) {
	const visibleRows: VisibleTreeNodeRow[] = []
	const stack = attachments
		.map((item, index) => ({
			item,
			level: 0,
			parentNode: null as TreeNodeData | null,
			ancestorKeys: [] as string[],
			fallbackKey: `root-${index}`,
		}))
		.reverse()

	while (stack.length > 0) {
		const row = stack.pop()
		if (!row || row.item?.is_hidden) continue

		const node = createVisibleAttachmentNode(
			row.item,
			row.level,
			row.fallbackKey,
			renamingItemId,
		)
		visibleRows.push({
			node,
			parentNode: row.parentNode,
			ancestorKeys: row.ancestorKeys,
		})

		const children = row.item.children || []
		if (!children.length || !expandedKeySet.has(String(node.key))) continue

		const childAncestorKeys = [...row.ancestorKeys, String(node.key)]
		for (let index = children.length - 1; index >= 0; index -= 1) {
			stack.push({
				item: children[index],
				level: row.level + 1,
				parentNode: node,
				ancestorKeys: childAncestorKeys,
				fallbackKey: `${row.fallbackKey}-${index}`,
			})
		}
	}

	return visibleRows
}

export function getDragReceiverNode(row: VisibleTreeNodeRow) {
	const { node, parentNode } = row
	const item = node.item

	if (!item) return null
	if (item.is_directory || node.level === 0) return node

	// File rows are not targets; drops over them should use the parent folder.
	return parentNode?.item?.is_directory ? parentNode : null
}

export function getDragTargetBlockRange(
	visibleRows: VisibleTreeNodeRow[],
	dragTargetKey?: React.Key | null,
) {
	if (dragTargetKey === undefined || dragTargetKey === null) return null

	const targetKey = String(dragTargetKey)
	if (!targetKey) return null

	const startIndex = visibleRows.findIndex((row) => String(row.node.key) === targetKey)
	if (startIndex === -1 || !visibleRows[startIndex].node.item?.is_directory) return null

	let endIndex = startIndex
	for (let index = startIndex + 1; index < visibleRows.length; index += 1) {
		if (!visibleRows[index].ancestorKeys.includes(targetKey)) break
		endIndex = index
	}

	return { startIndex, endIndex }
}

export function buildVisibleNodeIndexByKey(visibleNodes: TreeNodeData[]) {
	const indexByKey = new Map<string, number>()

	visibleNodes.forEach((node, index) => {
		indexByKey.set(String(node.key), index)
		// Register file_id as an alias so locate, active file, and scroll share the row index.
		if (node.item?.file_id) {
			indexByKey.set(String(node.item.file_id), index)
		}
	})

	return indexByKey
}

export function resolveVisibleTreeScrollAnchor(
	visibleNodes: TreeNodeData[],
	scrollTop: number,
	rowHeight: number,
): VisibleTreeScrollAnchor | null {
	if (!visibleNodes.length || rowHeight <= 0) return null

	const index = Math.min(visibleNodes.length - 1, Math.max(0, Math.floor(scrollTop / rowHeight)))
	const node = visibleNodes[index]
	if (!node) return null

	return {
		key: String(node.key),
		index,
		offsetPx: Math.max(0, scrollTop - index * rowHeight),
	}
}

export function resolveVisibleTreeScrollTopForAnchor(
	anchor: VisibleTreeScrollAnchor,
	visibleNodeIndexByKey: ReadonlyMap<string, number>,
	rowHeight: number,
) {
	const index = visibleNodeIndexByKey.get(anchor.key)
	if (index === undefined || rowHeight <= 0) return null
	return Math.max(0, index * rowHeight + anchor.offsetPx)
}
