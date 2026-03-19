import { ReactRenderer } from "@tiptap/react"
import { exitSuggestion, type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion"

// Types
import { McpMentionData, MentionItemType, type MentionItem } from "../types"
import type { MentionPanelPluginOptions } from "./types"

// Components
import MentionPanelRenderer from "./MentionPanelRenderer"
import {
	checkMCPOAuth,
	MCPOAuthType,
} from "@/components/Agent/MCP/AgentSettings/AgentPanel/MCPPanel/helpers"

// 仅在用户刚输入 "@" 的短时间窗口内，允许空查询触发面板
const MENTION_INPUT_ACTIVATION_WINDOW_MS = 1200

/**
 * Create suggestion configuration for MentionPanel plugin
 *
 * @param options - Plugin configuration options
 * @returns Suggestion options for Tiptap
 */
export function createMentionPanelSuggestion(
	options: MentionPanelPluginOptions = {},
): Omit<SuggestionOptions<MentionItem>, "editor"> {
	const { allowSpaces = true, allowedPrefixes = null, getParentContainer, dataService } = options

	return {
		// 触发建议面板的字符
		char: "@",

		// 允许查询词中包含空格
		allowSpaces: allowSpaces,

		// 允许的前缀字符集合
		allowedPrefixes: allowedPrefixes,

		// 不要求必须在行首触发
		startOfLine: false,

		// 只允许“本次输入 @”触发首次激活，避免光标落在历史 @ 后输入文本时自动弹出
		allow: ({ editor, state, range, isActive }) => {
			const enabled = editor.storage.mention?.enabled ?? true
			if (!enabled) {
				return false
			}

			const lastAtInputPos = editor.storage.mention?.lastAtInputPos ?? -1
			// 激活过程中如果 range 漂移到其他 @，也要立即阻断
			if (isActive) {
				return range.from === lastAtInputPos
			}

			if (!isActive) {
				const lastAtInputAt = editor.storage.mention?.lastAtInputAt ?? 0
				const isInActivationWindow =
					Date.now() - lastAtInputAt <= MENTION_INPUT_ACTIVATION_WINDOW_MS

				return isInActivationWindow && range.from === lastAtInputPos
			}

			return true
		},

		// 开发环境下打开 suggestion debug 日志
		...(process.env.NODE_ENV === "development" && {
			debug: true,
		}),

		// Items function - required by Tiptap suggestion
		items: ({ query }) => {
			console.log("[MentionPanel] items called with query:", query)
			// Return empty array since we handle items in our custom component
			return []
		},

		// Render function - handles panel lifecycle
		render: () => {
			let component: ReactRenderer<any> | null = null
			let currentProps: SuggestionProps<MentionItem> | null = null

			// Define onSelect callback once to avoid duplication
			const handleSelect = async (item: MentionItem) => {
				// Insert the mention into the editor
				const { editor, range } = currentProps!

				if (
					item.type === MentionItemType.MCP &&
					((item.data as McpMentionData).check_auth ||
						(item.data as McpMentionData).check_require_fields)
				) {
					// 先 blur 一下，避免在 OAuth 过程中，键盘还能输入
					editor.chain().blur().run()

					// Temporarily disable keyboard shortcuts during OAuth
					if (component) {
						component.updateProps({
							...component.props,
							disableKeyboardShortcuts: true,
						})
					}

					try {
						const res = await checkMCPOAuth(item.data as McpMentionData)

						if (res === MCPOAuthType.validationFailed) {
							// Remove the @ character and query text when validation fails
							editor.chain().focus().deleteRange(range).run()
							// Close the panel
							handleExit?.()
							return
						}
						// 如果验证成功，则预加载 MCP 列表
						dataService?.fetchMcpList()
					} finally {
						// Re-enable keyboard shortcuts after OAuth
						if (component) {
							component.updateProps({
								...component.props,
								disableKeyboardShortcuts: false,
							})
						}
					}
				}

				editor
					.chain()
					.focus()
					.insertContentAt(range, [
						{
							type: "mention",
							attrs: {
								type: item.type,
								data: item.data,
							},
						},
					])
					.run()
			}

			// Define onExit callback once to avoid duplication
			const handleExit = () => {
				const editor = currentProps?.editor
				if (editor?.storage.mention) {
					// 手动关闭后清空触发信息，避免后续编辑回流匹配到旧 @
					editor.storage.mention.lastAtInputAt = 0
					editor.storage.mention.lastAtInputPos = -1
				}

				// 显式退出 suggestion，确保 ProseMirror 插件状态与 UI 一致
				if (editor?.view) {
					exitSuggestion(editor.view)
				}

				// Clean up when panel is closed
				component?.destroy()
				component = null
				currentProps = null
				editor?.commands.focus()
			}

			return {
				// Called when @ is typed
				onStart: (props: SuggestionProps<MentionItem>) => {
					console.log("[MentionPanel] onStart triggered:", {
						query: props.query,
						range: props.range,
					})

					// Get dynamic values from editor storage
					const enabled = props.editor.storage.mention?.enabled ?? true
					const language = props.editor.storage.mention?.language || "en"
					const disableKeyboardShortcuts =
						props.editor.storage.mention?.disableKeyboardShortcuts || false

					// Check if mention extension is enabled
					if (!enabled) {
						console.log("[MentionPanel] Extension is disabled, skipping panel creation")
						return
					}

					currentProps = props

					// 在移动端，当 MentionPanel 显示时主动收起键盘
					// 检查是否在移动端（通过检查视口宽度或 user agent）
					const isMobile =
						/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
							navigator.userAgent,
						) || window.innerWidth < 768

					if (isMobile) {
						// 失焦编辑器以收起键盘
						props.editor.commands.blur()
						console.log("[MentionPanel] Mobile detected, keyboard hidden")
					}

					// Create and mount the renderer component
					component = new ReactRenderer(MentionPanelRenderer, {
						props: {
							editor: props.editor,
							query: props.query,
							items: [],
							range: props.range,
							decorationNode: props.decorationNode,
							language,
							onSelect: handleSelect,
							onExit: handleExit,
							disableKeyboardShortcuts,
							dataService,
						},
						// Mount to parent container or document body
						editor: props.editor,
					})

					// Mount to specific container if provided
					if (getParentContainer) {
						const container = getParentContainer()
						if (container) {
							container.appendChild(component.element)
						}
					}
				},

				// Called when query changes (e.g., @text)
				onUpdate: (props: SuggestionProps<MentionItem>) => {
					// Get dynamic values from editor storage
					const enabled = props.editor.storage.mention?.enabled ?? true
					const language = props.editor.storage.mention?.language || "en"
					const disableKeyboardShortcuts =
						props.editor.storage.mention?.disableKeyboardShortcuts || false

					console.log("[MentionPanel] onUpdate triggered:", {
						query: props.query,
						queryLength: props.query.length,
						range: props.range,
						hasQuery: !!props.query.trim(),
						allowSpaces,
						enabled,
						language,
						disableKeyboardShortcuts,
					})

					// Check if mention extension is disabled
					if (!enabled) {
						console.log("[MentionPanel] Extension is disabled, closing panel")
						// Clean up component
						if (component) {
							component.destroy()
							component = null
						}
						currentProps = null
						return
					}

					// Check if spaces are not allowed and query contains space
					if (!allowSpaces && props.query.includes(" ")) {
						console.log("[MentionPanel] Space detected and not allowed, closing panel")
						// Clean up component
						if (component) {
							component.destroy()
							component = null
						}
						currentProps = null
						return
					}

					currentProps = props

					// Update component props with new query
					if (component) {
						component.updateProps({
							editor: props.editor,
							query: props.query,
							items: [],
							range: props.range,
							decorationNode: props.decorationNode,
							language,
							onSelect: handleSelect,
							onExit: handleExit,
							disableKeyboardShortcuts,
						})
					}
				},

				// Handle keyboard events
				onKeyDown: (props) => {
					if (!component?.ref) return false

					// Delegate keyboard handling to the renderer component
					return component.ref.onKeyDown(props)
				},

				// Called when suggestion ends (escape, click outside, etc.)
				onExit: () => {
					if (currentProps?.editor?.storage.mention) {
						currentProps.editor.storage.mention.lastAtInputAt = 0
						currentProps.editor.storage.mention.lastAtInputPos = -1
					}

					// Clean up component
					if (component) {
						component.destroy()
						component = null
					}
					currentProps = null
				},
			}
		},
	}
}

export default createMentionPanelSuggestion
