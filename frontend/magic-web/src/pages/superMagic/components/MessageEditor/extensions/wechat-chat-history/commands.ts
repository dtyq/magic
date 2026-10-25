import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { Node } from "@/infrastructure/editors/tiptap/pm-model"
import { NodeSelection } from "@/infrastructure/editors/tiptap/pm-state"
import { WECHAT_CHAT_HISTORY } from "./types"
import { createWechatChat } from "./transform"
import { isWechatInstruction } from "./parser"

export function findWechatChat(
	editor: Editor,
	id: string,
): { node: Node; position: number } | null {
	let found: { node: Node; position: number } | null = null
	editor.state.doc.forEach((node, position) => {
		if (node.type.name === WECHAT_CHAT_HISTORY && node.attrs.id === id)
			found = { node, position }
	})
	return found
}

/** 外部把聊天和局部要求视为整块；内部仍按原生段落编辑，不能设为 atom。 */
export function deleteWechatChatAtBoundary(editor: Editor, direction: -1 | 1): boolean {
	if (!editor.isEditable) return false
	const { selection, doc } = editor.state
	if (selection instanceof NodeSelection && selection.node.type.name === WECHAT_CHAT_HISTORY)
		return editor.commands.deleteSelection()
	if (!selection.empty) return false
	const { $from } = selection
	let boundary = $from.pos
	if ($from.depth > 0) {
		// 仅处理卡片外段落的边缘；正文中间和卡片内部的退格／删除沿用原编辑行为。
		if ($from.depth !== 1 || !$from.parent.isTextblock) return false
		const atEdge =
			direction === -1
				? $from.parentOffset === 0
				: $from.parentOffset === $from.parent.content.size
		if (!atEdge) return false
		boundary = direction === -1 ? $from.before(1) : $from.after(1)
	}
	const resolved = doc.resolve(boundary)
	const adjacent = direction === -1 ? resolved.nodeBefore : resolved.nodeAfter
	if (adjacent?.type.name !== WECHAT_CHAT_HISTORY) return false
	const from = direction === -1 ? boundary - adjacent.nodeSize : boundary
	// 普通文档 transaction 保留撤销；仅移除引用节点，不改变上传队列或删除工作区文件。
	return editor.commands.deleteRange({ from, to: from + adjacent.nodeSize })
}

export function insertWechatChat(
	editor: Editor,
	range: { from: number; to: number },
	nodes: JSONContent[],
	placeholder: string,
): string | null {
	const resolved = editor.state.doc.resolve(range.from)
	for (let depth = resolved.depth; depth > 0; depth--) {
		const node = resolved.node(depth)
		if (node.type.name !== WECHAT_CHAT_HISTORY) continue
		const last = node.lastChild
		if (last && isWechatInstruction(last.toJSON())) {
			const instructionStart = resolved.before(depth) + node.nodeSize - last.nodeSize - 1
			// 在局部要求中继续粘贴聊天时追加到来源区；不能覆盖已写的处理要求。
			if (range.from > instructionStart)
				return editor.commands.insertContentAt(instructionStart, nodes)
					? (node.attrs.id as string)
					: null
		}
		return editor.commands.insertContentAt(range, nodes) ? (node.attrs.id as string) : null
	}
	const block = createWechatChat(nodes, placeholder)
	return editor.commands.insertContentAt(range, [block, { type: "paragraph" }])
		? (block.attrs?.id as string)
		: null
}
