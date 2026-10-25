import { Node, mergeAttributes } from "@/infrastructure/editors/tiptap/core"
import { ReactNodeViewRenderer } from "@/infrastructure/editors/tiptap/react"
import { Plugin, PluginKey } from "@/infrastructure/editors/tiptap/pm-state"
import ChatBlock from "../../components/WechatChatHistory/ChatBlock"
import { WECHAT_CHAT_HISTORY } from "./types"
import { deleteWechatChatAtBoundary } from "./commands"

export const WechatChatHistoryExtension = Node.create({
	name: WECHAT_CHAT_HISTORY,
	group: "block",
	content: "paragraph+",
	defining: true,
	isolating: true,
	addGlobalAttributes() {
		return [
			{
				types: ["paragraph"],
				attributes: {
					wechatMediaState: {
						default: null,
						parseHTML: (element) => element.getAttribute("data-wechat-media-state"),
						renderHTML: (attrs) =>
							attrs.wechatMediaState
								? { "data-wechat-media-state": attrs.wechatMediaState }
								: {},
					},
					wechatInstruction: {
						default: false,
						parseHTML: (element) =>
							element.getAttribute("data-wechat-instruction") === "true",
						renderHTML: (attrs) =>
							attrs.wechatInstruction ? { "data-wechat-instruction": "true" } : {},
					},
				},
			},
		]
	},
	addAttributes() {
		return {
			id: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-chat-id"),
				renderHTML: (attrs) => ({ "data-chat-id": attrs.id }),
			},
		}
	},
	parseHTML() {
		return [{ tag: `section[data-type="${WECHAT_CHAT_HISTORY}"]` }]
	},
	renderHTML({ HTMLAttributes }) {
		return ["section", mergeAttributes(HTMLAttributes, { "data-type": WECHAT_CHAT_HISTORY }), 0]
	},
	addNodeView() {
		return ReactNodeViewRenderer(ChatBlock)
	},
	addKeyboardShortcuts() {
		return {
			Backspace: ({ editor }) => deleteWechatChatAtBoundary(editor, -1),
			Delete: ({ editor }) => deleteWechatChatAtBoundary(editor, 1),
		}
	},
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("wechatChatHistoryIdentity"),
				appendTransaction(transactions, _old, state) {
					if (!transactions.some((transaction) => transaction.docChanged)) return null
					const ids = new Set<string>()
					const transaction = state.tr
					state.doc.descendants((node, position) => {
						if (node.type.name !== WECHAT_CHAT_HISTORY) return true
						let id = node.attrs.id as string | null
						// 复制只复制资料引用，区块本地身份必须独立；原位置及撤销历史保留。
						if (!id || ids.has(id)) {
							id = crypto.randomUUID()
							transaction.setNodeMarkup(position, undefined, { ...node.attrs, id })
						}
						ids.add(id)
						return false
					})
					return transaction.docChanged ? transaction : null
				},
			}),
		]
	},
})
