import { useMemoizedFn } from "ahooks"
import type { MutableRefObject, RefObject } from "react"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { VoiceInputRef } from "@/components/business/VoiceInput"
import magicToast from "@/components/base/MagicToaster/utils"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { logger as Logger } from "@/utils/log"
import { replaceSuperPlaceholderToString } from "../extensions/super-placeholder/utils"
import type { MessageEditorStore } from "../stores"
import { ModelStatusEnum, type MessageEditorProps } from "../types"
import { isEmptyJSONContent } from "../utils"

const logger = Logger.createLogger("SuperMagicMessageEditor")

interface UseMessageSendHandlerParams {
	voiceInputRef: RefObject<VoiceInputRef>
	canSendMessage: boolean
	hasLoadingMarker: boolean
	isAllFilesUploaded: boolean
	store: MessageEditorStore
	t: (key: string, options?: Record<string, unknown>) => string
	onSend?: MessageEditorProps["onSend"]
	topicMode?: MessageEditorProps["topicMode"]
	collectMentionItemsFromEditor: () => MentionListItem[]
	isMountedRef: MutableRefObject<boolean>
}

export default function useMessageSendHandler({
	voiceInputRef,
	canSendMessage,
	hasLoadingMarker,
	isAllFilesUploaded,
	store,
	t,
	onSend,
	topicMode,
	collectMentionItemsFromEditor,
	isMountedRef,
}: UseMessageSendHandlerParams) {
	return useMemoizedFn(() => {
		if (voiceInputRef.current?.isRecording) {
			voiceInputRef.current.stopRecording()
		}

		if (!canSendMessage) {
			if (hasLoadingMarker) {
				magicToast.error(t("messageEditor.waitForMarkerLoad"))
			} else if (isEmptyJSONContent(store.editorStore.value)) {
				magicToast.error(t("messageEditor.pleaseInputContent"))
			} else if (!isAllFilesUploaded) {
				magicToast.error(t("messageEditor.waitForFileUpload"))
			}
			return
		}

		let selectedModel = store.topicModelStore.selectedLanguageModel
			? { ...store.topicModelStore.selectedLanguageModel }
			: null
		if (!selectedModel) {
			logger.error(
				"fallback to auto model",
				"current mode list:",
				superMagicModeService.modeList,
			)
			selectedModel = {
				id: "auto",
				group_id: "auto",
				provider_model_id: "auto",
				model_description: "auto",
				model_icon: "auto",
				sort: 0,
				model_id: "auto",
				model_name: "auto",
				model_status: ModelStatusEnum.Normal,
			}
		}

		let content
		try {
			content = store.editorStore.value
				? replaceSuperPlaceholderToString(store.editorStore.value, { validate: true })
				: undefined
		} catch (error: unknown) {
			const validationError = error as Error & {
				validationResult?: { isValid: boolean; emptyPlaceholder: string }
			}
			if (validationError.validationResult?.emptyPlaceholder) {
				const placeholder = validationError.validationResult.emptyPlaceholder
				magicToast.error(
					t("messageEditor.superPlaceholderEmpty", {
						placeholders: placeholder,
					}),
				)
			} else {
				magicToast.error(t("messageEditor.validationFailed"))
			}
			return
		}

		store.draftStore.startSendingGuard()

		onSend?.({
			value: content,
			topicMode,
			mentionItems: collectMentionItemsFromEditor(),
			selectedModel,
			selectedImageModel: store.topicModelStore.selectedImageModel,
		})

		store.draftStore.createSentDraft({
			value: store.editorStore.value,
			onError: (error) => {
				if (isMountedRef.current) {
					console.error("Failed to clear draft:", error)
				}
			},
		})
	})
}
