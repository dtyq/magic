import React, { useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { RecordingSummaryEditorMode } from "../const/recordSummary"
import type { MessageEditorRef as MessageEditorRefType } from "../../MessageEditor/MessageEditor"
import {
	MentionItemType,
	ProjectFileMentionData,
	UploadFileMentionData,
} from "@/opensource/components/business/MentionPanel/types"

interface UseRecordSummaryAudioFileParams {
	editorMode: RecordingSummaryEditorMode
	setEditorMode: (mode: RecordingSummaryEditorMode) => void
	tiptapEditorRef: React.RefObject<MessageEditorRefType>
}

/**
 * 录音总结模式下，接收音频文件，并添加到编辑器中
 */
function useRecordSummaryAudioFile({
	editorMode,
	setEditorMode,
	tiptapEditorRef,
}: UseRecordSummaryAudioFileParams) {
	const { t } = useTranslation("super")

	// Clean up files when editor mode changes from Editing
	useEffect(() => {
		const currentEditorMode = editorMode
		const editorRef = tiptapEditorRef.current

		return () => {
			// 如果编辑器模式为编辑中，则清空编辑器中的文件
			if (currentEditorMode === RecordingSummaryEditorMode.Editing) {
				editorRef?.clearFiles()
			}
		}
	}, [editorMode, tiptapEditorRef])

	// Handle receiving audio files from pubsub
	const handleReceiveRecordSummaryAudioFile = useMemoizedFn(
		async (
			data:
				| {
						type: MentionItemType.PROJECT_FILE
						data: ProjectFileMentionData
				  }
				| {
						type: MentionItemType.UPLOAD_FILE
						data: UploadFileMentionData
				  },
		) => {
			setEditorMode(RecordingSummaryEditorMode.Editing)

			await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000))

			const mentionItem = {
				type: "mention" as const,
				attrs: data,
			}

			await tiptapEditorRef.current?.loadDraftReady()

			// @deprecated mentionItems 已经移除了
			// tiptapEditorRef.current?.restoreMentionItems([mentionItem])
			tiptapEditorRef.current?.setContent({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: t("recordingSummary.ui.convertRecordingPrefix"),
							},
							mentionItem,
							{
								type: "text",
								text: t("recordingSummary.ui.convertRecordingSuffix"),
							},
						],
					},
				],
			})
		},
	)

	// Subscribe to audio file events
	useEffect(() => {
		pubsub.subscribe(
			PubSubEvents.Receive_RecordSummary_Audio_File,
			handleReceiveRecordSummaryAudioFile,
		)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Receive_RecordSummary_Audio_File,
				handleReceiveRecordSummaryAudioFile,
			)
		}
	}, [handleReceiveRecordSummaryAudioFile])
}

export default useRecordSummaryAudioFile
