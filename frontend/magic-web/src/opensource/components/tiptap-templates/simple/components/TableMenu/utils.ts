import type { Editor } from "@tiptap/react"
import { findParentNode } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

/**
 * Check if the cursor is currently inside a table
 */
export function isInTable(editor: Editor | null): boolean {
	if (!editor) return false

	const { selection } = editor.state
	const tableNode = findParentNode((node) => node.type.name === "table")(selection)

	return !!tableNode
}

/**
 * Get the table node and its position if cursor is in a table
 */
export function getTableNode(editor: Editor | null): {
	node: ProseMirrorNode
	pos: number
} | null {
	if (!editor) return null

	const { selection } = editor.state
	const tableNode = findParentNode((node) => node.type.name === "table")(selection)

	if (!tableNode) return null

	return {
		node: tableNode.node,
		pos: tableNode.pos,
	}
}

/**
 * Get the table cell node and its position if cursor is in a table cell
 */
export function getTableCellNode(editor: Editor | null): {
	node: ProseMirrorNode
	pos: number
} | null {
	if (!editor) return null

	const { selection } = editor.state
	const cellNode = findParentNode(
		(node) => node.type.name === "tableCell" || node.type.name === "tableHeader",
	)(selection)

	if (!cellNode) return null

	return {
		node: cellNode.node,
		pos: cellNode.pos,
	}
}

/**
 * Get the coordinates of the current table cell for positioning the menu
 */
export function getTableCellCoordinates(editor: Editor | null): {
	top: number
	left: number
	width: number
	height: number
} | null {
	if (!editor) return null

	const { view, state } = editor
	const { selection } = state

	// Get coordinates at the current selection position
	const coords = view.coordsAtPos(selection.head)
	if (!coords) return null

	// Try to find the table cell DOM element
	const cellNode = findParentNode(
		(node) => node.type.name === "tableCell" || node.type.name === "tableHeader",
	)(selection)

	if (!cellNode) return null

	// Get the DOM node for the cell
	const cellPos = cellNode.pos
	const cellDOM = view.nodeDOM(cellPos)
	if (!cellDOM || !(cellDOM instanceof HTMLElement)) return null

	const rect = cellDOM.getBoundingClientRect()

	return {
		top: rect.top,
		left: rect.left,
		width: rect.width,
		height: rect.height,
	}
}
