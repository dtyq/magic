import { Flex, message } from "antd"
import { useTranslation } from "react-i18next"
import { IconSend, IconCircleX, IconMessage2Plus } from "@tabler/icons-react"
import MagicButton from "@/opensource/components/base/MagicButton"
import { useMemo, useRef, useState, useEffect } from "react"
import type { HTMLAttributes } from "react"
import { useThrottleFn, useKeyPress, useMemoizedFn, useMount, useDebounceFn } from "ahooks"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import type { JSONContent, UseEditorOptions } from "@tiptap/react"
import { cloneDeep, omit } from "lodash-es"
import type { ReportFileUploadsResponse } from "@/opensource/apis/modules/file"
import { InstructionGroupType, SystemInstructType } from "@/types/bot"
import MagicEmojiNodeExtension from "@/opensource/components/base/MagicRichEditor/extensions/magicEmoji"
import {
	FileError,
	fileToBase64,
	isOnlyText,
	transformJSONContent,
} from "@/opensource/components/base/MagicRichEditor/utils"
import { Image } from "@/opensource/components/base/MagicRichEditor/extensions/image"
import { observer } from "mobx-react-lite"
import type { MagicRichEditorRef } from "@/opensource/components/base/MagicRichEditor"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicRichEditor from "@/opensource/components/base/MagicRichEditor"
import type { EmojiInfo } from "@/opensource/components/base/MagicEmojiPanel/types"
import { useGlobalLanguage } from "@/opensource/models/config/hooks"
import TopicService from "@/opensource/services/chat/topic/class"
import { IMStyle, useAppearanceStore } from "@/opensource/providers/AppearanceProvider/context"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import { interfaceStore } from "@/opensource/stores/interface"
import ReplyStore from "@/opensource/stores/chatNew/messageUI/Reply"
import MessageReplyService from "@/opensource/services/chat/message/MessageReplyService"
import EditorDraftService from "@/opensource/services/chat/editor/DraftService"
import EditorDraftStore from "@/opensource/stores/chatNew/editorDraft"
import EditorStore from "@/opensource/stores/chatNew/messageUI/editor"
import { isWindows } from "@/utils/devices"
import ConversationBotDataService from "@/opensource/services/chat/conversation/ConversationBotDataService"
import { autorun, toJS } from "mobx"
import type { FileData } from "./components/InputFiles/types"
import InputFiles from "./components/InputFiles"
import UploadButton from "./components/UploadButton"
import EmojiButton from "./components/EmojiButton"
import { genFileData } from "./components/InputFiles/utils"
import MagicInputLayout from "./components/MagicInputLayout"
import useInputStyles from "./hooks/useInputStyles"
// import useRecordingSummary from "./hooks/useRecordingSummary"
import TimedTaskButton from "./components/TimedTaskButton"
import InstructionActions from "../quick-instruction"
import QuickInstructionExtension from "../quick-instruction/extension"
import MessageRefer from "../ChatMessageList/components/ReferMessage"
import { generateRichText } from "../ChatSubSider/utils"
import { FileApi } from "@/apis"
import MessageStore from "@/opensource/stores/chatNew/message"
import MagicModal from "@/opensource/components/base/MagicModal"
import MessageService from "@/opensource/services/chat/message/MessageService"
import EditorService from "@/opensource/services/chat/editor/EditorService"
import AiCompletionService from "@/opensource/services/chat/editor/AiCompletionService"
import AiCompletionTip from "./components/AiCompletionTip"

export interface SendData {
	jsonValue: JSONContent | undefined
	normalValue: string
	files: ReportFileUploadsResponse[]
	onlyTextContent: boolean
	isLongMessage?: boolean
}

const MAX_UPLOAD_COUNT = 20

export interface MagicInputProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue"> {
	/** 底层编辑器 Tiptap 配置 */
	tiptapProps?: UseEditorOptions
	/** 是否可见 */
	visible?: boolean
	/** 是否禁用 */
	disabled?: boolean
	/** 主题 */
	theme?: IMStyle
	/** 回车发送 */
	sendWhenEnter?: boolean
	/** 发送后是否清空 */
	clearAfterSend?: boolean
	/** 占位符 */
	placeholder?: string
	/** 输入框样式 */
	inputMainClassName?: string
}

