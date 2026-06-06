import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import { StarterKit } from "@tiptap/starter-kit"
import { TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { TableWithWrapper } from "../table-node-extension"

type JsonNode = {
	type?: string
	content?: JsonNode[]
}

const findTextPosition = (editor: Editor, text: string) => {
	let position: number | null = null

	editor.state.doc.descendants((node, pos) => {
		const textIndex = node.text?.indexOf(text) ?? -1
		if (textIndex === -1) return true

		position = pos + textIndex
		return false
	})

	if (position === null) {
		throw new Error(`Unable to find text "${text}" in editor document`)
	}

	return position
}

const createEditor = (content: string) =>
	new Editor({
		extensions: [StarterKit, TableWithWrapper, TableRow, TableCell, TableHeader],
		content,
	})

const dispatchShortcut = (editor: Editor, event: KeyboardEvent) => {
	let handled = false

	editor.view.someProp("handleKeyDown", (handleKeyDown) => {
		handled = handleKeyDown(editor.view, event) === true
		return handled
	})

	return handled
}

describe("TableWithWrapper", () => {
	let editor: Editor | null = null

	afterEach(() => {
		editor?.destroy()
		editor = null
	})

	it("indents a list item inside a table cell when Tab is pressed", () => {
		editor = createEditor(`
			<table>
				<tbody>
					<tr>
						<td>
							<ul>
								<li><p>parent</p></li>
								<li><p>child</p></li>
							</ul>
						</td>
						<td><p>next cell</p></td>
					</tr>
				</tbody>
			</table>
		`)

		const childTextPosition = findTextPosition(editor, "child")

		editor.commands.setTextSelection(childTextPosition + "child".length)

		const handled = dispatchShortcut(
			editor,
			new KeyboardEvent("keydown", {
				key: "Tab",
				bubbles: true,
				cancelable: true,
			}),
		)

		expect(handled).toBe(true)

		const doc = editor.getJSON() as JsonNode
		const firstCell = doc.content?.[0].content?.[0].content?.[0]
		const list = firstCell?.content?.[0]
		const firstListItem = list?.content?.[0]

		expect(list?.type).toBe("bulletList")
		expect(firstListItem?.content?.some((node) => node.type === "bulletList")).toBe(true)
	})

	it("limits Mod-A selection to the current table cell content", () => {
		editor = createEditor(`
			<table>
				<tbody>
					<tr>
						<td><p>alpha</p></td>
						<td><p>beta</p></td>
					</tr>
				</tbody>
			</table>
			<p>outside</p>
		`)

		const alphaTextPosition = findTextPosition(editor, "alpha")

		editor.commands.setTextSelection(alphaTextPosition + 2)

		const handled = dispatchShortcut(
			editor,
			new KeyboardEvent("keydown", {
				key: "a",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			}),
		)

		expect(handled).toBe(true)
		expect(editor.state.selection.from).toBe(alphaTextPosition)
		expect(editor.state.selection.to).toBe(alphaTextPosition + "alpha".length)
	})
})
