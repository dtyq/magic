import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import {
	createFileReferenceMention,
	type FileReferenceSource,
} from "@/components/business/MentionPanel/utils/fileReferenceMention"
import { getFileReferenceIdentityKey } from "@/pages/superMagic/services/userFileReferenceResolver"
import topicStore from "@/pages/superMagic/stores/core/topic"
import magicToast from "@/components/base/MagicToaster/utils"
import { useMemo, useCallback, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
	IconBrowserCheck,
	IconInputCheck,
	IconLayoutRows,
	IconLanguage,
	IconFileTextSpark,
} from "@tabler/icons-react"
import { Crosshair } from "lucide-react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ensureFileSavesSynced } from "../../../services/fileSaveQueue"

interface AIEditItem {
	key: string
	label: string
	icon: React.ReactNode
	onClick: () => void
	description: string
}

interface UseAIEditOptions {
	currentFile?: FileReferenceSource
	onActionComplete?: () => void
	/** Trigger element inspector (HTML-only). When provided, a "Select Element" item is shown. */
	onStartInspector?: () => void
}

export function useAIEdit(options: UseAIEditOptions = {}) {
	const { currentFile, onActionComplete, onStartInspector } = options
	const { t } = useTranslation("super")

	const currentFileRef = useRef(currentFile)
	currentFileRef.current = currentFile
	const requestRef = useRef<AbortController | null>(null)
	useEffect(() => () => requestRef.current?.abort(), [currentFile?.file_id])

	// 引用解析期间切换文件、身份或对话时，不向新的输入框插入旧文件。
	const insertContentToChat = useCallback(
		async (content: JSONContent[], extraData?: { hasInput?: boolean }) => {
			if (!currentFile) return
			if (currentFile.file_id && !(await ensureFileSavesSynced([currentFile.file_id]))) return
			const topicId = topicStore.selectedTopic?.id
			const identity = getFileReferenceIdentityKey()
			const isUserFile =
				currentFile.file_reference?.space_type === "user" ||
				currentFile.space_type === "user"
			if (isUserFile && !topicId) {
				magicToast.info(t("userSpace.openChatFirst"))
				return
			}
			requestRef.current?.abort()
			const controller = new AbortController()
			requestRef.current = controller
			const isCurrent = () =>
				!controller.signal.aborted &&
				currentFileRef.current?.file_id === currentFile.file_id &&
				identity === getFileReferenceIdentityKey() &&
				topicId === topicStore.selectedTopic?.id
			try {
				const mention = await createFileReferenceMention(
					currentFile,
					undefined,
					controller.signal,
				)
				if (!isCurrent()) return
				if (!mention) {
					magicToast.error(t("common.fileNotFoundOrLoadFailed"))
					return
				}
				pubsub.publish(PubSubEvents.Add_Content_To_Chat, {
					content: {
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{ type: "text", text: t("topicFiles.fileReadPrompt") },
									{
										type: "mention",
										attrs: {
											id: null,
											label: null,
											mentionSuggestionChar: "@",
											...mention,
										},
									},
									{ type: "text", text: t("topicFiles.fileReadContentPrompt") },
									...content,
								],
							},
						],
					},
					extraData: { hasInput: extraData?.hasInput },
				})
				onActionComplete?.()
			} catch {
				if (isCurrent()) magicToast.error(t("common.fileNotFoundOrLoadFailed"))
			}
		},
		[currentFile, onActionComplete, t],
	)

	// Create action wrapper
	const createAction = useCallback(
		(action: () => void) => {
			return () => {
				action()
				onActionComplete?.()
			}
		},
		[onActionComplete],
	)

	// AI Edit items configuration
	const aiEditItems: AIEditItem[] = useMemo(
		() => [
			{
				key: "factCheck",
				label: t("topicFiles.factCheck", "事实核查"),
				icon: <IconBrowserCheck size={16} stroke={1.5} />,
				onClick: createAction(() => {
					insertContentToChat([
						{
							type: "text",
							text: t("topicFiles.fileFactCheckPrompt"),
						},
					])
				}),
				description: t("topicFiles.factCheckDescription"),
			},
			{
				key: "contentTranslation",
				label: t("topicFiles.contentTranslation", "内容翻译"),
				icon: <IconLanguage size={16} stroke={1.5} />,
				onClick: createAction(() => {
					insertContentToChat(
						[
							{
								type: "text",
								text: t("topicFiles.fileContentTranslationPrompt"),
							},
							{
								type: "super-placeholder",
								attrs: {
									type: "input",
									props: {
										placeholder: t("topicFiles.contentTranslationPlaceholder"),
										defaultValue: "",
										value: "",
									},
									_direction: null,
								},
							},
						],
						{ hasInput: true },
					)
				}),
				description: t("topicFiles.contentTranslationDescription"),
			},
			{
				key: "dataCorrection",
				label: t("topicFiles.dataCorrection", "数据纠正"),
				icon: <IconInputCheck size={16} stroke={1.5} />,
				onClick: createAction(() => {
					insertContentToChat([
						{
							type: "text",
							text: t("topicFiles.fileDataCorrectionPrompt"),
						},
					])
				}),
				description: t("topicFiles.dataCorrectionDescription"),
			},
			{
				key: "layoutCorrection",
				label: t("topicFiles.layoutCorrection", "修正布局"),
				icon: <IconLayoutRows size={16} stroke={1.5} />,
				onClick: createAction(() => {
					insertContentToChat(
						[
							{
								type: "text",
								text: t("topicFiles.fileLayoutCorrectionPrompt"),
							},
							{
								type: "super-placeholder",
								attrs: {
									type: "input",
									props: {
										placeholder: t("topicFiles.questPlaceholder"),
										defaultValue: "",
										value: "",
									},
								},
							},
						],
						{ hasInput: true },
					)
				}),
				description: t("topicFiles.layoutCorrectionDescription"),
			},
			{
				key: "custom",
				label: t("topicFiles.custom", "自定义"),
				icon: <IconFileTextSpark size={16} stroke={1.5} />,
				onClick: createAction(() => {
					insertContentToChat(
						[
							{
								type: "super-placeholder",
								attrs: {
									type: "input",
									props: {
										placeholder: t("topicFiles.customPlaceholder"),
										defaultValue: "",
										value: "",
									},
								},
							},
						],
						{ hasInput: true },
					)
				}),
				description: t("topicFiles.customDescription"),
			},
			...(onStartInspector
				? [
						{
							key: "selectElement",
							label: t("topicFiles.selectElement", "选取元素进行编辑"),
							icon: <Crosshair size={16} />,
							onClick: createAction(() => {
								onStartInspector()
							}),
							description: t(
								"topicFiles.selectElementDescription",
								"点击选取页面中的元素，将其样式信息自动填入到对话框",
							),
						} satisfies AIEditItem,
					]
				: []),
		],
		[t, createAction, insertContentToChat, onStartInspector],
	)

	return {
		aiEditItems,
		insertContentToChat,
	}
}