const MessageEditor = observer(function MessageEditor({
	disabled = false,
	tiptapProps,
	visible = true,
	theme = IMStyle.Standard,
	placeholder,
	sendWhenEnter = true,
	clearAfterSend = true,
	className,
	inputMainClassName,
	...rest
}: MagicInputProps) {
	/** Translation */
	const { t } = useTranslation("interface")
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

	// 编辑器是否准备好
	const [editorReady, setEditorReady] = useState(false)
	// 防止重复设置内容
	const settingContent = useRef(false)

	const {
		updateProps,
		residencyContent,
		enhanceJsonContentBaseSwitchInstruction,
		clearSessionInstructConfig,
	} = ConversationBotDataService

	// 监听在引导页监听到的文本
	useEffect(() => {
		const disposer = autorun(() => {
			if (ConversationStore.selectText && editorReady && !settingContent.current) {
				settingContent.current = true
				editorRef.current?.editor?.commands.setContent(ConversationStore.selectText, true)
				editorRef.current?.editor?.commands.focus()
				ConversationStore.setSelectText("")
				settingContent.current = false
			}
		})
		return () => disposer()
	}, [editorReady])

	useMount(() => {
		if (value !== undefined && editorReady && !settingContent.current) {
			settingContent.current = true
			editorRef.current?.editor?.commands.setContent(value, true)
			editorRef.current?.editor?.commands.focus()
			settingContent.current = false
		}
	})

	/** ============================== 引用消息 =============================== */
	const referMessageId = ReplyStore.replyMessageId
	const handleReferMessageClick = useMemoizedFn(() => {
		if (referMessageId) {
			// FIXME: 滚动到引用消息
			MessageStore.setFocusMessageId(referMessageId)
		}
	})

	// 选择引用消息后, 自动聚焦到输入框
	useEffect(() => {
		return autorun(() => {
			if (ReplyStore.replyMessageId) {
				editorRef.current?.editor?.chain().focus().run()
			}
		})
	}, [])

	/** ============================== 文件上传 =============================== */
	const [files, setFilesRaw] = useState<FileData[]>([])
	const setFiles = useMemoizedFn((l: FileData[] | ((prev: FileData[]) => FileData[])) => {
		const list = typeof l === "function" ? l(files) : l
		setFilesRaw(list.slice(0, MAX_UPLOAD_COUNT))
		if (list.length > MAX_UPLOAD_COUNT) {
			message.error(t("file.uploadLimit", { count: MAX_UPLOAD_COUNT }))
		}
		// 写入草稿
		writeCurrentDraft()
	})
	const { upload, uploading } = useUpload<FileData>({
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

	/** ========================== 发送消息 ========================== */
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

					// 先上传文件
					const { fullfilled, rejected } = await upload(files)
					if (rejected.length > 0) {
						message.error(t("file.uploadFail", { ns: "message" }))
						sending.current = false
						return
					}

					// 上报文件
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

					// 找到所有的图片,进行上传
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
									message.error(t("file.uploadFail", { ns: "message" }))
									throw new Error("upload fail")
								}
							}
						},
					)

					console.log("jsonContentImageTransformed", jsonContentImageTransformed)

					const normalValue = generateRichText(
						JSON.stringify(jsonContentImageTransformed),
					)

					// 发送消息
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
						if (residencyContent.length > 0) {
							editorRef.current?.editor
								?.chain()
								.focus()
								.insertContent(cloneDeep(residencyContent))
								.run()
						}

						clearSessionInstructConfig()

						if (conversationId && topicId) {
							EditorDraftService.deleteDraft(conversationId, topicId)
						}

						MessageReplyService.reset()
						setFiles([])
						// 清空内部状态
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

	/** ========================== 添加表情 ========================== */
	const onAddEmoji = useMemoizedFn((emoji: EmojiInfo) => {
		editorRef.current?.editor
			?.chain()
			.focus()
			.insertContent({
				type: MagicEmojiNodeExtension.name,
				attrs: { ...emoji, locale: language },
			})
			.run()
	})

	/** ========================== 上传文件相关 ========================== */
	const onFileChange = useMemoizedFn(async (fileList: FileList | File[]) => {
		const imageFiles: File[] = []
		const otherFiles: File[] = []

		// 文件先分类: 图片和其他
		for (let i = 0; i < fileList.length; i += 1) {
			if (fileList[i].type.includes("image") && fileList[i].type !== "image/svg+xml") {
				imageFiles.push(fileList[i])
			} else {
				otherFiles.push(fileList[i])
			}
		}

		// 处理图片,插入到输入框
		if (imageFiles.length > 0) {
			const pos = editorRef.current?.editor?.state.selection.$from.pos ?? 0
			await Promise.all(
				imageFiles.map(async (file) => {
					const file_extension = file.type.split("/").pop() ?? ""
					const src = await fileToBase64(file)

					editorRef.current?.editor?.commands.insertContentAt(pos, {
						type: Image.name,
						attrs: {
							src,
							file_name: file.name,
							file_size: file.size,
							file_extension,
						},
					})
				}),
			)
			editorRef.current?.editor?.commands.focus(pos + imageFiles.length)
		}

		// 处理其他文件
		if (otherFiles.length > 0) {
			setFiles((l) => [...l, ...otherFiles.map(genFileData)])
		}
		editorRef.current?.editor?.chain().focus().run()
	})

	const footerInstructionsNode = useMemo(() => {
		if (!isAiConversation) return null
		return <InstructionActions position={InstructionGroupType.DIALOG} />
	}, [isAiConversation])

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

	const isShowStartPage = interfaceStore.isShowStartPage
	const onCreateTopic = useMemoizedFn(() => {
		if (isShowStartPage) interfaceStore.closeStartPage()
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

	/** ========================== 按钮组 ========================== */
	const buttons = useMemo(() => {
		if (isAiConversation) {
			return (
				<Flex align="center" justify="space-between">
					<Flex align="center" gap={4} className={standardStyles.buttonGroups}>
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
					</Flex>
				</Flex>
			)
		}
		return (
			<Flex align="center" gap={4} className={standardStyles.buttonGroups}>
				{emojiButton}
				{uploadButton}
			</Flex>
		)
	}, [
		isAiConversation,
		standardStyles.buttonGroups,
		emojiButton,
		uploadButton,
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

	/** ========================== 草稿 ========================== */

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

	/** 切换会话或者话题时, 保存和读取草稿 */
	useEffect(() => {
		if (conversationId && editorReady && !settingContent.current) {
			settingContent.current = true
			// 保存草稿
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
			// 读取草稿
			if (EditorDraftStore.hasDraft(conversationId, topicId ?? "")) {
				const draft = EditorDraftStore.getDraft(conversationId, topicId ?? "")
				editorRef.current?.editor?.commands.setContent(draft?.content ?? "", true)
				console.log("draft", toJS(draft))
				// 设置内部状态
				setValue(draft?.content)
				setFiles(draft?.files ?? [])
				const text = editorRef.current?.editor?.getText()
				setIsEmpty(!text)
			} else {
				editorRef.current?.editor?.chain().clearContent().run()
				setIsEmpty(true)
				// 重置内部状态
				setValue(undefined)
				setFiles([])
			}

			settingContent.current = false
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [conversationId, topicId, setIsEmpty, editorReady])

	/** ========================== AI 自动补全 ========================== */
	if (editorRef.current) {
		AiCompletionService.setInstance(editorRef.current)
	}
	useEffect(() => {
		if (isEmpty) {
			AiCompletionService.clearSuggestion()
		}
	}, [isEmpty])

	const openAiCompletion = useAppearanceStore((state) => state.aiCompletion)
	/** ========================== 编辑器配置 ========================== */
	const editorProps = useMemo<UseEditorOptions>(() => {
		const extensions = [
			/** 快捷指令 */
			QuickInstructionExtension,
			/** 其他扩展 */
			...(tiptapProps?.extensions ?? []),
		]

		if (openAiCompletion) {
			extensions.unshift(AiCompletionService.getExtension())
		}

		// Tiptap的默认空内容结构（doc with paragraph）
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
					// 获取编辑器JSON
					const json = e?.getJSON()
					const text = e?.getText() ?? ""

					// 确保json有效才更新状态
					if (json && typeof json === "object" && "type" in json) {
						// 更新内部状态
						setValue?.(json)
						// 写入草稿
						writeCurrentDraft()
						// 设置空状态
						setIsEmpty(!text)
					}
				} catch (error) {
					console.error("Error updating editor content:", error)
				}
			},
			onTransaction: () => {
				// 处理输入事件，不触发重渲染
			},
			onCreate: () => {
				setEditorReady(true)
			},
			extensions,
			enableContentCheck: false, // 关闭内置内容检查，我们自己处理
			...omit(tiptapProps, ["extensions", "onContentError"]),
		}
	}, [tiptapProps, openAiCompletion, isValidContent, value, setValue, writeCurrentDraft])

	const getEditorJSON = useMemoizedFn(() => {
		try {
			const editorJson = editorRef.current?.editor?.getJSON()
			// 确保json有效
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

	/** ========================== 发送按钮 ========================== */
	const sendDisabled = (isEmpty && !files.length) || uploading

	const handleSend = useMemoizedFn(async () => {
		if (!sendDisabled) {
			const { json, onlyText } = getEditorJSON()

			const normalValue = generateRichText(JSON.stringify(json))

			if (MessageService.isTextSizeOverLimit(JSON.stringify(normalValue))) {
				// 超长文本
				return new Promise((resolve) => {
					MagicModal.confirm({
						title: "提示",
						content: "发送的内存超长，是否转为文档发送到当前会话？",
						okText: "确定",
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

	/** ========================== 回车发送 ========================== */
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

	const Footer = useMemo(
		() => (
			<Flex align="center" justify="flex-end" gap={10}>
				<Flex flex={1} align="center" justify="flex-start">
					{footerInstructionsNode}
				</Flex>
				<span className={standardStyles.tip}>
					{isWindows ? t("placeholder.magicInputWindows") : t("placeholder.magicInput")}
				</span>
				<MagicButton
					type="primary"
					size="large"
					disabled={sendDisabled}
					className={modernStyles.sendButton}
					icon={<MagicIcon color="currentColor" component={IconSend} />}
					onClick={handleSend}
				>
					{t("send")}
				</MagicButton>
			</Flex>
		),
		[
			footerInstructionsNode,
			handleSend,
			modernStyles.sendButton,
			sendDisabled,
			standardStyles.tip,
			t,
		],
	)

	const onClick = useMemoizedFn(() => editorRef.current?.editor?.chain().focus().run())

	const handlePasteFileFail = useMemoizedFn((errors: FileError[]) => {
		const fileList: FileData[] = []
		errors.forEach((error) => {
			switch (error.reason) {
				case "size":
					message.error(t("richEditor.fileTooLarge"))
					break
				case "invalidBase64":
					message.error(t("richEditor.invalidBase64"))
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

		if (fileList.length) {
			setFiles((prev) => [...prev, ...fileList])
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

	const onDrop = useMemoizedFn((e) => {
		e.stopPropagation()
		e.preventDefault()
		onFileChange(e.dataTransfer.files)
	})

	const onDragOver = useMemoizedFn((e) => {
		e.stopPropagation()
		e.preventDefault()
	})

	if (!visible) return null

	return (
		<MagicInputLayout
			theme={theme}
			extra={referMessage}
			buttons={
				<>
					{buttons}
					<InputFiles files={files} onFilesChange={setFiles} />
				</>
			}
			footer={Footer}
			className={className}
			inputMainClassName={inputMainClassName}
			onDrop={onDrop}
			onDragOver={onDragOver}
			{...omit(rest, ["onContentChange"])}
		>
			{ChildrenRender}
		</MagicInputLayout>
	)
})

export default MessageEditor
