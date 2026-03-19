/** 外部依赖 */
import { autorun } from "mobx"
import { observer } from "mobx-react-lite"
import { Flex } from "antd"
import { cloneDeep, omit } from "lodash-es"
import { useTranslation } from "react-i18next"
import { IconSend, IconMessage2Plus, IconArrowBackUp, IconMessage2 } from "@tabler/icons-react"
import { useKeyPress, useMemoizedFn, useMount, useAsyncEffect } from "ahooks"

/** React相关 */
import { useMemo, useRef, useState, useEffect } from "react"
import type { HTMLAttributes } from "react"

/** 类型定义 */
import type { JSONContent, UseEditorOptions } from "@tiptap/react"
import type { ReportFileUploadsResponse } from "@/apis/modules/file"
import type { EmojiInfo } from "@/components/base/MagicEmojiPanel/types"
import type { MagicRichEditorRef } from "@/components/base/MagicRichEditor"
import { InstructionGroupType, SystemInstructType } from "@/types/bot"

/** 自定义Hooks */
import { IMStyle, useAppearanceStore } from "@/providers/AppearanceProvider/context"
import { useGlobalLanguage } from "@/models/config/hooks"
import useInputStyles from "./hooks/useInputStyles"
import { useFileUpload } from "./hooks/useFileUpload"
import { useMessageSend } from "./hooks/useMessageSend"
import useConversationDraft from "./hooks/useConversationDraft"
// import useRecordingSummary from "./hooks/useRecordingSummary"

/** 自定义组件 */
import MagicButton from "@/components/base/MagicButton"
import MagicEmojiNodeExtension from "@/components/base/MagicRichEditor/extensions/magicEmoji"
import MagicIcon from "@/components/base/MagicIcon"
import MagicRichEditor from "@/components/base/MagicRichEditor"
import InputFiles from "./components/InputFiles"
import UploadButton from "./components/UploadButton"
import EmojiButton from "./components/EmojiButton"
import MagicInputLayout from "./components/MagicInputLayout"
import TimedTaskButton from "./components/TimedTaskButton"
import InstructionActions, { InstructionWrapper } from "../quick-instruction"
import QuickInstructionExtension from "../quick-instruction/extension"
import MessageRefer from "../ChatMessageList/components/ReferMessage"

import EditorService from "@/services/chat/editor/EditorService"
import ConversationBotDataService from "@/services/chat/conversation/ConversationBotDataService"
import MessageReplyService from "@/services/chat/message/MessageReplyService"
import TopicService from "@/services/chat/topic/class"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"

/** Store */
import ConversationStore from "@/stores/chatNew/conversation"
import startPageStore from "@/stores/chatNew/startPage"
import ReplyStore from "@/stores/chatNew/messageUI/Reply"
import MessageStore from "@/stores/chatNew/message"
import MessageEditStore from "@/stores/chatNew/messageUI/Edit"
import EditorStore from "@/stores/chatNew/messageUI/editor"

/** 工具函数 */
import { isWindows } from "@/utils/devices"
import { isOnlyText } from "@/components/base/MagicRichEditor/utils"
import { Image } from "@/components/base/MagicRichEditor/extensions/image"
import { IMAGE_EXTENSIONS } from "@/constants/file"
import {
	ConversationMessageType,
	TextConversationMessage,
	MarkdownConversationMessage,
	RichTextConversationMessage,
	FileConversationMessage,
} from "@/types/chat/conversation_message"
import { jsonParse } from "@/utils/string"
import MessageEdit from "../ChatMessageList/components/EditMessage"
import AiCompletionTip from "./components/AiCompletionTip"
import { genPreviousFileData } from "./components/InputFiles/utils"
import { ChatApi, BotApi } from "@/apis"
import ConversationService from "@/services/chat/conversation/ConversationService"
import { useIsMobile } from "@/hooks/useIsMobile"
import useNavigate from "@/routes/hooks/useNavigate"
import { MessageReceiveType } from "@/types/chat"
import { RouteName } from "@/routes/constants"

export interface SendData {
	jsonValue: JSONContent | undefined
	normalValue: string
	files: ReportFileUploadsResponse[]
	onlyTextContent: boolean
	isLongMessage?: boolean
}

