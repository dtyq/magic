import { useEditor, JSONContent } from "@tiptap/react"
import { Document } from "@tiptap/extension-document"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text } from "@tiptap/extension-text"
import { useRef, useEffect } from "react"
import { NodeSelection } from "@tiptap/pm/state"
import {
	HardBlock,
	CodeAwarePasteExtension,
	SuperPlaceholderExtension,
	PlaceholderExtension,
	CopyMessageExtension,
} from "../extensions"
import MentionExtension, {
	Language,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin"
import { useTranslation } from "react-i18next"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { Topic, type TopicMode } from "../../../pages/Workspace/types"
import { ChatApi } from "@/apis"
import { isEmptyJSONContent } from "../utils"
import { UndoRedo } from "@tiptap/extensions"
import { useIsMobile } from "@/hooks/useIsMobile"
import { isAllowedMention } from "../utils/mention"
import GlobalMentionPanelStore, {
	MentionPanelStore,
} from "@/components/business/MentionPanel/store"
import { SUPER_PLACEHOLDER_TYPE } from "../extensions/super-placeholder/const"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import MarkerMentionNodeView from "../components/MentionNodes/marker/MarkerMentionNodeView"

interface UseMessageEditorProps {
	value?: JSONContent
	placeholder?: string
	onSend?: (content: JSONContent | undefined) => void
	onMentionsInsert?: (item: TiptapMentionAttributes) => void
	onMentionInsertItems?: (items: TiptapMentionAttributes[]) => void
	onMentionRemove?: (item: TiptapMentionAttributes, stillExists: boolean) => void
	onMentionRemoveItems?: (
		items: { item: TiptapMentionAttributes; stillExists: boolean }[],
	) => void
	onChange?: (content: JSONContent) => void
	selectedTopic?: Topic | null
	onKeyboardInput?: () => void
	shouldEnableMention?: boolean
	aiCompletionEnabled?: boolean
	isOAuthInProgress?: boolean
	onFocus?: () => void
	onBlur?: () => void
	size?: "default" | "small" | "mobile"
	topicMode?: TopicMode
	mentionPanelStore?: MentionPanelStore
	/** 恢复内容期间返回 true 时，appendTransaction 跳过 onInsertItems，避免与 restoreMentionItems 冲突 */
	shouldSkipInsertSync?: () => boolean
	/** 程序化清空期间跳过删除同步，避免误判为用户删除 */
	shouldSkipRemoveSync?: () => boolean
	/** 删除后需要先恢复的 mention，用于等待确认弹窗 */
	shouldRestoreRemovedMention?: (item: TiptapMentionAttributes, stillExists: boolean) => boolean
}

type MentionEditorCommands = {
	updateMentionLanguage?: (language: string) => void
	updateMentionKeyboardShortcuts?: (disabled: boolean) => void
	updateMentionEnabled?: (enabled: boolean) => void
}

// Check if current selection/focus is on a SuperPlaceholder node
const isFocusOnSuperPlaceholder = (editor: ReturnType<typeof useEditor>) => {
	if (!editor) return false

	const { selection } = editor.state
	const { from, to } = selection

	// Check if the selection is a node selection on a SuperPlaceholder
	if (selection instanceof NodeSelection && selection.node.type.name === SUPER_PLACEHOLDER_TYPE) {
		return true
	}

	// Check if cursor is adjacent to or within a SuperPlaceholder
	const nodeAtFrom = editor.state.doc.nodeAt(from)
	const nodeAtTo = to !== from ? editor.state.doc.nodeAt(to) : null

	if (nodeAtFrom?.type.name === SUPER_PLACEHOLDER_TYPE) {
		return true
	}

	if (nodeAtTo?.type.name === SUPER_PLACEHOLDER_TYPE) {
		return true
	}

	// Check if cursor is right before a SuperPlaceholder
	if (from > 0) {
		const nodeBefore = editor.state.doc.nodeAt(from - 1)
		if (nodeBefore?.type.name === SUPER_PLACEHOLDER_TYPE) {
			return true
		}
	}

	return false
}

export const useMessageEditor = ({
	value,
	onSend,
	placeholder,
	onMentionsInsert,
	onMentionInsertItems,
	onMentionRemove,
	onMentionRemoveItems,
	onChange,
	selectedTopic,
	onKeyboardInput,
	shouldEnableMention = true,
	aiCompletionEnabled = true,
	isOAuthInProgress = false,
	onFocus,
	onBlur,
	size,
	topicMode,
	mentionPanelStore = GlobalMentionPanelStore,
	shouldSkipInsertSync,
	shouldSkipRemoveSync,
	shouldRestoreRemovedMention,
}: UseMessageEditorProps) => {
	const domRef = useRef<HTMLDivElement>(null)
	const { i18n } = useTranslation()
	const isMobile = useIsMobile()
	// Cache last content snapshot to avoid triggering onChange on selection-only updates
	const lastContentSnapshotRef = useRef<string>(JSON.stringify(value ?? null))
	// Track whether focus is on SuperPlaceholder to control AI completion
	const isFocusOnPlaceholderRef = useRef<boolean>(false)

	const scrollToBottom = () => {
		setTimeout(() => {
			const proseMirror = domRef.current?.querySelector(".ProseMirror")
			if (proseMirror) {
				proseMirror.scrollTop = proseMirror.scrollHeight
			}
		}, 0)
	}

	const fetchSuggestion = useMemoizedFn(async (text: string) => {
		try {
			// if (!selectedTopic || !selectedTopic.chat_conversation_id || !selectedTopic.id)
			// 	return ""
			if (text.trim() === "") return ""
			const res = await ChatApi.getAiAutoCompletion({
				conversation_id: selectedTopic?.chat_conversation_id ?? "",
				topic_id: selectedTopic?.chat_topic_id ?? "",
				message: text,
			})
			const currentConversationId = selectedTopic?.chat_conversation_id ?? ""
			const currentTopicId = selectedTopic?.chat_topic_id ?? ""
			const { conversation_id, topic_id } = res.request_info
			// 如果会话id不一致,则返回空字符串
			if (conversation_id !== currentConversationId || topic_id !== currentTopicId) return ""
			// 如果输入框没有内容,则返回空字符串
			if (isEmptyJSONContent(value)) return ""
			return res.choices[0].message.content
		} catch (error) {
			console.error(error)
			return Promise.resolve("")
		}
	})

	useEffect(() => {
		mentionPanelStore.setSkillQueryContext(topicMode)
	}, [mentionPanelStore, topicMode])

	// Update AI completion state based on focus position
	const updateAiCompletionState = useMemoizedFn((editor: ReturnType<typeof useEditor>) => {
		if (!editor) return

		const isFocusOnPlaceholder = isFocusOnSuperPlaceholder(editor)
		if (isFocusOnPlaceholder !== isFocusOnPlaceholderRef.current) {
			isFocusOnPlaceholderRef.current = isFocusOnPlaceholder
			if (isFocusOnPlaceholder) {
				// Disable AI completion when focus is on SuperPlaceholder
				AiCompletionService.disable()
			} else if (!isMobile && aiCompletionEnabled) {
				// Re-enable AI completion when focus moves away from SuperPlaceholder
				AiCompletionService.enable()
			}
		}
	})

	const tiptapEditor = useEditor({
		content: value,
		onUpdate({ editor }) {
			const json = editor.getJSON()
			const snapshot = JSON.stringify(json)
			if (snapshot === lastContentSnapshotRef.current) return
			lastContentSnapshotRef.current = snapshot
			onChange?.(json)

			// Update AI completion state based on focus position
			updateAiCompletionState(editor)
		},
		onSelectionUpdate({ editor }) {
			// Update AI completion state when selection changes
			updateAiCompletionState(editor)
		},
		editorProps: {
			handleKeyDown: (_, event) => {
				event.stopPropagation()

				// 其他实际内容输入键触发停止语音录制
				const isContentKey =
					event.key.length === 1 || // 单字符按键（字母、数字、符号）
					event.key === "Backspace" ||
					event.key === "Delete" ||
					event.key === "Space"

				// Handle select all shortcut - with hierarchical logic
				if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
					// Check if focus is currently within a super placeholder
					const activeElement = document.activeElement
					const isSuperPlaceholderFocused = activeElement?.closest(
						'[data-type="super-placeholder"]',
					)

					// If focus is in a super placeholder, let it handle the event first
					if (isSuperPlaceholderFocused) {
						console.log("isSuperPlaceholderFocused")
						// Don't prevent here - let super placeholder handle it
						return false
					}
				}

				// 如果按下的不是Tab键, 且是实际内容输入键，则清除提示词
				if (isContentKey) {
					AiCompletionService.clearSuggestion()
				}

				// 如果按下的是回车键
				if (event.key === "Enter") {
					// shift+enter, command+enter, ctrl+enter, alt+enter 换行，让扩展处理
					if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
						return false // 让扩展的键盘快捷键处理
					}

					// 移动端回车换行
					if (isMobile) {
						return false
					} else {
						// 普通回车发送消息
						onKeyboardInput?.()
						onSend?.(tiptapEditor?.getJSON())
						return true
					}
				}

				if (isContentKey) {
					onKeyboardInput?.()
				}

				// 对于其他键，让扩展优先处理，包括mention面板
				return false
			},
		},
		extensions: [
			Document,
			Paragraph,
			Text,
			HardBlock,
			CodeAwarePasteExtension,
			SuperPlaceholderExtension.configure({
				size: size || "default",
			}),
			PlaceholderExtension.configure({
				placeholder,
			}),
			UndoRedo.configure({
				depth: 100,
				newGroupDelay: 250,
			}),
			CopyMessageExtension.configure({
				onMentionsInsert: onMentionInsertItems,
				onContentChange: onChange,
				dataService: mentionPanelStore,
			}),
			...(shouldEnableMention
				? [
						MentionExtension.configure({
							language: i18n.language as Language,
							getParentContainer: () => document.body,
							disableKeyboardShortcuts: isOAuthInProgress,
							onInsert: (item) => {
								onMentionsInsert?.({
									type: item.type,
									data: item.data,
								})
							},
							onInsertItems: (items) => {
								onMentionInsertItems?.(
									items.map((mention) => ({
										type: mention.type,
										data: mention.data,
									})),
								)
							},
							onRemoveItems: onMentionRemoveItems,
							// 保持 onRemove 兼容性
							onRemove: onMentionRemove,
							isAllowedMention,
							dataService: mentionPanelStore,
							nodeViewRenderers: {
								[MentionItemType.DESIGN_MARKER]: MarkerMentionNodeView,
							},
							shouldSkipInsertSync,
							shouldSkipRemoveSync,
							shouldRestoreRemovedMention,
						}),
					]
				: []),
			AiCompletionService.getExtension({
				fetchSuggestion,
				alwaysShowTip: true,
			}),
		],
		onFocus: () => {
			onFocus?.()
			return true
		},
		onBlur: () => {
			onBlur?.()
			return true
		},
	})

	AiCompletionService.setInstance({ editor: tiptapEditor })

	// Handle AI completion based on mobile, aiCompletionEnabled, and focus position
	useEffect(() => {
		if (!tiptapEditor) return

		const isFocusOnPlaceholder = isFocusOnSuperPlaceholder(tiptapEditor)
		isFocusOnPlaceholderRef.current = isFocusOnPlaceholder

		if (isMobile || !aiCompletionEnabled || isFocusOnPlaceholder) {
			AiCompletionService.disable()
		} else {
			AiCompletionService.enable()
		}

		return () => {
			AiCompletionService.enable()
		}
	}, [isMobile, aiCompletionEnabled, tiptapEditor])

	// Handle dynamic placeholder updates
	useUpdateEffect(() => {
		if (!tiptapEditor || tiptapEditor.isDestroyed || !placeholder) {
			return
		}

		// Ensure editor view is ready before updating placeholder
		if (!tiptapEditor.view) {
			return
		}

		// Use requestAnimationFrame to ensure the editor is fully initialized
		// and avoid race conditions with other state updates
		const timeoutId = requestAnimationFrame(() => {
			if (tiptapEditor.isDestroyed || !tiptapEditor.view) {
				return
			}

			try {
				tiptapEditor.commands.updatePlaceholder(placeholder)
			} catch (error) {
				console.warn("Failed to update placeholder:", error)
			}
		})

		return () => {
			cancelAnimationFrame(timeoutId)
		}
	}, [tiptapEditor, placeholder])

	// Handle dynamic language updates for MentionExtension
	useEffect(() => {
		if (tiptapEditor && shouldEnableMention) {
			const mentionCommands = tiptapEditor.commands as typeof tiptapEditor.commands &
				MentionEditorCommands
			mentionCommands.updateMentionLanguage?.(i18n.language)
		}
	}, [tiptapEditor, i18n.language, shouldEnableMention])

	// Handle dynamic keyboard shortcuts updates for MentionExtension
	useEffect(() => {
		if (tiptapEditor && shouldEnableMention) {
			const mentionCommands = tiptapEditor.commands as typeof tiptapEditor.commands &
				MentionEditorCommands
			mentionCommands.updateMentionKeyboardShortcuts?.(isOAuthInProgress)
		}
	}, [tiptapEditor, isOAuthInProgress, shouldEnableMention])

	// Handle dynamic size updates for SuperPlaceholderExtension
	useEffect(() => {
		if (tiptapEditor && size) {
			tiptapEditor.commands.updateSuperPlaceholderSize(size)
		}
	}, [tiptapEditor, size])

	// Handle dynamic enabled state for MentionExtension
	useEffect(() => {
		if (tiptapEditor) {
			const mentionCommands = tiptapEditor.commands as typeof tiptapEditor.commands &
				MentionEditorCommands
			mentionCommands.updateMentionEnabled?.(shouldEnableMention)
		}
	}, [tiptapEditor, shouldEnableMention])

	return {
		tiptapEditor,
		domRef,
		scrollToBottom,
	}
}
