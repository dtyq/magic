import { useCallback } from "react"
import { useMemoizedFn } from "ahooks"
import { initializeService } from "@/services/recordSummary/serviceInstance"

import {
	getTemporaryDownloadUrl,
	downloadFileContent,
} from "@/pages/superMagic/utils/api"
import { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { RECORD_SUMMARY_EVENTS } from "@/services/recordSummary/const/events"
import { SimpleEditorRef } from "@/components/tiptap-templates/simple/simple-editor"

interface UseFileChangeCheckOptions {
	/** Current note content */
	currentContent: string
	/** Callback when attachments change */
	onAttachmentsChange?: (data: { tree: AttachmentItem[]; list: AttachmentItem[] }) => void
	editorRef?: React.RefObject<SimpleEditorRef>
	onMergedResult?: (mergedContent: string) => void
}

/**
 * Hook for handling file content change detection and user interaction
 */
export function useFileChangeCheck({
	currentContent = "",
	onAttachmentsChange,
	onMergedResult,
}: UseFileChangeCheckOptions) {
	const recordSummaryService = initializeService()

	/**
	 * Handle file content change when server content differs from current content
	 */
	const handleFileContentChange = useMemoizedFn(
		async (targetFile: AttachmentItem, serverContent: string = "") => {
			// Compare content with latest currentContent value
			if (serverContent.trim() === currentContent.trim()) {
				// Content is same, only update timestamp
				recordSummaryService.updateNoteLastUpdatedAt(targetFile.updated_at)
				return
			}

			// Emit event to show modal component
			recordSummaryService.emit(RECORD_SUMMARY_EVENTS.FILE_CONTENT_CHANGE_CONFLICT, {
				targetFile,
				currentContent,
				serverContent,
				onIgnore: () => {
					// Ignore: keep current content, but ensure store and session are synced
					recordSummaryService.flushNoteUpdate(currentContent)
					recordSummaryService.updateNoteLastUpdatedAt(targetFile.updated_at)
				},
				onOverride: () => {
					// Override: replace current content with server content
					recordSummaryService.flushNoteUpdate(serverContent)
					recordSummaryService.updateNoteLastUpdatedAt(targetFile.updated_at)
					onMergedResult?.(serverContent)
				},
				onUseMerge: (mergedContent: string) => {
					// Use merged content
					recordSummaryService.flushNoteUpdate(mergedContent)
					recordSummaryService.updateNoteLastUpdatedAt(targetFile.updated_at)
					onMergedResult?.(mergedContent)
				},
				onCancel: () => {
					// Cancel: do nothing
				},
			})
		},
	)

	/**
	 * Check if note file has been updated on server and handle accordingly
	 */
	const checkNoteFileChange = useCallback(
		async (attachmentList: AttachmentItem[]) => {
			const nodeFileId = recordSummaryService.getPresetFiles()?.note_file?.file_id

			if (!nodeFileId) return

			const targetFile = attachmentList.find((item) => item.file_id === nodeFileId)

			if (!targetFile) return

			// Check if updated_at has changed
			const savedLastUpdatedAt = recordSummaryService.getNoteLastUpdatedAt()
			const currentUpdatedAt = targetFile.updated_at

			// If timestamp changed or not set before
			if (currentUpdatedAt && currentUpdatedAt !== savedLastUpdatedAt) {
				try {
					// Cancel current note update task
					recordSummaryService.cancelNoteUpdate()

					// Fetch latest file content from server
					const urlResponse = await getTemporaryDownloadUrl({
						file_ids: [nodeFileId],
					})

					if (!urlResponse || !urlResponse[0]?.url) {
						console.error("Failed to get download URL for note file")
						// Update timestamp even on error to prevent repeated prompts
						recordSummaryService.updateNoteLastUpdatedAt(currentUpdatedAt)
						return
					}

					const serverContent = await downloadFileContent(urlResponse[0].url, {
						responseType: "text",
					})

					if (typeof serverContent === "string") {
						await handleFileContentChange(targetFile, serverContent)
					}
				} catch (error) {
					console.error("Failed to fetch note file content:", error)
					// Update timestamp even on error to prevent repeated prompts
					recordSummaryService.updateNoteLastUpdatedAt(currentUpdatedAt)
				}
			}
		},
		[handleFileContentChange, recordSummaryService],
	)

	/**
	 * Handle attachments change callback with file change checking
	 */
	const handleAttachmentsChange = useCallback(
		async ({ tree, list }: { tree: AttachmentItem[]; list: AttachmentItem[] }) => {
			onAttachmentsChange?.({
				tree,
				list,
			})

			await checkNoteFileChange(list)
		},
		[onAttachmentsChange, checkNoteFileChange],
	)

	return {
		handleAttachmentsChange,
		checkNoteFileChange,
	}
}
