import { nodePasteRule, Extension } from "@tiptap/core"
import HardBreak from "@tiptap/extension-hard-break"
import { Plugin, PluginKey, TextSelection } from "prosemirror-state"
import { Fragment, Node as ProseMirrorNode, Schema, Slice } from "prosemirror-model"

const ZERO_WIDTH_SPACE = "\u200B"

interface BuildInlineFragmentParams {
	schema: Schema
	text: string
}

function buildInlineFragment({ schema, text }: BuildInlineFragmentParams): Fragment {
	const normalized = text.replace(/\r\n?/g, "\n")
	const lines = normalized.split("\n")
	const contentNodes: ProseMirrorNode[] = []

	lines.forEach((line, lineIndex) => {
		if (lineIndex > 0) contentNodes.push(schema.nodes.hardBreak.create())
		const content = line.length > 0 ? line : ZERO_WIDTH_SPACE
		contentNodes.push(schema.text(content))
	})

	return Fragment.fromArray(contentNodes)
}

/**
 * 代码感知粘贴扩展
 * 用于智能处理代码和多段落文本的粘贴，保留原始格式和空行
 */
const CodeAwarePasteExtension = Extension.create({
	name: "codeAwarePaste",

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("codeAwarePaste"),
				props: {
					handlePaste: (view, event) => {
						const clipboardData = event.clipboardData
						if (!clipboardData) return false

						// 如果有HTML，则不处理
						const html = clipboardData.getData("text/html")
						if (html) {
							return false
						}

						const text = clipboardData.getData("text/plain")
						if (!text) return false

						event.preventDefault()

						const { state, dispatch } = view
						const { schema } = state
						if (!schema.nodes.hardBreak) return false

						const parent = state.selection.$from.parent
						const isTextBlock = parent.type.isTextblock
						const inlineFragment = buildInlineFragment({ schema, text })

						const slice = isTextBlock
							? new Slice(inlineFragment, 0, 0)
							: (() => {
									const paragraphType = schema.nodes.paragraph
									if (!paragraphType) return new Slice(inlineFragment, 0, 0)
									const paragraphNode = paragraphType.create(null, inlineFragment)
									return new Slice(Fragment.from(paragraphNode), 0, 0)
								})()

						const tr = state.tr
						tr.replaceSelection(slice)

						const endPos = tr.selection.to
						tr.setSelection(TextSelection.near(tr.doc.resolve(endPos)))

						dispatch(tr)
						return true
					},
				},
			}),
		]
	},
})

/**
 * 硬换行扩展
 * 扩展 Tiptap 的 HardBreak，添加键盘快捷键和粘贴规则
 */
const HardBlockExtension = HardBreak.extend({
	addKeyboardShortcuts() {
		return {
			// 支持多种换行快捷键
			"Mod-Enter": () => this.editor.commands.setHardBreak(),
			"Shift-Enter": () => this.editor.commands.setHardBreak(),
			"Ctrl-Enter": () => this.editor.commands.setHardBreak(),
			"Alt-Enter": () => this.editor.commands.setHardBreak(),
		}
	},
	addPasteRules() {
		return [
			nodePasteRule({
				find: /\r?\n/g,
				type: this.type,
			}),
			nodePasteRule({
				find: /\r/g,
				type: this.type,
			}),
		]
	},
})

export default HardBlockExtension
export { CodeAwarePasteExtension }
