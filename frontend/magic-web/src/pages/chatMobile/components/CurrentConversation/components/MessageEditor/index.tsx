import React, { useState, useRef, useMemo, useEffect } from "react"
import { Flex } from "antd"
import { IconCircleX, IconFileSearch, IconMessagePlus, IconMoodSmile } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import { useMessageEditorStyles } from "./styles"
import { useTheme } from "antd-style"
import MagicRichEditor, { MagicRichEditorRef } from "@/components/base/MagicRichEditor"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"
import {
	useBoolean,
	useDebounceFn,
	useKeyPress,
	useMemoizedFn,
	useMount,
	useThrottleFn,
} from "ahooks"
import { Extension, JSONContent, UseEditorOptions } from "@tiptap/react"
import { omit } from "lodash-es"
import { useAppearanceStore } from "@/providers/AppearanceProvider/context"
import QuickInstructionExtension from "@/pages/chatNew/components/quick-instruction/extension"
import EditorStore from "@/stores/chatNew/messageUI/editor"
import ConversationStore from "@/stores/chatNew/conversation"
import EditorDraftService from "@/services/chat/editor/DraftService"
import { useTranslation } from "react-i18next"
import { genFileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import { FileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import { useUpload } from "@/hooks/useUploadFiles"
import { FileApi } from "@/apis"
import { useGlobalLanguage } from "@/models/config/hooks"
import { isIos } from "@/utils/devices"
import { useIsMobile } from "@/hooks/useIsMobile"

// Stores
import ReplyStore from "@/stores/chatNew/messageUI/Reply"
import MessageStore from "@/stores/chatNew/message"
import startPageStore from "@/stores/chatNew/startPage"
import EditorDraftStore from "@/stores/chatNew/editorDraft"

// Audio utilities
import {
	convertBlobToAudioFile,
	getAudioDuration,
	validateAudioFileSizeByType,
	generateAudioFilename,
} from "@/utils/audio"

// Services
import EditorService from "@/services/chat/editor/EditorService"
import MessageReplyService from "@/services/chat/message/MessageReplyService"
import TopicService from "@/services/chat/topic"
import ConversationBotDataService from "@/services/chat/conversation/ConversationBotDataService"
import MagicButton from "@/components/base/MagicButton"
import { EmojiInfo } from "@/components/base/MagicEmojiPanel/types"
import MagicModal from "@/components/base/MagicModal"
import MagicEmojiNodeExtension from "@/components/base/MagicRichEditor/extensions/magicEmoji"
import {
	transformJSONContent,
	isOnlyText,
	FileError,
} from "@/components/base/MagicRichEditor/utils"
import MessageRefer from "@/pages/chatNew/components/ChatMessageList/components/ReferMessage"
import { generateRichText } from "@/pages/chatNew/components/ChatSubSider/utils"
import useInputStyles from "@/pages/chatNew/components/MessageEditor/hooks/useInputStyles"
import InstructionActions from "@/pages/chatNew/components/quick-instruction"
import MessageService from "@/services/chat/message/MessageService"
import { InstructionGroupType, SystemInstructType } from "@/types/bot"
import { autorun, computed } from "mobx"
import FlexBox from "@/components/base/FlexBox"
import EmojiPanel from "../EmojiPanel"
import UploadAction from "@/components/base/UploadAction"
import { observer } from "mobx-react-lite"
import AiTopicPopup from "../AiTopicPopup"
import { getUserName } from "@/utils/modules/chat"
import UserInfoStore from "@/stores/userInfo"
import InputFiles from "@/pages/chatNew/components/MessageEditor/components/InputFiles"
import MobileEditorStore from "@/pages/chatMobile/components/CurrentConversation/stores/MobileEditorStrore"
import { MessageReceiveType } from "@/types/chat"
import AiAutoCompleteConfirm from "./components/AiAutoCompleteConfirm"
import AiCompletionStore from "@/stores/chatNew/editor/AiCompletion"
import { IconMessageTopic } from "@/enhance/tabler/icons-react"
import VoiceInput from "./components/VoiceInput"
import IconCircleKeyboard from "@/enhance/tabler/icons-react/icons/IconCircleKeyboard"
import IconCircleMicrophone from "@/enhance/tabler/icons-react/icons/IconCircleMicrophone"
import magicToast from "@/components/base/MagicToaster/utils"

const MAX_UPLOAD_COUNT = 10

interface MessageEditorProps {
	style?: React.CSSProperties
	className?: string
	placeholder?: string
	onSend?: (message: string) => void
	disabled?: boolean
	clearAfterSend?: boolean
	sendWhenEnter?: boolean
}

const MessageEditor: React.FC<MessageEditorProps> = observer(
	({
		placeholder,
		clearAfterSend = true,
		disabled = false,
		sendWhenEnter = false,
		style,
		className,
	}) => {
		const { styles, cx } = useMessageEditorStyles()
		const { magicColorScales } = useTheme()
		/** Translation */
		const { t } = useTranslation("interface")
		/** Language */
		const language = useGlobalLanguage(false)
		/** Style */
		const { standardStyles } = useInputStyles({ disabled })
		const [voiceInputVisible, { toggle: toggleVoiceInputVisible }] = useBoolean(false)
		/** 移动端检测 */
		const isMobile = useIsMobile()
		const containerRef = useRef<HTMLDivElement>(null)
		/** 键盘状态检测 - 使用编辑器焦点状态实现即时响应 */
		const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

		/** State */
		const isAiConversation = ConversationStore.currentConversation?.isAiConversation
		const conversationId = ConversationStore.currentConversation?.id
		const topicId = ConversationStore.currentConversation?.current_topic_id

		// Dynamic placeholder
		const dynamicPlaceholder = useMemo(() => {
			return computed(() => {
				if (placeholder) return placeholder
				switch (ConversationStore.currentConversation?.receive_type) {
					case MessageReceiveType.Ai:
					case MessageReceiveType.User: {
						const receiveName = getUserName(
							UserInfoStore.get(
								ConversationStore.currentConversation?.receive_id ?? "",
							),
						)
						return t("chat.messageEditor.placeholder", {
							ns: "interface",
							name: receiveName,
						})
					}
					default:
						return undefined
				}
			})
		}, [placeholder, t]).get()

		const editorRef = useRef<MagicRichEditorRef>(null)
		const [isEmpty, setIsEmpty] = useState<boolean>(true)

		const { value, setValue, isValidContent } = EditorStore

		// Editor ready state
		const [editorReady, setEditorReady] = useState(false)
		// Prevent duplicate content setting
		const settingContent = useRef(false)

		const { updateProps, enhanceJsonContentBaseSwitchInstruction, clearSessionInstructConfig } =
			ConversationBotDataService

		// Listen for text from guide page
		useEffect(() => {
			const disposer = autorun(() => {
				if (ConversationStore.selectText && editorReady && !settingContent.current) {
					settingContent.current = true
					editorRef.current?.editor?.commands.setContent(ConversationStore.selectText, {
						emitUpdate: true,
					})
					ConversationStore.setSelectText("")
					settingContent.current = false
				}
			})
			return () => disposer()
		}, [editorReady])

		useMount(() => {
			if (value !== undefined && editorReady && !settingContent.current) {
				settingContent.current = true
				editorRef.current?.editor?.commands.setContent(value, { emitUpdate: true })
				// Remove auto focus on mount
				settingContent.current = false
			}
		})

		/** ============================== Reply Message =============================== */
		const referMessageId = ReplyStore.replyMessageId
		const handleReferMessageClick = useMemoizedFn(() => {
			if (referMessageId) {
				// FIXME: 滚动到引用消息
				MessageStore.setFocusMessageId(referMessageId)
			}
		})

		// Auto focus on input after selecting reply message
		useEffect(() => {
			return autorun(() => {
				if (ReplyStore.replyMessageId) {
					editorRef.current?.editor?.chain().focus().run()
				}
			})
		}, [])

		/** ============================== File Upload =============================== */
		const [files, setFilesRaw] = useState<FileData[]>([])
		const setFiles = useMemoizedFn((l: FileData[] | ((prev: FileData[]) => FileData[])) => {
			const list = typeof l === "function" ? l(files) : l
			setFilesRaw(list.slice(0, MAX_UPLOAD_COUNT))
			if (list.length > MAX_UPLOAD_COUNT) {
				magicToast.error(t("file.uploadLimit", { count: MAX_UPLOAD_COUNT }))
			}
			// Save draft
			writeCurrentDraft()
		})
		const { upload, uploading, reportFiles } = useUpload<FileData>({
			storageType: "private",
			onProgress(file, progress) {
				setFiles((l) => {
					const newFiles = [...l]
					const target = newFiles.find((f) => f.id === file.id)
					if (target) target.progress = progress
					return newFiles
				})
			},
			onSuccess(file, response) {
				setFiles((l) => {
					const newFiles = [...l]
					const target = newFiles.find((f) => f.id === file.id)
					if (target) {
						target.status = "done"
						target.result = response
					}
					return newFiles
				})
			},
			onFail(file, error) {
				setFiles((l) => {
					const newFiles = [...l]
					const target = newFiles.find((f) => f.id === file.id)
					if (target) {
						target.status = "error"
						target.error = error
					}
					return newFiles
				})
			},
			onInit(file, { cancel }) {
				setFiles((l) => {
					const newFiles = [...l]
					const target = newFiles.find((f) => f.id === file.id)
					if (target) {
						target.cancel = cancel
					}
					return newFiles
				})
			},
		})

		/** ========================== Send Message ========================== */
		const sending = useRef(false)
		const { run: onSend } = useThrottleFn(
			useMemoizedFn(
				async (
					jsonValue: JSONContent | undefined,
					onlyTextContent: boolean,
					isLongMessage = false,
				) => {
					try {
						if (sending.current) return
						sending.current = true

						// Upload files first
						const { fullfilled, rejected } = await upload(files)
						if (rejected.length > 0) {
							magicToast.error(t("file.uploadFail", { ns: "message" }))
							sending.current = false
							return
						}

						// Report files
						const reportRes =
							fullfilled.length > 0
								? await FileApi.reportFileUploads(
									fullfilled.map((d) => ({
										file_extension: d.value.name.split(".").pop() ?? "",
										file_key: d.value.key,
										file_size: d.value.size,
										file_name: d.value.name,
									})),
								)
								: []

						// Find all images and upload them
						const jsonContentImageTransformed = await transformJSONContent(
							jsonValue,
							(c) => c.type === Image.name,
							async (c) => {
								const src = c.attrs?.src
								if (src) {
									const blob = await fetch(src).then((res) => res.blob())
									const file = new File([blob], c.attrs?.file_name ?? "image", {
										type: blob.type,
									})

									const { fullfilled: f, rejected: r } = await upload([
										genFileData(file),
									])

									if (f.length > 0) {
										const file_extension = file.type.split("/").pop() ?? ""
										const res = await FileApi.reportFileUploads([
											{
												file_extension,
												file_key: f[0].value.key,
												file_size: f[0].value.size,
												file_name: f[0].value.name,
											},
										])
										if (c) {
											c.attrs = {
												...(c?.attrs ?? {}),
												src: "",
												file_id: res[0].file_id,
												file_extension,
												file_size: file.size,
												file_name: file.name,
											}
										}
									} else if (r.length > 0) {
										magicToast.error(t("file.uploadFail", { ns: "message" }))
										throw new Error("upload fail")
									}
								}
							},
						)

						console.log("jsonContentImageTransformed", jsonContentImageTransformed)

						const normalValue = generateRichText(
							JSON.stringify(jsonContentImageTransformed),
						)

						// Send message
						EditorService.send({
							jsonValue: jsonContentImageTransformed,
							normalValue,
							files: reportRes,
							onlyTextContent,
							isLongMessage,
						})

						if (clearAfterSend) {
							setIsEmpty(true)
							editorRef.current?.editor?.chain().clearContent().run()

							clearSessionInstructConfig()

							if (conversationId && topicId) {
								EditorDraftService.deleteDraft(conversationId, topicId)
							}

							MessageReplyService.reset()
							setFiles([])
							// Clear internal state
							setValue(undefined)
						}
					} catch (error) {
						console.error("onSend error", error)
					} finally {
						sending.current = false
					}
				},
			),
			{ wait: 200 },
		)

		updateProps({
			editorRef: editorRef.current,
			onSend,
		})

		/** ========================== Add Emoji ========================== */
		const onAddEmoji = useMemoizedFn((emoji: EmojiInfo) => {
			editorRef.current?.editor
				?.chain()
				.insertContent({
					type: MagicEmojiNodeExtension.name,
					attrs: { ...emoji, locale: language },
				})
				.run()
		})

		/** ========================== File Upload Related ========================== */
		const onFileChange = useMemoizedFn(async (fileList: FileList | File[]) => {
			// in mobile, make image as a normal file, so we don't need to handle images separately

			// const imageFiles: File[] = []
			const otherFiles: File[] = Array.from(fileList)

			// // Categorize files: images and others
			// for (let i = 0; i < fileList.length; i += 1) {
			// 	if (isValidImageFile(fileList[i])) {
			// 		imageFiles.push(fileList[i])
			// 	} else {
			// 		otherFiles.push(fileList[i])
			// 	}
			// }

			// // Process images and insert into editor
			// if (imageFiles.length > 0) {
			// 	const pos = editorRef.current?.editor?.state.selection.$from.pos ?? 0
			// 	await Promise.all(
			// 		imageFiles.map(async (file) => {
			// 			const file_extension = file.type.split("/").pop() ?? ""
			// 			const src = await fileToBase64(file)

			// 			editorRef.current?.editor?.commands.insertContentAt(pos, {
			// 				type: Image.name,
			// 				attrs: {
			// 					src,
			// 					file_name: file.name,
			// 					file_size: file.size,
			// 					file_extension,
			// 				},
			// 			})
			// 		}),
			// 	)
			// 	editorRef.current?.editor?.commands.focus(pos + imageFiles.length)
			// }

			// Process other files
			if (otherFiles.length > 0) {
				setFiles((l) => [...l, ...otherFiles.map(genFileData)])
			}
		})

		const uploadButton = useMemo(
			() => (
				<UploadAction
					handler={(onUpload) => {
						return (
							<FlexBox
								align="center"
								gap={4}
								className={styles.actionButton}
								onClick={onUpload}
							>
								<MagicIcon
									color={magicColorScales.orange[5]}
									size={16}
									component={IconFileSearch}
								/>
								{t("chat.messageEditor.file", { ns: "interface" })}
							</FlexBox>
						)
					}}
					onFileChange={onFileChange}
					multiple
				/>
			),
			[magicColorScales.orange, onFileChange, styles.actionButton, t],
		)

		const onCreateTopic = useMemoizedFn(() => {
			startPageStore.closeStartPage()
			TopicService.createTopic?.()
		})

		const newTopicButton = useMemo(
			() => (
				<FlexBox
					align="center"
					gap={4}
					className={styles.actionButton}
					onClick={onCreateTopic}
				>
					<MagicIcon
						color={magicColorScales.green[5]}
						size={16}
						component={IconMessagePlus}
					/>
					{t("chat.messageEditor.startNewTopic", { ns: "interface" })}
				</FlexBox>
			),
			[magicColorScales.green, onCreateTopic, styles.actionButton, t],
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
			() => null,
			// <FlexBox
			// 	align="center"
			// 	gap={4}
			// 	className={styles.actionButton}
			// 	onClick={onCreateTopic}
			// >
			// 	<MagicIcon
			// 		component={IconClockPlay}
			// 		size={16}
			// 		color={magicColorScales.pink[5]}
			// 	/>
			// 	{t("chat.timedTask.title")}
			// </FlexBox>
			[],
		)

		const [openTopicPanel, { setTrue: openTopicPanelTrue, setFalse: openTopicPanelFalse }] =
			useBoolean(false)
		const TopicButton = useMemo(() => {
			if (isAiConversation) {
				return (
					<>
						<FlexBox
							align="center"
							gap={4}
							className={styles.actionButton}
							onClick={openTopicPanelTrue}
						>
							<MagicIcon
								color={magicColorScales.brand[5]}
								size={16}
								component={IconMessageTopic}
							/>
							{t("chat.messageEditor.topic", { ns: "interface" })}
						</FlexBox>
						<AiTopicPopup open={openTopicPanel} onClose={openTopicPanelFalse} />
					</>
				)
			}
			return null
		}, [
			isAiConversation,
			magicColorScales.brand,
			openTopicPanel,
			openTopicPanelFalse,
			openTopicPanelTrue,
			styles.actionButton,
			t,
		])

		/** ========================== Button Group ========================== */
		const buttons = useMemo(() => {
			if (isAiConversation) {
				return (
					<Flex
						align="center"
						gap={4}
						className={cx(standardStyles.buttonGroups, "button-groups-wrapper")}
					>
						{TopicButton}
						<InstructionActions
							noStyle
							position={InstructionGroupType.TOOL}
							className={styles.actionButton}
							systemButtons={{
								[SystemInstructType.FILE]: uploadButton,
								[SystemInstructType.TOPIC]: newTopicButton,
								[SystemInstructType.TASK]: timedTaskButton,
								[SystemInstructType.RECORD]: recordingSummaryButton,
							}}
						/>
						<InstructionActions
							noStyle
							position={InstructionGroupType.DIALOG}
							className={styles.actionButton}
						/>
					</Flex>
				)
			}
			return (
				<Flex
					align="center"
					gap={4}
					className={cx(standardStyles.buttonGroups, "button-groups-wrapper")}
				>
					{uploadButton}
				</Flex>
			)
		}, [
			isAiConversation,
			cx,
			standardStyles.buttonGroups,
			uploadButton,
			TopicButton,
			styles.actionButton,
			newTopicButton,
			timedTaskButton,
		])

		const referMessage = useMemo(() => {
			if (!referMessageId) return null
			return (
				<Flex
					align="center"
					justify="space-between"
					gap={10}
					className={standardStyles.referMessageSection}
				>
					<MessageRefer
						isSelf={false}
						className={standardStyles.referMessage}
						onClick={handleReferMessageClick}
					/>
					<MagicButton
						type="text"
						icon={<MagicIcon size={20} component={IconCircleX} />}
						onClick={MessageReplyService.reset}
					/>
				</Flex>
			)
		}, [
			referMessageId,
			standardStyles.referMessageSection,
			standardStyles.referMessage,
			handleReferMessageClick,
		])

		/** ========================== Draft ========================== */

		const { run: writeCurrentDraft } = useDebounceFn(
			() => {
				if (conversationId) {
					EditorDraftService.writeDraft(conversationId, topicId ?? "", {
						content: editorRef.current?.editor?.getJSON() ?? {},
						files: files.map((file) => omit(file, ["error", "cancel"])),
					})
				}
			},
			{ wait: 1000 },
		)

		/** Save and read drafts when switching conversations or topics */
		useEffect(() => {
			if (conversationId && editorReady && !settingContent.current) {
				settingContent.current = true
				// Save draft
				if (
					EditorStore.lastConversationId !== conversationId ||
					EditorStore.lastTopicId !== topicId
				) {
					EditorDraftService.writeDraft(
						EditorStore.lastConversationId,
						EditorStore.lastTopicId ?? "",
						{
							content: editorRef.current?.editor?.getJSON(),
							files,
						},
					)
				}
				// Read draft
				if (EditorDraftStore.hasDraft(conversationId, topicId ?? "")) {
					const draft = EditorDraftStore.getDraft(conversationId, topicId ?? "")
					editorRef.current?.editor?.commands.setContent(draft?.content ?? "", {
						emitUpdate: true,
					})
					// Set internal state
					setValue(draft?.content)
					setFiles(draft?.files ?? [])
					const text = editorRef.current?.editor?.getText()
					setIsEmpty(!text)
				} else {
					editorRef.current?.editor?.chain().clearContent().run()
					setIsEmpty(true)
					// Reset internal state
					setValue(undefined)
					setFiles([])
				}

				settingContent.current = false
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [conversationId, topicId, setIsEmpty, editorReady])

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
				/** 快捷指令 */
				QuickInstructionExtension,
			] as Extension[]

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
				onCreate: ({ editor: e }) => {
					setEditorReady(true)
					// 监听编辑器焦点事件，实现即时响应键盘状态
					if (isMobile && isIos) {
						const editorElement = e.view.dom as HTMLElement
						if (editorElement) {
							const handleFocus = () => {
								setIsKeyboardVisible(true)
							}
							const handleBlur = () => {
								// 立即设置键盘为不可见，不需要延迟
								setIsKeyboardVisible(false)
							}
							editorElement.addEventListener("focus", handleFocus, true)
							editorElement.addEventListener("blur", handleBlur, true)
							// 清理函数会在编辑器销毁时调用
							e.on("destroy", () => {
								editorElement.removeEventListener("focus", handleFocus, true)
								editorElement.removeEventListener("blur", handleBlur, true)
							})
						}
					}
				},
				extensions,
				enableContentCheck: false, // Disable built-in content check, we handle it ourselves
			}
		}, [openAiCompletion, isValidContent, value, setValue, writeCurrentDraft, isMobile])

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

		const handleSend = useMemoizedFn(async () => {
			if (!sendDisabled) {
				const { json, onlyText } = getEditorJSON()

				const normalValue = generateRichText(JSON.stringify(json))

				if (MessageService.isTextSizeOverLimit(JSON.stringify(normalValue))) {
					// Long text message
					return new Promise((resolve) => {
						MagicModal.confirm({
							title: t("chat.messageEditor.longMessageConfirm.title", {
								ns: "interface",
							}),
							content: t("chat.messageEditor.longMessageConfirm.content", {
								ns: "interface",
							}),
							okText: t("chat.messageEditor.longMessageConfirm.okText", {
								ns: "interface",
							}),
							onOk: async () => {
								await onSend?.(json, onlyText, true)
								resolve(true)
							},
							onCancel: () => {
								resolve(false)
							},
						})
					})
				}

				await onSend?.(json, onlyText)
			}
		})

		/** ========================== Enter to Send ========================== */
		useKeyPress(
			"Enter",
			() => {
				console.log("press key enter =======> ")
				if (sendWhenEnter) {
					handleSend()
				}
			},
			{
				exactMatch: true,
			},
		)

		const onClick = useMemoizedFn(() => {
			const editor = editorRef.current?.editor
			if (!editor) return

			editor.chain().focus().run()
			console.log("click", editor)
			if (MobileEditorStore.emojiPanelOpen) {
				MobileEditorStore.closeEmojiPanel()
			}

			// iOS 特定处理：确保输入框滚动到键盘顶部
			if (isMobile && isIos) {
				// 延迟滚动以等待键盘动画完成
				setTimeout(() => {
					const editorElement = editor.view.dom as HTMLElement
					if (editorElement) {
						const rect = editorElement.getBoundingClientRect()
						const viewHeight =
							window.innerHeight || document.documentElement.clientHeight

						// 检查输入框是否在视口下半部分（可能被键盘遮挡）
						if (rect.bottom > viewHeight * 0.5) {
							// 使用 TipTap 的 scrollIntoView 命令以获得更好的兼容性
							editor.chain().scrollIntoView().run()

							// 回退方案：如果 TipTap 命令不起作用，尝试使用原生 scrollIntoView
							requestAnimationFrame(() => {
								const updatedRect = editorElement.getBoundingClientRect()
								if (updatedRect.bottom > viewHeight * 0.5) {
									editorElement.scrollIntoView({
										behavior: "smooth",
										block: "center",
									})
								}
							})
						}
					}
				}, 300) // 延迟等待 iOS 键盘动画完成（通常需要 250-300ms）
			}
		})

		const handlePasteFileFail = useMemoizedFn((errors: FileError[]) => {
			const fileList: FileData[] = []
			errors.forEach((error) => {
				switch (error.reason) {
					case "size":
						magicToast.error(t("richEditor.fileTooLarge"))
						break
					case "invalidBase64":
						magicToast.error(t("richEditor.invalidBase64"))
						break
					case "type":
						if (error.file && error.file instanceof File) {
							fileList.push(genFileData(error.file as File))
						}
						break
					default:
						break
				}
			})

			if (!errors.length && fileList.length) {
				setFiles((prev) => [...prev, ...fileList])
			}
		})

		return (
			<div
				style={style}
				className={cx(className, styles.root, {
					[styles.keyboardVisible]: isKeyboardVisible,
				})}
				ref={containerRef}
			>
				{referMessage}
				<FlexBox vertical gap={10} className={styles.container}>
					{/* Function tabs */}
					<FlexBox align="center" gap={8} className={styles.tabsContainer}>
						{buttons}
					</FlexBox>

					<InputFiles
						files={files}
						wrap="nowrap"
						onFilesChange={setFiles}
						className={cx(styles.inputFilesContainer, "input-files-container-wrapper")}
					/>

					<AiAutoCompleteConfirm
						originalText={editorRef.current?.editor?.getText() ?? ""}
						suggestedText={AiCompletionStore.suggestion}
						onAccept={() => {
							AiCompletionService.insertSuggestion({
								editor: editorRef.current?.editor,
								suggestionText: AiCompletionStore.suggestion,
							})
						}}
					/>

					{/* Input area */}
					<FlexBox align="center" className={styles.inputContainer}>
						{/* Voice button */}
						<MagicIcon
							className={cx(styles.footerButton, styles.voiceButton)}
							component={
								voiceInputVisible ? IconCircleKeyboard : IconCircleMicrophone
							}
							size={28}
							color="currentColor"
							onClick={toggleVoiceInputVisible}
						/>

						<VoiceInput
							className={cx(styles.voiceInput, {
								visible: voiceInputVisible,
							})}
							onTextResult={(text) => {
								onSend?.(
									{
										type: "paragraph",
										content: [{ type: "text", text }],
									},
									true,
								)
							}}
							onVoiceResult={async (audioData, duration, actualMimeType) => {
								console.log("onVoiceResult", {
									audioSize: audioData?.size,
									duration,
									actualMimeType,
								})
								try {
									if (!audioData) {
										magicToast.error(t("file.uploadFail", { ns: "message" }))
										return
									}

									// Validate audio file size using actual MIME type
									if (
										!validateAudioFileSizeByType(audioData, 10, actualMimeType)
									) {
										magicToast.error(t("file.fileTooLarge", { size: "10MB" }))
										return
									}

									// Convert blob to appropriate audio file format based on actual type
									const filename = generateAudioFilename("voice_message")
									const audioFile = await convertBlobToAudioFile(
										audioData,
										filename,
										actualMimeType,
									)

									// Use provided duration or calculate from audio data
									const audioDuration =
										duration || (await getAudioDuration(audioData))

									// Upload the audio file
									const { fullfilled, rejected } = await upload([
										genFileData(audioFile),
									])

									if (rejected.length > 0) {
										magicToast.error(t("file.uploadFail", { ns: "message" }))
										return
									}

									// Report the uploaded file
									// Extract actual file extension from the audio file name
									const fileExtension = audioFile.name.split(".").pop() || "m4a"

									const reportRes = await reportFiles([
										{
											file_extension: fileExtension,
											file_key: fullfilled[0].value.key,
											file_size: fullfilled[0].value.size,
											file_name: fullfilled[0].value.name,
										},
									])

									// Send voice message
									if (conversationId) {
										MessageService.sendVoiceMessage(
											conversationId,
											reportRes.map((file) => ({
												file_id: file.file_id,
												file_name: file.file_name,
												file_size: file.file_size,
												file_extension: file.file_extension,
												file_type: 7,
											})),
											Math.round(audioDuration),
											ReplyStore.replyMessageId,
										)

										// Clear reply message after sending
										MessageReplyService.reset()
									}
								} catch (error) {
									console.error("Error sending voice message:", error)
									magicToast.error(t("file.uploadFail", { ns: "message" }))
								}
							}}
							onError={(error) => {
								if (error.message) {
									magicToast.error(error.message)
								}
							}}
						/>

						{/* Text input */}
						<div
							className={cx(styles.textInputWrapper, {
								visible: !voiceInputVisible,
							})}
						>
							<MagicRichEditor
								ref={editorRef}
								placeholder={dynamicPlaceholder}
								showToolBar={false}
								onClick={onClick}
								className={cx(styles.textInput)}
								onCompositionStart={AiCompletionService.onCompositionStart}
								onCompositionEnd={AiCompletionService.onCompositionEnd}
								editorProps={editorProps}
								enterBreak={sendWhenEnter}
								autofocus={false}
								onPasteFileFail={handlePasteFileFail}
							/>
						</div>

						{/* Action buttons */}
						<FlexBox align="center" gap={2} className={styles.footerButtons}>
							<MagicIcon
								className={styles.footerButton}
								component={IconMoodSmile}
								size={28}
								color={
									MobileEditorStore.emojiPanelOpen
										? magicColorScales.brand[5]
										: "currentColor"
								}
								onClick={MobileEditorStore.toggleEmojiPanel}
							/>
							{/* <MagicIcon
								className={styles.footerButton}
								component={IconCirclePlus}
								size={28}
							/> */}
							{!sendDisabled && (
								<MagicButton
									size="small"
									type="primary"
									className={styles.sendButton}
									onClick={handleSend}
								>
									{t("send")}
								</MagicButton>
							)}
						</FlexBox>
					</FlexBox>
				</FlexBox>
				<EmojiPanel
					open={MobileEditorStore.emojiPanelOpen}
					onAddEmoji={onAddEmoji}
					onClose={MobileEditorStore.closeEmojiPanel}
				/>
			</div>
		)
	},
)

export default MessageEditor
