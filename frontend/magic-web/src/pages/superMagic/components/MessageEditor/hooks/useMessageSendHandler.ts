import modelCache from "@/services/superMagic/topicModel/SuperMagicTopicModelCacheService"
import { serializeWechatChatContent } from "../extensions/wechat-chat-history/transform"
import { useMemoizedFn } from "ahooks"
import type { MutableRefObject, RefObject } from "react"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { VoiceInputRef } from "@/components/business/VoiceInput"
import magicToast from "@/components/base/MagicToaster/utils"
import projectFilesStore from "@/stores/projectFiles"
import { replaceSuperPlaceholderToString } from "../extensions/super-placeholder/utils"
import { serializeInspectorContent } from "../extensions/inspector-detail"
import type { MessageEditorStore } from "../stores"
import type { MessageEditorProps } from "../types"
import { isEmptyJSONContent } from "../utils"
import { transformMarkerImagePathsToWorkspaceAbsolute } from "../utils/mention"

interface UseMessageSendHandlerParams {
	voiceInputRef: RefObject<VoiceInputRef>
	canSendMessage: boolean
	hasLoadingMarker: boolean
	isAllFilesUploaded: boolean
	isEditingQueueItem: boolean
	store: MessageEditorStore
	t: (key: string, options?: Record<string, unknown>) => string
	onSend?: MessageEditorProps["onSend"]
	topicMode?: MessageEditorProps["topicMode"]
	collectMentionItemsFromEditor: () => MentionListItem[]
	promoteCanvasPendingMentions?: () => void
	onSendStart?: () => void
	/** Blank home creation may fail before dispatch; keep its draft until success is confirmed. */
	awaitSendSuccess?: boolean
	isMountedRef: MutableRefObject<boolean>
	isSendSuspended?: () => boolean
}

export default function useMessageSendHandler({
	voiceInputRef,
	canSendMessage,
	hasLoadingMarker,
	isAllFilesUploaded,
	isEditingQueueItem,
	store,
	t,
	onSend,
	topicMode,
	collectMentionItemsFromEditor,
	promoteCanvasPendingMentions,
	onSendStart,
	awaitSendSuccess = false,
	isMountedRef,
	isSendSuspended,
}: UseMessageSendHandlerParams) {
	return useMemoizedFn(async () => {
		if (isSendSuspended?.()) return
		if (store.draftStore.isDraftSwitching) return
		if (voiceInputRef.current?.isRecording) voiceInputRef.current.stopRecording()
		// Sending is also an explicit confirmation path when the editor never received focus.
		promoteCanvasPendingMentions?.()

		if (isEditingQueueItem && isEmptyJSONContent(store.editorStore.value)) {
			return
		}

		const selectedModel = store.topicModelStore.selectedLanguageModel
		const selectedVideoModel = store.topicModelStore.selectedVideoModel
		if (!isEditingQueueItem && !store.topicModelStore.isLanguageModelReady) {
			magicToast.error(t("messageEditor.pleaseSelectModel"))
			return
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

		let content
		try {
			content = store.editorStore.value
				? serializeInspectorContent(
						transformMarkerImagePathsToWorkspaceAbsolute(
							replaceSuperPlaceholderToString(
								serializeWechatChatContent(store.editorStore.value),
								{
									validate: true,
								},
							),
							projectFilesStore.workspaceFilesList,
						),
					)
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

		onSendStart?.()
		const isQueueDraft = Boolean(store.draftStore.queueDraft)
		if (!isQueueDraft) store.draftStore.startSendingGuard()
		const mentionItems = collectMentionItemsFromEditor()

		const draftValue = store.editorStore.value
		const sendResult = onSend?.({
			value: content,
			topicMode,
			mentionItems,
			selectedModel: selectedModel ? modelCache.snapshotLanguageModel(selectedModel) : null,
			selectedImageModel: store.topicModelStore.selectedImageModel,
			selectedVideoModel,
		})

		if (isQueueDraft) {
			// 队列草稿由协调流程确认入队后再清理，失败或超时继续保留。
			await sendResult
			return
		}
		if (awaitSendSuccess) {
			let success = false
			try {
				success = (await sendResult) === true
			} finally {
				if (!success) {
					store.draftStore.resetSendingGuard()
					store.draftStore.saveDraft({ value: store.editorStore.value })
				}
			}
			if (!success) return
		}

		store.draftStore.createSentDraft({
			value: awaitSendSuccess ? draftValue : store.editorStore.value,
			onError: (error) => {
				if (isMountedRef.current) {
					console.error("Failed to clear draft:", error)
				}
			},
		})
	})
}
