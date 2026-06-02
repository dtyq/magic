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

interface BuildBlockFragmentParams {
	schema: Schema
	text: string
	preserveProseMirrorBlocks?: boolean
}

function buildParagraphContent(schema: Schema, text: string): Fragment | null {
	const inlineFragment = buildInlineFragment({ schema, text })
	return inlineFragment.size > 0 ? inlineFragment : null
}

function buildBlockFragment({
	schema,
	text,
	preserveProseMirrorBlocks = false,
}: BuildBlockFragmentParams): Fragment | null {
	const paragraphType = schema.nodes.paragraph
	if (!paragraphType) return null

	const normalized = text.replace(/\r\n?/g, "\n")
	const blocks = preserveProseMirrorBlocks ? normalized.split("\n\n") : normalized.split("\n")
	const blockNodes = blocks.map((block) => {
		if (!block.length) return paragraphType.create()
		const content = preserveProseMirrorBlocks
			? buildParagraphContent(schema, block)
			: schema.text(block)
		return paragraphType.create(null, content)
	})

	return Fragment.fromArray(blockNodes)
}

export interface BuildPasteSliceParams {
	schema: Schema
	text: string
	isTextBlock: boolean
	preserveProseMirrorBlocks?: boolean
}

type ClipboardPasteMode = "externalText" | "proseMirrorText" | "proseMirrorSlice"

function isProseMirrorClipboardHTML(html: string): boolean {
	return html.includes("data-pm-slice")
}

function hasRichEditorClipboardContent(html: string): boolean {
	return [
		/\bmagic-mention\b/,
		/data-mention-suggestion-char=/,
		/data-type=["'](?:super-placeholder|inspector-detail)["']/,
	].some((pattern) => pattern.test(html))
}

export function getClipboardPasteMode(text: string, html: string): ClipboardPasteMode | null {
	if (!html) return text ? "externalText" : null
	if (isProseMirrorClipboardHTML(html)) {
		return hasRichEditorClipboardContent(html) || !text ? "proseMirrorSlice" : "proseMirrorText"
	}
	return /\r?\n/.test(text) ? "externalText" : null
}

export function shouldHandlePlainTextPaste(text: string, html: string): boolean {
	const pasteMode = getClipboardPasteMode(text, html)
	return pasteMode === "externalText" || pasteMode === "proseMirrorText"
}

export function buildPasteSlice({
	schema,
	text,
	isTextBlock,
	preserveProseMirrorBlocks = false,
}: BuildPasteSliceParams): Slice {
	const normalized = text.replace(/\r\n?/g, "\n")

	if (!normalized.includes("\n")) {
		const inlineFragment = buildInlineFragment({ schema, text: normalized })
		return new Slice(inlineFragment, 0, 0)
	}

	const blockFragment = buildBlockFragment({
		schema,
		text: normalized,
		preserveProseMirrorBlocks,
	})
	if (!blockFragment) {
		const inlineFragment = buildInlineFragment({ schema, text: normalized })
		return new Slice(inlineFragment, 0, 0)
	}

	const openDepth = isTextBlock ? 1 : 0
	return new Slice(blockFragment, openDepth, openDepth)
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
					handlePaste: (view, event, parsedSlice) => {
						const clipboardData = event.clipboardData
						if (!clipboardData) return false

						const text = clipboardData.getData("text/plain")
						const html = clipboardData.getData("text/html")
						const pasteMode = getClipboardPasteMode(text, html)
						if (!pasteMode) {
							return false
						}

						event.preventDefault()

						const { state, dispatch } = view
						const { schema } = state
						if (!schema.nodes.hardBreak) return false

						if (pasteMode === "proseMirrorSlice") {
							const tr = state.tr.replaceSelection(parsedSlice)
							dispatch(tr.scrollIntoView())
							return true
						}

						if (!text) return false

						const parent = state.selection.$from.parent
						const isTextBlock = parent.type.isTextblock
						const slice = buildPasteSlice({
							schema,
							text,
							isTextBlock,
							preserveProseMirrorBlocks: pasteMode === "proseMirrorText",
						})

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
