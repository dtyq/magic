import { mergeAttributes } from "@tiptap/react"
import { Table } from "@tiptap/extension-table"
import { TextSelection } from "@tiptap/pm/state"

import type { Editor } from "@tiptap/react"

const TABLE_CELL_NODE_NAMES = new Set(["tableCell", "tableHeader"])

const getTableCellContentRange = (editor: Editor) => {
	const { $from } = editor.state.selection

	for (let depth = $from.depth; depth > 0; depth -= 1) {
		if (!TABLE_CELL_NODE_NAMES.has($from.node(depth).type.name)) continue

		return {
			from: $from.start(depth),
			to: $from.end(depth),
		}
	}

	return null
}

const runListItemCommandInTableCell = (
	editor: Editor,
	command: "sinkListItem" | "liftListItem",
) => {
	if (!getTableCellContentRange(editor)) return false

	if (editor.schema.nodes.listItem && editor.commands[command]("listItem")) {
		return true
	}

	if (editor.schema.nodes.taskItem && editor.commands[command]("taskItem")) {
		return true
	}

	return false
}

const selectCurrentTableCellContent = (editor: Editor) => {
	const range = getTableCellContentRange(editor)
	if (!range) return false

	const { state, view } = editor
	const selection = TextSelection.between(
		state.doc.resolve(range.from),
		state.doc.resolve(range.to),
		1,
	)

	view.dispatch(state.tr.setSelection(selection))
	return true
}

// Custom Table extension with wrapper for horizontal overflow handling
export const TableWithWrapper = Table.extend({
	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			{ class: "tableWrapper" },
			["table", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0],
		]
	},

	addKeyboardShortcuts() {
		return {
			...this.parent?.(),
			Tab: () => {
				if (runListItemCommandInTableCell(this.editor, "sinkListItem")) {
					return true
				}

				if (this.editor.commands.goToNextCell()) {
					return true
				}

				if (!this.editor.can().addRowAfter()) {
					return false
				}

				return this.editor.chain().addRowAfter().goToNextCell().run()
			},
			"Shift-Tab": () => {
				if (runListItemCommandInTableCell(this.editor, "liftListItem")) {
					return true
				}

				return this.editor.commands.goToPreviousCell()
			},
			"Mod-a": () => selectCurrentTableCellContent(this.editor),
		}
	},
})

export default TableWithWrapper
