import type { Editor } from "@/infrastructure/editors/tiptap/core"
import { Plugin, PluginKey } from "@/infrastructure/editors/tiptap/pm-state"
import {
	Suggestion,
	exitSuggestion,
	type SuggestionProps,
} from "@/infrastructure/editors/tiptap/suggestion"
import { WECHAT_CHAT_HISTORY } from "./wechat-chat-history/types"

interface CommandItem {
	id: "wechat-chat-history"
}
export interface SlashMenuState {
	query: string
	rect: DOMRect
	choose: () => void
	anchor?: HTMLElement
	onQueryChange: (query: string) => void
}
export const matchesWechatCommand = (query: string) =>
	["微信聊天记录", "wechat", "chat", "wx"].some((name) =>
		name.includes(query.trim().toLowerCase()),
	)

export function installWechatSlashCommand(
	editor: Editor,
	onMenu: (menu: SlashMenuState | null) => void,
	onChoose: () => void,
) {
	const key = new PluginKey("wechatSlashCommand")
	const inputKey = new PluginKey("wechatSlashInput")
	let inputFrom = -1
	let current: SuggestionProps<CommandItem> | null = null
	let buttonAnchor: HTMLElement | null = null
	let query = ""
	const dismiss = (restoreFocus = false) => {
		const wasOpen = current !== null || buttonAnchor !== null
		current = null
		buttonAnchor = null
		inputFrom = -1
		query = ""
		onMenu(null)
		if (!editor.isDestroyed) exitSuggestion(editor.view, key)
		if (restoreFocus && wasOpen && !editor.isDestroyed) editor.commands.focus()
	}
	const choose = () => {
		if (!matchesWechatCommand(query) || !editor.isEditable || editor.isDestroyed) return
		if (current) current.command({ id: "wechat-chat-history" })
		else if (buttonAnchor) {
			dismiss()
			onChoose()
		}
	}
	// 两个入口共用菜单查询；搜索栏只筛选命令，字符入口的 Suggestion 仍负责原文触发范围。
	const publishMenu = () => {
		const rect = buttonAnchor?.getBoundingClientRect() ?? current?.clientRect?.()
		if (!rect) return
		onMenu({
			query,
			rect,
			anchor: buttonAnchor ?? undefined,
			choose,
			onQueryChange: (nextQuery) => {
				query = nextQuery
				publishMenu()
			},
		})
	}
	const publish = (props: SuggestionProps<CommandItem>) => {
		if (buttonAnchor || props.range.from !== inputFrom) return
		if (!current || props.query !== current.query) query = props.query
		current = props
		publishMenu()
	}
	// @ 插件与 slash 各自拥有输入记录和 PluginKey；paste/程序恢复不激活动作菜单。
	editor.registerPlugin(
		new Plugin({
			key: inputKey,
			props: {
				handleTextInput(_view, from, _to, text) {
					if (text === "/") inputFrom = from
					return false
				},
			},
		}),
	)
	editor.registerPlugin(
		Suggestion<CommandItem>({
			editor,
			pluginKey: key,
			char: "/",
			allowSpaces: false,
			allowedPrefixes: [" ", "\n", "\t"],
			allow: ({ state, range }) => {
				if (range.from !== inputFrom || !editor.isEditable) return false
				const position = state.doc.resolve(range.from)
				for (let depth = position.depth; depth > 0; depth--) {
					if (
						position.node(depth).type.name === WECHAT_CHAT_HISTORY ||
						position.node(depth).type.spec.code
					)
						return false
				}
				return true
			},
			items: ({ query }) =>
				matchesWechatCommand(query) ? [{ id: "wechat-chat-history" }] : [],
			command: ({ editor: instance, range }) => {
				dismiss()
				instance.chain().deleteRange(range).run()
				onChoose()
			},
			render: () => ({
				onStart: publish,
				onUpdate: publish,
				onExit: () => {
					current = null
					inputFrom = -1
					if (!buttonAnchor) {
						query = ""
						onMenu(null)
					}
				},
			}),
		}),
	)
	return {
		open(anchor: HTMLElement) {
			if (!editor.isEditable || editor.isDestroyed) return
			// 按钮复用同一菜单，但搜索不写入正文；仅键盘 / 入口需要删除触发范围。
			dismiss()
			buttonAnchor = anchor
			publishMenu()
		},
		dismiss,
		handleKeyDown(event: KeyboardEvent): boolean {
			if (!current && !buttonAnchor) return false
			if (event.isComposing) return false
			if (event.key === "Escape") {
				dismiss(true)
				return true
			}
			if (event.key === "Enter") {
				choose()
				return true
			}
			return event.key === "ArrowDown" || event.key === "ArrowUp"
		},
		dispose() {
			current = null
			buttonAnchor = null
			query = ""
			onMenu(null)
			if (!editor.isDestroyed) {
				editor.unregisterPlugin(inputKey)
				editor.unregisterPlugin(key)
			}
		},
	}
}
