import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { useMemo, useState } from "react"
import type { RecordingDetailFileMap } from "../../types/recording-detail"
import {
	buildRecordingShareSelection,
	collectRecordingRequiredShareFileIds,
} from "../../utils/build-recording-share-selection"

interface RecordingDetailShareControlsInput {
	projectId: string
	fileMap: RecordingDetailFileMap | null
}

/** Exposes share dialog state and actions for the recording detail owner shell dialogs region. */
export function useRecordingDetailShareControls(input: RecordingDetailShareControlsInput) {
	const { permissions: access } = useFileAccess()
	const { projectId, fileMap } = input
	const [shareModalOpen, setShareModalOpen] = useState(false)
	const [shareManagementOpen, setShareManagementOpen] = useState(false)

	const shareSelection = useMemo(() => buildRecordingShareSelection(fileMap), [fileMap])
	const requiredFileIds = useMemo(() => collectRecordingRequiredShareFileIds(fileMap), [fileMap])

	const attachments = shareSelection.shareableFiles
	const attachmentList = shareSelection.shareableFiles
	const defaultSelectedFileIds = shareSelection.defaultSelectedFileIds
	const displayNameByFileId = useMemo(
		() =>
			Object.fromEntries(
				shareSelection.shareableFiles.flatMap((file) =>
					file.file_id && file.share_display_name
						? [[file.file_id, file.share_display_name]]
						: [],
				),
			),
		[shareSelection.shareableFiles],
	)
	const displayNameByFileName = useMemo(
		() =>
			Object.fromEntries(
				shareSelection.shareableFiles.flatMap((file) => {
					const fileName = file.file_name || file.filename || file.name
					return fileName && file.share_display_name
						? [[fileName, file.share_display_name]]
						: []
				}),
			),
		[shareSelection.shareableFiles],
	)
	const hasShareableFiles = defaultSelectedFileIds.length > 0

	/** Opens the existing recording file-share creation dialog. */
	function openCreateShare() {
		if (!access.share) return
		setShareModalOpen(true)
	}

	/** Opens the PC recording-local share manager instead of the global share-management modal. */
	function openManageShare() {
		if (!access.share) return
		setShareManagementOpen(true)
	}

	/** Closes the existing recording file-share creation dialog. */
	function closeShareModal() {
		setShareModalOpen(false)
	}

	/** Closes the recording-local share-management dialog. */
	function closeManageShare() {
		setShareManagementOpen(false)
	}

	return {
		shareModalOpen: shareModalOpen && access.share,
		shareManagementOpen: shareManagementOpen && access.share,
		attachments,
		attachmentList,
		defaultSelectedFileIds,
		displayNameByFileId,
		displayNameByFileName,
		requiredFileIds,
		hasShareableFiles,
		openCreateShare,
		openManageShare,
		closeManageShare,
		closeShareModal,
	}
}
