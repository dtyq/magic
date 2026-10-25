import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "./types"
import type { DirectorySource } from "../../SelectPathModal/components/SelectDirectoryModal/types"

interface UseCopyFileSelectorOptions {
	directorySource?: DirectorySource
	projectId?: string
	attachments?: AttachmentItem[]
	onCopySuccess?: () => void
}

/**
 * Lightweight copy directory selector state for mobile file management.
 * Mirrors useMoveFile selectorConfig without re-implementing copy API logic.
 */
export function useCopyFileSelector(options: UseCopyFileSelectorOptions = {}) {
	const { t } = useTranslation("super")
	const { projectId, attachments = [], onCopySuccess } = options

	const [visible, setVisible] = useState(false)
	const [pendingCopyFileIds, setPendingCopyFileIds] = useState<string[]>([])

	/** Open the copy picker for one or more file IDs. */
	const [defaultPath, setDefaultPath] = useState<AttachmentItem[]>([])
	const showCopySelector = useCallback((fileIds: string[], path: AttachmentItem[] = []) => {
		if (fileIds.length === 0) return
		setPendingCopyFileIds(fileIds)
		setDefaultPath(path)
		setVisible(true)
	}, [])

	const openBatchCopyByFileIds = useCallback(
		(fileIds: string[], path: AttachmentItem[] = []) => {
			showCopySelector(fileIds, path)
		},
		[showCopySelector],
	)

	const hideCopySelector = useCallback(() => {
		setVisible(false)
		setPendingCopyFileIds([])
		setDefaultPath([])
	}, [])

	const notifyCopySuccess = useCallback(() => {
		hideCopySelector()
		onCopySuccess?.()
	}, [hideCopySelector, onCopySuccess])

	return {
		pendingCopyFileIds,
		openBatchCopyByFileIds,
		hideCopySelector,
		notifyCopySuccess,
		selectorConfig: {
			directorySource: options.directorySource,
			visible,
			title: t("topicFiles.contextMenu.copyTo"),
			tips: t("topicFiles.moveModal.tips"),
			projectId: projectId || "",
			attachments,
			pendingCopyFileIds,
			onSubmit: () => undefined,
			onClose: hideCopySelector,
			okText: t("topicFiles.moveModal.confirm"),
			cancelText: t("common.cancel"),
			// Copy allows selecting source folder/subfolder as target (desktop parity).
			disabledFolderIds: [] as string[],
			confirmLoading: false,
			defaultPath,
		},
	}
}
