import { useMemoizedFn } from "ahooks"
import { type RefObject } from "react"
import type {
	TopicFilesButtonRef,
	PresetFileType,
} from "@/opensource/pages/superMagic/components/TopicFilesButton"

interface UseFileOperationsParams {
	topicFilesButtonRef: RefObject<TopicFilesButtonRef>
	setActiveSiderTab: (tab: string) => void
}

/**
 * Hook for handling file operations with automatic tab switching
 * Ensures the topicFiles tab is active before performing any file operations
 */
export function useFileOperations({
	topicFilesButtonRef,
	setActiveSiderTab,
}: UseFileOperationsParams) {
	/**
	 * Handle add file operation
	 * Switches to topicFiles tab and triggers file creation
	 */
	const handleAddFile = useMemoizedFn((extraType?: PresetFileType) => {
		setActiveSiderTab("topicFiles")
		// Use setTimeout to ensure tab switch completes before invoking the operation
		setTimeout(() => {
			topicFilesButtonRef.current?.addFile(extraType)
		}, 100)
	})

	/**
	 * Handle add folder operation
	 * Switches to topicFiles tab and triggers folder creation
	 */
	const handleAddFolder = useMemoizedFn(() => {
		setActiveSiderTab("topicFiles")
		setTimeout(() => {
			topicFilesButtonRef.current?.addFolder()
		}, 100)
	})

	/**
	 * Handle upload file operation
	 * Switches to topicFiles tab and triggers file upload
	 */
	const handleUploadFile = useMemoizedFn(() => {
		setActiveSiderTab("topicFiles")
		setTimeout(() => {
			topicFilesButtonRef.current?.uploadFile()
		}, 100)
	})

	return {
		handleAddFile,
		handleAddFolder,
		handleUploadFile,
	}
}
