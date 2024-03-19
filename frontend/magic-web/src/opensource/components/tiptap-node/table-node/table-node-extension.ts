import { mergeAttributes } from "@tiptap/react"
import { Table } from "@tiptap/extension-table"

// Custom Table extension with wrapper for horizontal overflow handling
export const TableWithWrapper = Table.extend({
	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			{ class: "tableWrapper" },
			["table", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0],
		]
	},
})

export default TableWithWrapper
