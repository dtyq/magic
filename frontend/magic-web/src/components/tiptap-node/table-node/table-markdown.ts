import { getHTMLFromFragment } from "@/infrastructure/editors/tiptap/core"
import { Fragment, type Node } from "@/infrastructure/editors/tiptap/pm-model"

interface TableMarkdownState {
	inTable: boolean
	out: string
	write: (content: string) => void
	renderInline: (node: Node) => void
	ensureNewLine: () => void
	closeBlock: (node: Node) => void
}

function canSerializeAsMarkdown(table: Node) {
	let supported = true
	table.forEach((row, _offset, rowIndex) => {
		row.forEach((cell) => {
			if (
				cell.type.name !== (rowIndex === 0 ? "tableHeader" : "tableCell") ||
				cell.attrs.colspan > 1 ||
				cell.attrs.rowspan > 1
			)
				supported = false
			cell.forEach((block) => {
				if (block.type.name !== "paragraph") supported = false
			})
		})
	})
	return supported
}

export function serializeTableMarkdown(state: TableMarkdownState, table: Node) {
	if (!canSerializeAsMarkdown(table)) {
		// Keep complex cell blocks and merged cells intact instead of flattening their data.
		const container = document.createElement("div")
		container.innerHTML = getHTMLFromFragment(Fragment.from(table), table.type.schema)
		const element = container.firstElementChild
		if (element) {
			element.innerHTML = `\n${element.innerHTML}\n`
			state.write(element.outerHTML)
		}
		state.closeBlock(table)
		return
	}

	const previousInTable = state.inTable
	state.inTable = true
	table.forEach((row, _offset, rowIndex) => {
		state.write("| ")
		row.forEach((cell, _cellOffset, cellIndex) => {
			if (cellIndex) state.write(" | ")
			cell.forEach((paragraph, _paragraphOffset, paragraphIndex) => {
				// Enter creates paragraphs in a cell; GFM needs inline breaks to keep one table row.
				if (paragraphIndex) state.write("<br>")
				const contentStart = state.out.length
				state.renderInline(paragraph)
				// The default hardBreak serializer drops trailing breaks. Reopened cell
				// paragraphs end in hardBreak nodes, so keep them on subsequent saves too.
				for (let index = paragraph.childCount - 1; index >= 0; index -= 1) {
					if (paragraph.child(index).type.name !== "hardBreak") break
					state.write("<br>")
				}
				// Pipes inside cell content must not become extra column separators on reopening.
				state.out =
					state.out.slice(0, contentStart) +
					state.out.slice(contentStart).replace(/\|/g, "\\|")
			})
		})
		state.write(" |")
		state.ensureNewLine()
		if (rowIndex === 0) {
			state.write(`| ${Array.from({ length: row.childCount }, () => "---").join(" | ")} |`)
			state.ensureNewLine()
		}
	})
	state.closeBlock(table)
	state.inTable = previousInTable
}
