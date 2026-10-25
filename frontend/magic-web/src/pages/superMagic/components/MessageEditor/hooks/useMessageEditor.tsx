import { useEditor, JSONContent } from "@/infrastructure/editors/tiptap/react"
import { Document } from "@/infrastructure/editors/tiptap/extension-document"
import { Paragraph } from "@/infrastructure/editors/tiptap/extension-paragraph"
import { Text } from "@/infrastructure/editors/tiptap/extension-text"
import { useRef, useEffect } from "react"
import { NodeSelection } from "@/infrastructure/editors/tiptap/pm-state"
import {
	HardBlock,
	CodeAwarePasteExtension,
	SuperPlaceholderExtension,
	PlaceholderExtension,
	CopyMessageExtension,
	InspectorDetailExtension,
	WechatChatHistoryExtension,
} from "../extensions"
import MentionExtension, {
	Language,
	type MentionDeletionInput,
	type MentionRemoveItemPayload,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin"
import { useTranslation } from "react-i18next"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { Topic } from "../../../pages/Workspace/types"
import { type TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { ChatApi } from "@/apis"
import { isEmptyJSONContent } from "../utils"
import { UndoRedo } from "@/infrastructure/editors/tiptap/extensions"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
	isAllowedMention as defaultIsAllowedMention,
	prepareCopiedMentionAttrs,
} from "../utils/mention"
import GlobalMentionPanelStore, {
	MentionPanelStore,
} from "@/components/business/MentionPanel/builtin-store"
import { SUPER_PLACEHOLDER_TYPE } from "../extensions/super-placeholder/const"
import {
	MentionItemType,
	type DirectoryMentionData,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import MarkerMentionNodeView from "../components/MentionNodes/marker/MarkerMentionNodeView"
import FileMentionNodeView from "../components/MentionNodes/file/FileMentionNodeView"
import FolderMentionNodeView from "../components/MentionNodes/folder/FolderMentionNodeView"
import {
	needsFileReferenceNormalization,
	normalizeFileReferenceMention,
} from "@/components/business/MentionPanel/utils/fileReferenceMention"
import { getFileReferenceIdentityKey } from "@/pages/superMagic/services/userFileReferenceResolver"
import { runActiveEditor } from "../utils/editorLifecycle"
import {
	tryAcceptPromptCarouselShortcut,
	tryNavigatePromptCarouselShortcut,
} from "../utils/promptCarousel"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { getClipboardPlainText } from "@/pages/superMagic/components/MessageList/utils/mentionClipboard"
import magicToast from "@/components/base/MagicToaster/utils"
import { useWechatChatImport } from "./useWechatChatImport"

interface UseMessageEditorProps {
	value?: JSONContent
	placeholder?: string
	ariaLabel?: string
	onPromptCarouselAccept?: () => boolean
	onPromptCarouselNavigate?: (direction: "previous" | "next") => boolean
	onSend?: (content: JSONContent | undefined) => void
	onMentionsInsert?: (item: TiptapMentionAttributes) => void
	onMentionInsertItems?: (items: TiptapMentionAttributes[]) => void
	onMentionRemove?: (item: TiptapMentionAttributes, stillExists: boolean) => void
	onMentionRemoveItems?: (items: MentionRemoveItemPayload[]) => void
	onChange?: (content: JSONContent) => void
	selectedTopic?: Topic | null
	onKeyboardInput?: () => void
	/** Whether plain Enter sends the current message. */
	sendWhenEnter?: boolean
	shouldEnableMention?: boolean
	isAllowedMention?: (attrs: TiptapMentionAttributes, dataService: MentionPanelStore) => boolean
	sendEnabled?: boolean
	aiCompletionEnabled?: boolean
	isOAuthInProgress?: boolean
	onFocus?: () => void
	onBlur?: () => void
	size?: "default" | "small" | "mobile"
	topicMode?: TopicMode
	mentionPanelStore?: MentionPanelStore
	/** 恢复内容期间返回 true 时，appendTransaction 跳过 onInsertItems，避免与 restoreMentionItems 冲突 */
	shouldSkipInsertSync?: () => boolean
	/** Allows trusted programmatic content restoration to keep existing Mention nodes intact. */
	shouldSkipMentionValidation?: () => boolean
	/** Allows previously trusted Mention nodes to survive follow-up editor transactions. */
	isTrustedMention?: (attrs: TiptapMentionAttributes) => boolean
	/** 程序化清空期间跳过删除同步，避免误判为用户删除 */
	shouldSkipRemoveSync?: () => boolean
	/** 删除后需要先恢复的 mention，用于等待确认弹窗 */
	shouldRestoreRemovedMention?: (
		item: TiptapMentionAttributes,
		stillExists: boolean,
		context?: { deletionInput: MentionDeletionInput },
	) => boolean
	getWorkspaceFilesList?: () => AttachmentItem[]
	getCurrentProjectId?: () => string | undefined
	wechatChatEnabled?: boolean
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
	ariaLabel,
	onPromptCarouselAccept,
	onPromptCarouselNavigate,
	onMentionsInsert,
	onMentionInsertItems,
	onMentionRemove,
	onMentionRemoveItems,
	onChange,
	selectedTopic,
	onKeyboardInput,
	sendWhenEnter,
	shouldEnableMention = true,
	isAllowedMention,
	sendEnabled = true,
	aiCompletionEnabled = true,
	isOAuthInProgress = false,
	onFocus,
	onBlur,
	size,
	topicMode,
	mentionPanelStore = GlobalMentionPanelStore,
	shouldSkipInsertSync,
	shouldSkipMentionValidation,
	isTrustedMention,
	shouldSkipRemoveSync,
	shouldRestoreRemovedMention,
	getWorkspaceFilesList,
	getCurrentProjectId,
	wechatChatEnabled = false,
}: UseMessageEditorProps) => {
	const domRef = useRef<HTMLDivElement>(null)
	const { i18n } = useTranslation()
	const isMobile = useIsMobile()
	const shouldSendWhenEnter = sendWhenEnter ?? !isMobile
	// Cache last content snapshot to avoid triggering onChange on selection-only updates
	const lastContentSnapshotRef = useRef<string>(JSON.stringify(value ?? null))
	// Track whether focus is on SuperPlaceholder to control AI completion
	const isFocusOnPlaceholderRef = useRef<boolean>(false)

	const prepareCopiedMention = useMemoizedFn(
		(
			rawAttrs: Record<string, unknown>,
		): TiptapMentionAttributes | null | Promise<TiptapMentionAttributes | null> => {
			if (
				!shouldEnableMention ||
				isOAuthInProgress ||
				rawAttrs.pending ||
				typeof rawAttrs.type !== "string" ||
				!rawAttrs.data ||
				typeof rawAttrs.data !== "object" ||
				Array.isArray(rawAttrs.data)
			)
				return null

			const attrs = rawAttrs as unknown as TiptapMentionAttributes
			if (needsFileReferenceNormalization(attrs)) {
				const identity = getFileReferenceIdentityKey()
				const project = getCurrentProjectId?.()
				return normalizeFileReferenceMention(attrs)
					.then((normalized) => {
						if (
							identity !== getFileReferenceIdentityKey() ||
							project !== getCurrentProjectId?.()
						)
							return null
						if (!normalized)
							magicToast.error(i18n.t("super:common.fileNotFoundOrLoadFailed"))
						return normalized
					})
					.catch(() => {
						if (
							identity === getFileReferenceIdentityKey() &&
							project === getCurrentProjectId?.()
						)
							magicToast.error(i18n.t("super:common.fileNotFoundOrLoadFailed"))
						return null
					})
			}
			let sourceProjectId: string | undefined
			if (
				attrs.type === MentionItemType.PROJECT_FILE ||
				attrs.type === MentionItemType.FOLDER
			) {
				const data = attrs.data as ProjectFileMentionData | DirectoryMentionData
				const sourceId =
					attrs.type === MentionItemType.PROJECT_FILE
						? (data as ProjectFileMentionData).file_id
						: (data as DirectoryMentionData).directory_id
				if (!sourceId) return null
				sourceProjectId = data.source_project_id || data.project_id
			} else if (attrs.type === MentionItemType.UPLOAD_FILE) {
				const data = attrs.data as UploadFileMentionData
				// 只恢复已完成的远端附件；未完成上传和本地元素截图不属于可复制文件。
				if (
					data.upload_status !== "done" ||
					!data.file_id ||
					!data.file_name ||
					!data.file_path ||
					data.is_html_screenshot ||
					data.storage_id
				)
					return null
			}

			const prepared = prepareCopiedMentionAttrs(attrs, sourceProjectId, mentionPanelStore)
			if (!prepared) return null
			return (isAllowedMention ?? defaultIsAllowedMention)(prepared, mentionPanelStore)
				? prepared
				: null
		},
	)

	const scrollToBottom = () => {
		setTimeout(() => {
			const proseMirror = domRef.current?.querySelector(".ProseMirror")
			if (proseMirror) {
				proseMirror.scrollTop = proseMirror.scrollHeight
			}
		}, 0)
	}

	const fetchSuggestion = useMemoizedFn(async (text: string) => {
		if (wechatChat.isOpen() || wechatChat.menu) return ""
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
		mentionPanelStore.setSkillQueryContext(topicMode, selectedTopic?.agent_code)
	}, [mentionPanelStore, topicMode, selectedTopic?.agent_code])

	// Update AI completion state based on focus position
	const updateAiCompletionState = useMemoizedFn((editor: ReturnType<typeof useEditor>) => {
		if (!editor) return

		const isFocusOnPlaceholder = isFocusOnSuperPlaceholder(editor) || wechatChat.isOpen()
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
			attributes: ariaLabel ? { "aria-label": ariaLabel } : {},
			handleKeyDown: (_, event) => {
				event.stopPropagation()
				if (event.isComposing) return false
				// 动作菜单先消费 Enter；导入窗口内回车用于编辑，不发送 AI 请求。
				if (wechatChat.handleKeyDown(event)) {
					event.preventDefault()
					return true
				}

				if (tryNavigatePromptCarouselShortcut(event, onPromptCarouselNavigate)) {
					return true
				}

				if (tryAcceptPromptCarouselShortcut(event, onPromptCarouselAccept)) {
					return true
				}

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

					// Keep newline behavior when Enter-to-send is disabled for this editor.
					if (!shouldSendWhenEnter || wechatChat.isOpen()) {
						return false
					}

					if (!sendEnabled) return true

					// 普通回车发送消息
					onKeyboardInput?.()
					onSend?.(tiptapEditor?.getJSON())
					return true
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
			CopyMessageExtension.configure({
				onMentionsInsert: onMentionInsertItems,
				onContentChange: onChange,
				dataService: mentionPanelStore,
				getWorkspaceFilesList,
				getCurrentProjectId,
			}),
			CodeAwarePasteExtension,
			SuperPlaceholderExtension.configure({
				size: size || "default",
			}),
			InspectorDetailExtension.configure({ prepareCopiedMention }),
			WechatChatHistoryExtension,
			PlaceholderExtension.configure({
				placeholder,
			}),
			UndoRedo.configure({
				depth: 100,
				newGroupDelay: 250,
			}),
			...(shouldEnableMention
				? [
						MentionExtension.configure({
							language: i18n.language as Language,
							// 原生文本序列化也使用文件链接，避免绕过自定义 copy 时退回 @文件名。
							renderText: ({ node }) =>
								getClipboardPlainText(
									{
										type: "mention",
										attrs: node.attrs as TiptapMentionAttributes,
									},
									getWorkspaceFilesList?.(),
									getCurrentProjectId?.(),
								).trim(),
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
							isAllowedMention: isAllowedMention ?? defaultIsAllowedMention,
							dataService: mentionPanelStore,
							nodeViewRenderers: {
								[MentionItemType.DESIGN_MARKER]: MarkerMentionNodeView,
								[MentionItemType.PROJECT_FILE]: FileMentionNodeView,
								[MentionItemType.USER_FILE]: FileMentionNodeView,
								[MentionItemType.USER_DIRECTORY]: FolderMentionNodeView,
								[MentionItemType.UPLOAD_FILE]: FileMentionNodeView,
								[MentionItemType.FOLDER]: (props) => (
									<FolderMentionNodeView
										{...props}
										getWorkspaceFilesList={getWorkspaceFilesList}
									/>
								),
							},
							shouldSkipInsertSync,
							shouldSkipMentionValidation,
							isTrustedMention,
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

	const wechatChat = useWechatChatImport(
		tiptapEditor,
		wechatChatEnabled,
		`${selectedTopic?.id ?? ""}:${getCurrentProjectId?.() ?? ""}`,
	)
	AiCompletionService.setInstance({ editor: tiptapEditor })

	// Handle AI completion based on mobile, aiCompletionEnabled, and focus position
	const previousAiCompletionEnabledRef = useRef<boolean | null>(null)

	useEffect(() => {
		if (!tiptapEditor) return

		const isFocusOnPlaceholder = isFocusOnSuperPlaceholder(tiptapEditor)
		isFocusOnPlaceholderRef.current = isFocusOnPlaceholder
		const wasEnabled = previousAiCompletionEnabledRef.current
		const shouldEnable =
			!isMobile &&
			aiCompletionEnabled &&
			!isFocusOnPlaceholder &&
			!wechatChat.activeId &&
			!wechatChat.menu
		previousAiCompletionEnabledRef.current = shouldEnable

		if (!shouldEnable) {
			AiCompletionService.disable()
		} else {
			AiCompletionService.enable()
			if (wasEnabled === false && !tiptapEditor.isEmpty) {
				AiCompletionService.triggerFetchSuggestion()
			}
		}

		return () => {
			AiCompletionService.enable()
		}
	}, [isMobile, aiCompletionEnabled, tiptapEditor, wechatChat.activeId, wechatChat.menu])

	// Handle dynamic placeholder updates
	useUpdateEffect(() => {
		if (!tiptapEditor || tiptapEditor.isDestroyed || placeholder === undefined) {
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

			runActiveEditor(tiptapEditor, (editor) => {
				editor.commands.updatePlaceholder(placeholder)
			})
		})

		return () => {
			cancelAnimationFrame(timeoutId)
		}
	}, [tiptapEditor, placeholder])

	// Handle dynamic language updates for MentionExtension
	useEffect(() => {
		if (shouldEnableMention) {
			runActiveEditor(tiptapEditor, (editor) => {
				const mentionCommands = editor.commands as typeof editor.commands &
					MentionEditorCommands
				mentionCommands.updateMentionLanguage?.(i18n.language)
			})
		}
	}, [tiptapEditor, i18n.language, shouldEnableMention])

	// Handle dynamic keyboard shortcuts updates for MentionExtension
	useEffect(() => {
		if (shouldEnableMention) {
			runActiveEditor(tiptapEditor, (editor) => {
				const mentionCommands = editor.commands as typeof editor.commands &
					MentionEditorCommands
				mentionCommands.updateMentionKeyboardShortcuts?.(isOAuthInProgress)
			})
		}
	}, [tiptapEditor, isOAuthInProgress, shouldEnableMention])

	// Handle dynamic size updates for SuperPlaceholderExtension
	useEffect(() => {
		if (!tiptapEditor || !size) return
		// Defer past the current React commit so that all ReactNodeViewRenderer
		// mounts (which dispatch ProseMirror transactions) have settled before we
		// attempt to dispatch our own transaction. Without this deferral, ProseMirror
		// throws "Applying a mismatched transaction" because our `tr` was created
		// from a stale state snapshot.
		const raf = requestAnimationFrame(() => {
			runActiveEditor(tiptapEditor, (editor) => {
				editor.commands.updateSuperPlaceholderSize(size)
			})
		})
		return () => cancelAnimationFrame(raf)
	}, [tiptapEditor, size])

	// Handle dynamic enabled state for MentionExtension
	useEffect(() => {
		runActiveEditor(tiptapEditor, (editor) => {
			const mentionCommands = editor.commands as typeof editor.commands &
				MentionEditorCommands
			mentionCommands.updateMentionEnabled?.(shouldEnableMention)
		})
	}, [tiptapEditor, shouldEnableMention])

	return {
		tiptapEditor,
		domRef,
		scrollToBottom,
		wechatChat,
	}
}
