import { useStyles } from "./styles"
import { useFileUpload } from "@/opensource/pages/chatNew/components/MessageEditor/hooks/useFileUpload"
import { useMessageSend } from "@/opensource/pages/chatNew/components/MessageEditor/hooks/useMessageSend"
import useConversationDraft from "@/opensource/pages/chatNew/components/MessageEditor/hooks/useConversationDraft"
import DragOverlay from "@/opensource/pages/superMagic/components/MessageEditor/components/DragOverlay"
import { useMemoizedFn, useMount, useUpdateEffect } from "ahooks"
import { Editor, EditorContent, JSONContent } from "@tiptap/react"
import AiCompletionService from "@/opensource/services/chat/editor/AiCompletionService"
import { useMessageEditor } from "./hooks/useMessageEditor"
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import SuperMagicVoiceInput from "@/opensource/pages/superMagic/components/MessageEditor/components/VoiceInput"
import { VoiceInputRef } from "@/opensource/components/business/VoiceInput"
import CurrentChatAgentTip from "./components/CurrentChatAgentTip"
import UploadAction from "@/opensource/components/base/UploadAction"
import { IconArrowUp, IconFileUpload } from "@tabler/icons-react"
import { Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useDragUpload } from "@/opensource/pages/superMagic/components/MessageEditor/hooks"
import { SpinLoading } from "antd-mobile"
import InputFiles from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles"
import ConversationBotDataService from "@/opensource/services/chat/conversation/ConversationBotDataService"
import { isOnlyText } from "@/opensource/components/base/MagicRichEditor/utils"
import { cloneDeep } from "lodash-es"
import MessageReplyService from "@/opensource/services/chat/message/MessageReplyService"
import MessageEditStore from "@/opensource/stores/chatNew/messageUI/Edit"

import ConversationStore from "@/opensource/stores/chatNew/conversation"
import InstructionActions from "@/opensource/pages/chatNew/components/quick-instruction"
import { InstructionGroupType } from "@/opensource/types/bot"
import AgentSwitch from "./components/AgentSwitch"
import { ChatApi } from "@/opensource/apis"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import ConversationService from "@/opensource/services/chat/conversation/ConversationService"
import { observer } from "mobx-react-lite"
import MessageRefer from "@/opensource/pages/chatNew/components/ChatMessageList/components/ReferMessage"
import ReplyStore from "@/opensource/stores/chatNew/messageUI/Reply"
import MessageStore from "@/opensource/stores/chatNew/message"
import { autorun } from "mobx"
import { UserAvailableAgentInfo } from "@/opensource/apis/modules/chat/types"
import { RouteName } from "@/opensource/routes/constants"
import EditorStore from "@/opensource/stores/chatNew/messageUI/editor"
import TabIcon from "@/opensource/pages/superMagic/components/MessageEditor/assets/tab.svg"
import AiCompletionTip from "@/opensource/pages/chatNew/components/MessageEditor/components/AiCompletionTip"
import { useIsMobile } from "@/opensource/hooks/use-mobile"

interface MessageEditorProps {
	enableSwitchAgent?: boolean
	className?: string
	isSending?: boolean
	placeholder?: string
	size?: "default" | "small" | "mobile"
}

export interface MessageEditorRef {
	editor: Editor | null
	clearContent: () => void
}

