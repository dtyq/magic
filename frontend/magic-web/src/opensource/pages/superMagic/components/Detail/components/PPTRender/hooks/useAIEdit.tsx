import { useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
	IconBrowserCheck,
	IconInputCheck,
	IconLayoutRows,
	IconLanguage,
	IconFileTextSpark,
} from "@tabler/icons-react"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"

interface AIEditItem {
	key: string
	label: string
	icon: React.ReactNode
	onClick: () => void
	description: string
}

interface UseAIEditOptions {
	currentFile?: {
		file_id?: string
		file_name?: string
		relative_file_path?: string
		file_extension?: string
	}
	onActionComplete?: () => void
}

export function useAIEdit(options: UseAIEditOptions = {}) {
	const { currentFile, onActionComplete } = options
	const { t } = useTranslation("super")

	// Base content structure for file mention
	const baseContent = useMemo(() => {
		if (!currentFile) return null

		return {
			type: "paragraph",
			content: [
				{
					type: "text",
					text: t("topicFiles.fileReadPrompt"),
				},
				{
					type: "mention",
					attrs: {
						id: null,
						label: null,
						mentionSuggestionChar: "@",
						type: "project_file",
						data: {
							file_id: currentFile.file_id,
							file_name: currentFile.file_name,
							file_path: currentFile.relative_file_path,
							file_extension: currentFile.file_extension,
						},
					},
				},
				{
					type: "text",
					text: t("topicFiles.fileReadContentPrompt"),
				},
			],
		}
	}, [currentFile, t])

	// Insert content to chat
	const insertContentToChat = useCallback(
		(content: any, extraData?: any) => {
			if (!baseContent) return

			const { hasInput } = extraData || {}
			pubsub.publish(PubSubEvents.Add_Content_To_Chat, {
				content: {
					type: "doc",
					content: [
						{
							...baseContent,
							content: [...baseContent.content, ...content],
						},
					],
				},
				extraData: {
					hasInput,
				},
			})

			onActionComplete?.()
		},
		[baseContent, onActionComplete],
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
		],
		[t, createAction, insertContentToChat],
	)

	return {
		aiEditItems,
		insertContentToChat,
	}
}
