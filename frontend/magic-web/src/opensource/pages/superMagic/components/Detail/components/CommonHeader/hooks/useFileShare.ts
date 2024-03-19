import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/opensource/apis"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import {
	isAppEntryFile,
	findParentFolder,
} from "../../../../TopicFilesButton/utils/collectFolderFiles"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"

interface UseFileShareProps {
	/** Current file being shared */
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	/** Attachments list for finding parent folder */
	attachments?: AttachmentItem[]
}

interface UseFileShareReturn {
	/** Share modal visibility state */
	shareModalVisible: boolean
	/** Success modal visibility state */
	showSuccessModal: boolean
	/** Existing share info */
	existingShareInfo: any | null
	/** Share file ID (actual file to share, may be parent folder) */
	shareFileId: string | undefined
	/** Similar shares dialog visibility */
	showSimilarSharesDialog: boolean
	/** Similar shares list */
	similarShares: any[]
	/** Checking share status */
	isCheckingShare: boolean
	/** Handle share action */
	handleShare: () => Promise<void>
	/** Select similar share */
	handleSelectSimilarShare: (share: any) => void
	/** Create new share */
	handleCreateNewShare: () => void
	/** Cancel share */
	handleCancelShare: () => Promise<void>
	/** Edit share */
	handleEditShare: () => void
	/** Set share modal visible */
	setShareModalVisible: (visible: boolean) => void
	/** Set show success modal */
	setShowSuccessModal: (visible: boolean) => void
	/** Set existing share info */
	setExistingShareInfo: (info: any | null) => void
	/** Close similar shares dialog */
	closeSimilarSharesDialog: () => void
}

/**
 * Custom hook for managing file sharing logic
 */
export function useFileShare({ currentFile, attachments }: UseFileShareProps): UseFileShareReturn {
	const { t } = useTranslation("super")

	// Share states
	const [shareModalVisible, setShareModalVisible] = useState(false)
	const [showSuccessModal, setShowSuccessModal] = useState(false)
	const [existingShareInfo, setExistingShareInfo] = useState<any>(null)
	const [shareFileId, setShareFileId] = useState<string | undefined>(undefined)
	const [showSimilarSharesDialog, setShowSimilarSharesDialog] = useState(false)
	const [similarShares, setSimilarShares] = useState<any[]>([])
	const [isCheckingShare, setIsCheckingShare] = useState(false)

	// Find file in attachments tree
	const findFileInAttachments = useCallback(
		(items: AttachmentItem[], fileId: string): AttachmentItem | null => {
			for (const item of items) {
				if (item.file_id === fileId) {
					return item
				}
				if (item.is_directory && item.children) {
					const found = findFileInAttachments(item.children, fileId)
					if (found) return found
				}
			}
			return null
		},
		[],
	)

	// Handle file sharing
	const handleShare = useCallback(async () => {
		if (!currentFile?.id || !attachments) return

		// Check if current file is entry file, if so use parent folder ID
		let fileIdToCheck = currentFile.id

		const fullFileItem = findFileInAttachments(attachments, currentFile.id)

		// If entry file, get parent folder ID
		if (fullFileItem && isAppEntryFile(fullFileItem)) {
			const parentFolder = findParentFolder(attachments, currentFile.id)
			if (parentFolder?.file_id) {
				fileIdToCheck = parentFolder.file_id
			}
		}

		// Save actual file ID to share
		setShareFileId(fileIdToCheck)

		// Check for similar shares
		setIsCheckingShare(true)
		try {
			const result = await SuperMagicApi.findSimilarShares({ file_ids: [fileIdToCheck] })

			if (result && result.length > 0) {
				// Has similar shares, show selection dialog
				setSimilarShares(result)
				setShowSimilarSharesDialog(true)
			} else {
				// No similar shares, open create share modal directly
				setShareModalVisible(true)
			}
		} catch (error) {
			console.error("Check similar shares failed:", error)
			// API failed, open create share modal directly
			setShareModalVisible(true)
		} finally {
			setIsCheckingShare(false)
		}
	}, [currentFile?.id, attachments, findFileInAttachments])

	// Handle selecting similar share
	const handleSelectSimilarShare = useCallback((share: any) => {
		setExistingShareInfo(share)
		setShowSuccessModal(true)
		setShowSimilarSharesDialog(false)
	}, [])

	// Handle creating new share
	const handleCreateNewShare = useCallback(() => {
		setShowSimilarSharesDialog(false)
		setShareModalVisible(true)
	}, [])

	// Handle canceling share
	const handleCancelShare = useCallback(async () => {
		if (!existingShareInfo?.resource_id) return

		try {
			await SuperMagicApi.cancelShareResource({ resourceId: existingShareInfo.resource_id })
			magicToast.success(t("shareManagement.cancelShareSuccess"))
			setShowSuccessModal(false)
			setExistingShareInfo(null)
		} catch (error) {
			console.error("Cancel share failed:", error)
			magicToast.error(t("shareManagement.cancelShareFailed"))
		}
	}, [existingShareInfo?.resource_id, t])

	// Handle editing share
	const handleEditShare = useCallback(() => {
		if (!existingShareInfo?.resource_id || !currentFile) return

		// Close success modal
		setShowSuccessModal(false)
		// Open edit share modal with resourceId
		setShareFileId(shareFileId || currentFile.id)
		setShareModalVisible(true)
	}, [existingShareInfo?.resource_id, currentFile, shareFileId])

	// Close similar shares dialog
	const closeSimilarSharesDialog = useCallback(() => {
		setShowSimilarSharesDialog(false)
	}, [])

	return {
		shareModalVisible,
		showSuccessModal,
		existingShareInfo,
		shareFileId,
		showSimilarSharesDialog,
		similarShares,
		isCheckingShare,
		handleShare,
		handleSelectSimilarShare,
		handleCreateNewShare,
		handleCancelShare,
		handleEditShare,
		setShareModalVisible,
		setShowSuccessModal,
		setExistingShareInfo,
		closeSimilarSharesDialog,
	}
}