function MessageEditor(
	{ className, enableSwitchAgent = false, placeholder, size }: MessageEditorProps,
	ref: React.Ref<MessageEditorRef>,
) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const isMobile = useIsMobile()

	const { value, setValue: _setValue } = EditorStore
	const [editorReady, setEditorReady] = useState(false)
	const settingContent = useRef(false)
	const [agent, setAgent] = useState<UserAvailableAgentInfo>()

	const conversationId = ConversationStore.currentConversation?.id
	const topicId = ConversationStore.currentConversation?.current_topic_id || ""

	useUpdateEffect(() => {
		setAgent(undefined)
	}, [enableSwitchAgent])

	/** Draft callback ref to resolve circular dependency */
	const draftCallbackRef = useRef<() => void>(() => {})

	/** Stable onChange callback to prevent useEditor re-initialization */
	const stableOnChange = useMemoizedFn((content: JSONContent) => {
		console.log("stableOnChange", content)
		_setValue(content)
		// Avoid triggering draft save when setting content programmatically
		if (!settingContent.current) {
			draftCallbackRef.current()
		}
	})

	/** Stable onFilesChange callback */
	const stableOnFilesChange = useMemoizedFn(() => {
		// Avoid triggering draft save when setting content programmatically
		if (!settingContent.current) {
			draftCallbackRef.current()
		}
	})

	const handleSendRef = useRef<() => void>(() => {})

	/** 实例 */
	const { tiptapEditor, domRef } = useMessageEditor({
		value,
		onSend: () => {
			handleSendRef.current()
		},
		onChange: stableOnChange,
		placeholder: placeholder || t("assistant.inputPlaceholder"),
	})

	/** 语音输入 */
	const voiceInputRef = useRef<VoiceInputRef>(null)

	/** 文件上传 */
	const { files, setFiles, onFileChange, uploadFilesForSend } = useFileUpload({
		maxUploadCount: 20,
		editorRef: { current: { editor: tiptapEditor } },
		onFilesChange: stableOnFilesChange,
	})

	/** Conversation Draft Management */
	const { writeCurrentDraft, deleteDraft: deleteDraftById } = useConversationDraft({
		editorRef: { current: { editor: tiptapEditor } },
		files,
		setFiles,
		setValue: _setValue,
		conversationId,
		topicId,
		editorReady,
		settingContent,
	})

	// Update draft callback ref after writeCurrentDraft is stable
	draftCallbackRef.current = writeCurrentDraft

	/** Set editor ready state */
	useMount(() => {
		if (tiptapEditor) {
			setEditorReady(true)
		}
	})

	/** 拖拽状态管理 */
	const { isDragOver, dragEvents } = useDragUpload({
		onFilesDropped: onFileChange,
	})

	/**
	 * 粘贴上传
	 */
	const handlePaste = useMemoizedFn((e: React.ClipboardEvent) => {
		const clipboardData = e.clipboardData
		if (!clipboardData) return

		// 检查是否有文件
		const files = Array.from(clipboardData.files)

		if (files.length > 0) {
			e.preventDefault()
			onFileChange(files)
		}
	})

	// Update isEmpty state when content changes
	const sendDisabled = useMemo(() => {
		const hasContent = (value && tiptapEditor?.getText()) || files.length > 0
		// 如果启用了切换Agent，并且没有选择Agent，则认为编辑器为空
		return !hasContent || (enableSwitchAgent && !agent)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, files.length, enableSwitchAgent, agent])

	/** 获取编辑器内容 */
	const getEditorJSON = useMemoizedFn(() => {
		try {
			const editorJson = value
			// Ensure json is valid
			if (!editorJson || typeof editorJson !== "object" || !("type" in editorJson)) {
				return {
					json: {
						type: "doc",
						content: [{ type: "paragraph" }],
					},
					onlyText: true,
				}
			}

			const json =
				ConversationBotDataService.enhanceJsonContentBaseSwitchInstruction(editorJson)
			return { json, onlyText: isOnlyText(json) }
		} catch (error) {
			console.error("Error getting editor JSON:", error)
			return {
				json: {
					type: "doc",
					content: [{ type: "paragraph" }],
				},
				onlyText: true,
			}
		}
	})

	/** 发送后清理 */
	const resetContent = useMemoizedFn(() => {
		tiptapEditor?.chain().clearContent().run()
		if (ConversationBotDataService.residencyContent.length > 0) {
			tiptapEditor
				?.chain()
				.focus()
				.insertContent(cloneDeep(ConversationBotDataService.residencyContent))
				.run()
		}

		ConversationBotDataService.clearSessionInstructConfig()

		if (conversationId && topicId) {
			deleteDraftById(conversationId, topicId)
		}

		MessageReplyService.reset()
		MessageEditStore.reset()
		setFiles([])
		// Clear internal state
		_setValue(undefined)
	})

	/** 消息发送 */
	const { handleSend, handleSendWithoutCheck, isSending } = useMessageSend({
		sendDisabled,
		getEditorJSON,
		uploadFilesForSend,
		onAfterSend: () => {
			resetContent()
			if (enableSwitchAgent && agent) {
				navigate({ name: RouteName.SuperAssistant })
			}
		},
		onBeforeSend: async () => {
			if (enableSwitchAgent && conversationId) {
				const res = await ChatApi.createTopic(undefined, conversationId)
				ConversationService.switchTopic(
					conversationId,
					res.data.seq.message.create_topic.id,
				)
			}
		},
	})

	handleSendRef.current = () => {
		handleSend(
			tiptapEditor?.getJSON() as JSONContent,
			isOnlyText(tiptapEditor?.getJSON() as JSONContent),
		)
	}

	ConversationBotDataService.updateProps({
		editorRef: { editor: tiptapEditor },
		onSend: handleSendWithoutCheck,
	})

	/** ============================== Reply Message =============================== */
	const referMessageId = ReplyStore.replyMessageId
	const handleReferMessageClick = useMemoizedFn(() => {
		if (referMessageId) {
			// FIXME: Scroll to referenced message
			MessageStore.setFocusMessageId(referMessageId)
		}
	})

	// Auto focus on input after selecting reply message
	useEffect(() => {
		return autorun(() => {
			if (ReplyStore.replyMessageId) {
				tiptapEditor?.commands.focus()
			}
		})
	}, [tiptapEditor])

	/**
	 * 暴露给父组件的接口
	 */
	useImperativeHandle(
		ref,
		() => ({
			editor: tiptapEditor,
			clearContent: resetContent,
		}),
		[tiptapEditor, resetContent],
	)

	return (
		<div
			className={styles.container}
			onDragEnter={dragEvents.onDragEnter}
			onDragLeave={dragEvents.onDragLeave}
			onDragOver={dragEvents.onDragOver}
			onDrop={dragEvents.onDrop}
			onPaste={handlePaste}
			data-testid="chat-message-editor-container"
		>
			{enableSwitchAgent ? (
				<AgentSwitch agent={agent} onSwitchAgent={setAgent} />
			) : (
				<CurrentChatAgentTip />
			)}
			<MessageRefer
				isSelf={false}
				containerClassName={styles.referMessageSection}
				className={styles.referMessage}
				onClick={handleReferMessageClick}
			/>
			<InputFiles files={files} onFilesChange={setFiles} />
			<EditorContent
				ref={domRef}
				editor={tiptapEditor}
				className={cx(styles.editor, className, size)}
				onCompositionStart={AiCompletionService.onCompositionStart}
				onCompositionEnd={AiCompletionService.onCompositionEnd}
			/>
			{!isMobile && <AiCompletionTip icon={TabIcon as string} />}
			<FlexBox
				align="center"
				justify="space-between"
				gap={20}
				className={styles.editorFooter}
				data-testid="chat-message-editor-footer"
			>
				<FlexBox
					align="flex-start"
					gap={4}
					flex={1}
					className={styles.footerLeft}
					data-testid="chat-message-editor-footer-left"
				>
					<InstructionActions
						noStyle
						position={InstructionGroupType.TOOL}
						className={styles.quickInstructionButton}
					/>
					<InstructionActions
						noStyle
						position={InstructionGroupType.DIALOG}
						className={styles.quickInstructionButton}
					/>
				</FlexBox>
				<div className={styles.footerRight} data-testid="chat-message-editor-footer-right">
					<UploadAction
						multiple
						onFileChange={onFileChange}
						handler={(trigger) => (
							<Tooltip title={t("messageEditor.addAttachment")} placement="top">
								<div
									className={cx(styles.toolBarButton)}
									onClick={trigger}
									data-testid="chat-message-editor-upload-button"
								>
									<MagicIcon component={IconFileUpload} size={20} />
								</div>
							</Tooltip>
						)}
					/>
					<SuperMagicVoiceInput
						ref={voiceInputRef}
						initValue={value}
						tiptapEditor={tiptapEditor}
						updateValue={_setValue}
					/>
					<button
						className={cx(
							styles.sendButton,
							(sendDisabled || isSending) && styles.sendButtonDisabled,
						)}
						disabled={sendDisabled || isSending}
						onClick={handleSendRef.current}
						data-testid="chat-message-editor-send-button"
						data-sending={isSending}
						data-disabled={sendDisabled}
					>
						{isSending ? (
							<SpinLoading style={{ width: 20, height: 20 }} />
						) : (
							<MagicIcon component={IconArrowUp} size={20} color="currentColor" />
						)}
					</button>
				</div>
			</FlexBox>
			<DragOverlay visible={isDragOver} />
		</div>
	)
}

export default memo(observer(forwardRef(MessageEditor)))