const MAX_UPLOAD_COUNT = 20

export interface MagicInputProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue"> {
	/** Underlying Tiptap editor configuration */
	tiptapProps?: UseEditorOptions
	/** Whether the component is visible */
	visible?: boolean
	/** Whether the component is disabled */
	disabled?: boolean
	/** Theme style */
	theme?: IMStyle
	/** Send message when Enter is pressed */
	sendWhenEnter?: boolean
	/** Clear content after sending */
	clearAfterSend?: boolean
	/** Placeholder text */
	placeholder?: string
	/** Input main container class name */
	inputMainClassName?: string
	/** Whether to create topic before sending */
	beforeSendCreateTopic?: boolean
	/** 是否处于审批启动页 */
	isApprovalStartPage?: boolean
	/** 是否处于审批中心 */
	isApprovalCenter?: boolean
	/** 审批助理ID */
	approvalAgentId?: string
}

const MessageEditor = observer(function MessageEditor({
	disabled = false,
	tiptapProps,
	visible = true,
	theme = IMStyle.Standard,
	placeholder,
	sendWhenEnter = true,
	clearAfterSend = true,
	beforeSendCreateTopic = false,
	isApprovalStartPage = false,
	isApprovalCenter = false,
	approvalAgentId = "",
	className,
	...rest
}: MagicInputProps) {
	/** Translation */
	const { t } = useTranslation("interface")
	const isMobile = useIsMobile()
	const navigate = useNavigate()
	/** Language */
	const language = useGlobalLanguage(false)
	/** Style */
	const { standardStyles, modernStyles } = useInputStyles({ disabled })

	/** State */
	const isAiConversation = ConversationStore.currentConversation?.isAiConversation
	const conversationId = ConversationStore.currentConversation?.id
	const topicId = ConversationStore.currentConversation?.current_topic_id

	const editorRef = useRef<MagicRichEditorRef>(null)
	const [isEmpty, setIsEmpty] = useState<boolean>(true)

	const { value, setValue, isValidContent } = EditorStore

	// Editor ready state
	const [editorReady, setEditorReady] = useState(false)
	// Prevent duplicate content setting
	const settingContent = useRef(false)

	/** Safe editor focus helper to prevent TipTap view errors */
	const safeEditorFocus = useMemoizedFn(() => {
		try {
			const editor = editorRef.current?.editor
			if (editor && editorReady && !settingContent.current) {
				// Use chain method which has better error handling
				editor.chain().focus().run()
			}
		} catch (error) {
			// Silently handle focus errors when editor view is not ready
			console.debug("Editor focus skipped: view not ready")
		}
	})

	const {
		updateProps,
		residencyContent,
		enhanceJsonContentBaseSwitchInstruction,
		clearSessionInstructConfig,
	} = ConversationBotDataService

	// Listen for text from guide page
	useEffect(() => {
		return autorun(() => {
			if (ConversationStore.selectText && editorReady && !settingContent.current) {
				settingContent.current = true
				editorRef.current?.editor?.commands.setContent(ConversationStore.selectText, {
					emitUpdate: true,
				})
				safeEditorFocus()
				setIsEmpty(false)
				ConversationStore.setSelectText("")
				settingContent.current = false
			}
		})
	}, [editorReady, safeEditorFocus])

	useMount(() => {
		if (value !== undefined && editorReady && !settingContent.current) {
			settingContent.current = true
			editorRef.current?.editor?.commands.setContent(value, { emitUpdate: true })
			safeEditorFocus()
			settingContent.current = false
		}
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
				safeEditorFocus()
			}
		})
	}, [safeEditorFocus])

	/** ========================== Draft ========================== */
	// Create draft callback ref to resolve circular dependency
	const draftCallbackRef = useRef<() => void>(() => {
		// Initial empty callback, will be updated by useConversationDraft
	})

	/** ============================== File Upload =============================== */
	const {
		files,
		setFiles,
		uploading,
		uploadFilesForSend,
		onFileChange,
		handlePasteFileFail,
		onDrop,
		onDragOver,
	} = useFileUpload({
		maxUploadCount: MAX_UPLOAD_COUNT,
		onFilesChange: () => draftCallbackRef.current(),
		editorRef,
	})

	/** ========================== Draft Hook ========================== */
	const { writeCurrentDraft, deleteDraft: deleteDraftById } = useConversationDraft({
		editorRef,
		files,
		setFiles,
		setIsEmpty,
		setValue,
		conversationId,
		topicId,
		editorReady,
		settingContent,
	})

	// Update draft callback ref
	draftCallbackRef.current = writeCurrentDraft

	/** ========================== 编辑消息 ========================== */
	useEffect(() => {
		return autorun(() => {
			const editMessage = MessageEditStore.editMessage
			if (editMessage && editorReady && !settingContent.current) {
				settingContent.current = true
				switch (editMessage.type) {
					case ConversationMessageType.Text:
						const text =
							(editMessage.message as TextConversationMessage).text?.content ?? ""

						editorRef.current?.editor?.commands.setContent(text, { emitUpdate: true })

						setFiles(
							(editMessage.message as TextConversationMessage).text?.attachments?.map(
								genPreviousFileData,
							) ?? [],
						)
						break
					case ConversationMessageType.Markdown:
						editorRef.current?.editor?.commands.setContent(
							(editMessage.message as MarkdownConversationMessage).markdown
								?.content ?? "",
							{ emitUpdate: true },
						)
						setFiles(
							(
								editMessage.message as MarkdownConversationMessage
							).markdown?.attachments?.map(genPreviousFileData) ?? [],
						)
						break
					case ConversationMessageType.RichText:
						const richText = jsonParse(
							(editMessage.message as RichTextConversationMessage).rich_text
								?.content ?? "{}",
							{},
						)
						editorRef.current?.editor?.commands.setContent(richText, {
							emitUpdate: true,
						})
						setFiles(
							(
								editMessage.message as RichTextConversationMessage
							).rich_text?.attachments?.map(genPreviousFileData) ?? [],
						)
						break
					case ConversationMessageType.Files:
						const files = (editMessage.message as FileConversationMessage).files
							?.attachments

						// 如果文件是图片, 则插入图片
						if (
							files?.length === 1 &&
							IMAGE_EXTENSIONS.includes(files[0].file_extension ?? "")
						) {
							editorRef.current?.editor?.commands.setContent(
								{
									type: "doc",
									content: [
										{
											type: "paragraph",
											content: [
												{
													type: Image.name,
													attrs: {
														file_id: files[0].file_id,
														file_name: files[0].file_name,
														file_size: files[0].file_size,
														file_extension: files[0].file_extension,
													},
												},
											],
										},
									],
								},
								{ emitUpdate: true },
							)
							break
						}
						setFiles(
							(
								editMessage.message as FileConversationMessage
							).files?.attachments?.map(genPreviousFileData) ?? [],
						)
						break
					default:
						break
				}
				safeEditorFocus()
				settingContent.current = false
			} else if (!editMessage) {
				settingContent.current = true
				editorRef.current?.editor?.commands.setContent("", { emitUpdate: true })
				safeEditorFocus()
				settingContent.current = false
				setFiles([])
			}
		})
	}, [editorReady, setFiles, safeEditorFocus])

	/** ========================== 发送消息 ========================== */

	/** ========================== Add Emoji ========================== */
	const onAddEmoji = useMemoizedFn((emoji: EmojiInfo) => {
		try {
			editorRef.current?.editor
				?.chain()
				.focus()
				.insertContent({
					type: MagicEmojiNodeExtension.name,
					attrs: { ...emoji, locale: language },
				})
				.run()
		} catch (error) {
			console.debug("Add emoji focus skipped: editor view not ready")
		}
	})

	const footerInstructionsNode = useMemo(() => {
		if (!isAiConversation) return null
		return (
			<InstructionWrapper position={InstructionGroupType.DIALOG}>
				<InstructionActions position={InstructionGroupType.DIALOG} />
			</InstructionWrapper>
		)
	}, [isAiConversation])

	const hasStartPage =
		isAiConversation &&
		ConversationBotDataService.agentId &&
		ConversationBotDataService.startPage &&
		!startPageStore.StartPageMap.get(ConversationBotDataService.agentId)

	const emojiButton = useMemo(
		() => (
			<EmojiButton
				className={standardStyles.button}
				imStyle={theme}
				onEmojiClick={onAddEmoji}
			/>
		),
		[standardStyles.button, theme, onAddEmoji],
	)

	const uploadButton = useMemo(
		() => (
			<UploadButton
				className={standardStyles.button}
				imStyle={theme}
				onFileChange={onFileChange}
				multiple
			/>
		),
		[standardStyles.button, theme, onFileChange],
	)

	const onCreateTopic = useMemoizedFn(() => {
		startPageStore.closeStartPage()
		TopicService.createTopic?.()
	})

	const newTopicButton = useMemo(
		() => (
			<MagicButton
				className={standardStyles.button}
				type="text"
				icon={<MagicIcon size={20} color="currentColor" component={IconMessage2Plus} />}
				onClick={onCreateTopic}
			>
				{t("chat.input.newTopic")}
			</MagicButton>
		),
		[onCreateTopic, standardStyles.button, t],
	)

	// const { startRecordingSummary, RecordingSummaryButton } = useRecordingSummary({
	// 	conversationId,
	// })

	// const onStartRecordingSummary = useMemoizedFn(() => {
	// 	if (isShowStartPage) updateStartPage(false)
	// 	startRecordingSummary()
	// })

	// const recordingSummaryButton = (
	// 	<MagicButton
	// 		className={standardStyles.button}
	// 		type="text"
	// 		icon={RecordingSummaryButton}
	// 		onClick={onStartRecordingSummary}
	// 	>
	// 		{messageT("chat.recording_summary.title")}
	// 	</MagicButton>
	// )

	const recordingSummaryButton = null

	const timedTaskButton = useMemo(
		() => <TimedTaskButton className={standardStyles.button} conversationId={conversationId} />,
		[conversationId, standardStyles.button],
	)

	/** 获取审批会话 */
	const getApprovalConversation = useMemoizedFn(async (agent_id: string) => {
		const res = await BotApi.registerAndAddFriend(agent_id)
		if (res?.id) {
			const conversation = await ConversationService.createConversation(
				MessageReceiveType.Ai,
				res.user_id,
			)
			return conversation
		}
	})

	/** 跳转到审批会话 */
	const navigateApprovalConversation = useMemoizedFn((conversation_id: string) => {
		if (isMobile) {
			navigate({
				name: RouteName.ChatConversation,
				query: {
					conversation_id,
				},
			})
		} else {
			// 跳转到 Chat 页面
			navigate({
				name: RouteName.Chat,
				query: {
					conversation_id,
				},
			})
		}
	})

	/** 回到审批的历史会话 */
	const handleCheckHistoryConversation = useMemoizedFn(async () => {
		if (isApprovalStartPage) {
			startPageStore.closeStartPage()
		} else if (isApprovalCenter) {
			const conversationId = ConversationStore.currentConversation?.id
			if (conversationId) {
				navigateApprovalConversation(conversationId)
				startPageStore.setIsHiddenWhenInit(true)
			}
		}
	})

	/** ========================== Button Group ========================== */
	const buttons = useMemo(() => {
		if (isAiConversation) {
			return (
				<Flex align="center" justify="space-between">
					<Flex align="center" gap={4} className={standardStyles.buttonGroups}>
						<InstructionWrapper position={InstructionGroupType.TOOL}>
							<InstructionActions
								position={InstructionGroupType.TOOL}
								systemButtons={{
									[SystemInstructType.EMOJI]: emojiButton,
									[SystemInstructType.FILE]: uploadButton,
									[SystemInstructType.TOPIC]: newTopicButton,
									[SystemInstructType.TASK]: timedTaskButton,
									[SystemInstructType.RECORD]: recordingSummaryButton,
								}}
							/>
						</InstructionWrapper>
						{(isApprovalStartPage || isApprovalCenter) && (
							<MagicButton
								type="text"
								onClick={handleCheckHistoryConversation}
								icon={
									<MagicIcon
										color="currentColor"
										size={20}
										component={IconMessage2}
									/>
								}
							>
								{t("chat.aiImage.checkHistoryConversation")}
							</MagicButton>
						)}
					</Flex>
				</Flex>
			)
		}
		return (
			<Flex align="center" gap={4} className={standardStyles.buttonGroups}>
				{emojiButton}
				{uploadButton}
				{(isApprovalStartPage || isApprovalCenter) && (
					<MagicButton
						type="text"
						onClick={handleCheckHistoryConversation}
						icon={<MagicIcon color="currentColor" size={20} component={IconMessage2} />}
					>
						{t("chat.aiImage.checkHistoryConversation")}
					</MagicButton>
				)}
			</Flex>
		)
	}, [
		isAiConversation,
		standardStyles.buttonGroups,
		emojiButton,
		uploadButton,
		isApprovalStartPage,
		isApprovalCenter,
		handleCheckHistoryConversation,
		t,
		newTopicButton,
		timedTaskButton,
	])

	/** ========================== AI Auto Completion ========================== */
	if (editorRef.current) {
		AiCompletionService.setInstance(editorRef.current)
	}
	useEffect(() => {
		if (isEmpty) {
			AiCompletionService.clearSuggestion()
		}
	}, [isEmpty])

	const openAiCompletion = useAppearanceStore((state) => state.aiCompletion)
	/** ========================== Editor Configuration ========================== */
	const editorProps = useMemo<UseEditorOptions>(() => {
		const extensions = [
			/** Quick instruction extension */
			QuickInstructionExtension,
			/** Other extensions */
			...(tiptapProps?.extensions ?? []),
		]

		if (openAiCompletion) {
			extensions.unshift(
				AiCompletionService.getExtension({
					fetchSuggestion: EditorService.fetchAiAutoCompletion,
				}),
			)
		}

		// Default empty content structure for Tiptap (doc with paragraph)
		const emptyTiptapContent = {
			type: "doc",
			content: [{ type: "paragraph" }],
		}

		return {
			// onPaste,
			content: isValidContent ? value : emptyTiptapContent,
			onUpdate: ({ editor: e }) => {
				if (settingContent.current) return

				try {
					// Get editor JSON
					const json = e?.getJSON()
					const text = e?.getText() ?? ""

					// Only update state if json is valid
					if (json && typeof json === "object" && "type" in json) {
						// Update internal state
						setValue?.(json)
						// Write draft
						writeCurrentDraft()
						// Set empty state
						setIsEmpty(!text)
					}
				} catch (error) {
					console.error("Error updating editor content:", error)
				}
			},
			onTransaction: () => {
				// Handle input events without triggering re-render
			},
			onCreate: () => {
				setEditorReady(true)
			},
			extensions,
			enableContentCheck: false, // Disable built-in content check, we handle it ourselves
			...omit(tiptapProps, ["extensions", "onContentError"]),
		}
	}, [tiptapProps, openAiCompletion, isValidContent, value, setValue, writeCurrentDraft])

	const getEditorJSON = useMemoizedFn(() => {
		try {
			const editorJson = editorRef.current?.editor?.getJSON()
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

			const json = enhanceJsonContentBaseSwitchInstruction(editorJson)
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

	/** ========================== Send Button ========================== */
	const sendDisabled = (isEmpty && !files.length) || uploading

	const handleAfterSend = useMemoizedFn(() => {
		if (clearAfterSend) {
			setIsEmpty(true)
			editorRef.current?.editor?.chain().clearContent().run()
			if (residencyContent.length > 0) {
				try {
					editorRef.current?.editor
						?.chain()
						.focus()
						.insertContent(cloneDeep(residencyContent))
						.run()
				} catch (error) {
					console.debug("Insert residency content focus skipped: editor view not ready")
				}
			}

			clearSessionInstructConfig()

			if (conversationId && topicId) {
				deleteDraftById(conversationId, topicId)

				if (isApprovalCenter) {
					startPageStore.setIsHiddenWhenInit(true)
					navigateApprovalConversation(conversationId)
				}
			}

			MessageReplyService.reset()
			MessageEditStore.reset()
			setFiles([])
			// Clear internal state
			setValue(undefined)
		}
	})

	const handleBeforeSend = useMemoizedFn(async () => {
		try {
			const conversationId = ConversationStore.currentConversation?.id

			if (beforeSendCreateTopic && conversationId) {
				const res = await ChatApi.createTopic(undefined, conversationId)
				if (res.data.seq.message.create_topic) {
					ConversationService.switchTopic(
						conversationId,
						res.data.seq.message.create_topic.id,
					)
				}
			}
		} catch (error) {
			console.error("Error before send:", error)
		}
	})

	const { handleSend, handleSendWithoutCheck } = useMessageSend({
		sendDisabled,
		getEditorJSON,
		uploadFilesForSend,
		onAfterSend: handleAfterSend,
		onBeforeSend: handleBeforeSend,
	})

	updateProps({
		editorRef: editorRef.current,
		onSend: handleSendWithoutCheck,
	})

	/** ========================== Enter to Send ========================== */
	useKeyPress(
		"Enter",
		() => {
			if (sendWhenEnter) {
				handleSend()
			}
		},
		{
			exactMatch: true,
		},
	)

	const Footer = useMemo(() => {
		return (
			<Flex align="center" justify="flex-end" className={modernStyles.footer} gap={10}>
				<Flex flex={1} align="center" justify="flex-start" gap={10}>
					{hasStartPage && !isApprovalCenter && (
						<MagicButton
							icon={
								<MagicIcon
									size={18}
									color="currentColor"
									component={IconArrowBackUp}
								/>
							}
							className={modernStyles.returnButton}
							onClick={() => {
								startPageStore.openStartPage()
							}}
						>
							{t("chat.returnHome")}
						</MagicButton>
					)}
					{footerInstructionsNode}
				</Flex>
				<span className={standardStyles.tip}>
					{isWindows ? t("placeholder.magicInputWindows") : t("placeholder.magicInput")}
				</span>
				<MagicButton
					type="primary"
					disabled={sendDisabled}
					className={modernStyles.sendButton}
					icon={<MagicIcon color="currentColor" size={24} component={IconSend} />}
					onClick={handleSend}
				>
					{t("send")}
				</MagicButton>
			</Flex>
		)
	}, [
		footerInstructionsNode,
		handleSend,
		hasStartPage,
		isApprovalCenter,
		modernStyles.footer,
		modernStyles.returnButton,
		modernStyles.sendButton,
		sendDisabled,
		standardStyles.tip,
		t,
	])

	const onClick = useMemoizedFn(() => {
		try {
			editorRef.current?.editor?.chain().focus().run()
		} catch (error) {
			console.debug("Click focus skipped: editor view not ready")
		}
	})

	const ChildrenRender = useMemoizedFn(({ className: inputClassName }) => {
		return (
			<>
				<MagicRichEditor
					ref={editorRef}
					placeholder={
						placeholder ?? t("chat.pleaseEnterMessageContent", { ns: "message" })
					}
					className={inputClassName}
					showToolBar={false}
					onClick={onClick}
					onCompositionStart={AiCompletionService.onCompositionStart}
					onCompositionEnd={AiCompletionService.onCompositionEnd}
					editorProps={editorProps}
					enterBreak={sendWhenEnter}
					onPasteFileFail={handlePasteFileFail}
				/>
				{openAiCompletion && <AiCompletionTip />}
			</>
		)
	})

	useAsyncEffect(async () => {
		if (isApprovalCenter) {
			const conversation = await getApprovalConversation(approvalAgentId)
			if (conversation && conversation.id) {
				ConversationService.switchConversation(conversation)
			}
		}
	}, [isApprovalCenter])

	if (!visible) return null

	return (
		<MagicInputLayout
			theme={theme}
			extra={
				<>
					<MessageRefer
						isSelf={false}
						containerClassName={standardStyles.referMessageSection}
						className={standardStyles.referMessage}
						onClick={handleReferMessageClick}
					/>
					<MessageEdit
						containerClassName={standardStyles.referMessageSection}
						className={standardStyles.referMessage}
						onClick={handleReferMessageClick}
					/>
				</>
			}
			buttons={
				<div style={{ padding: "6px 14px 8px 14px" }}>
					{buttons}
					<InputFiles files={files} onFilesChange={setFiles} />
				</div>
			}
			footer={Footer}
			className={className}
			onDrop={onDrop}
			onDragOver={onDragOver}
			{...omit(rest, ["onContentChange"])}
		>
			{ChildrenRender}
		</MagicInputLayout>
	)
})

export default MessageEditor
