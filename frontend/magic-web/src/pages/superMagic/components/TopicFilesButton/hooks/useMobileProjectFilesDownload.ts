import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useDownloadImageMenu } from "@/pages/superMagic/components/Detail/contents/Image/hooks/useDownloadImageMenu"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import {
	buildSingleFileDownloadMenu,
	type MobileDownloadMenuItem,
} from "../utils/build-single-file-download-menu"
import { getMobileAttachmentKey } from "../utils/get-mobile-attachment-key"
import { useDuplicateFileHandler } from "./useDuplicateFileHandler"
import { useFileOperations } from "./useFileOperations"
import type { AttachmentItem } from "./types"

interface UseMobileProjectFilesDownloadOptions {
	projectId?: string
	attachments: AttachmentItem[]
	selectedProject?: { id?: string; project_name?: string }
	selectedTopic?: unknown
	onFileClick?: (fileItem: AttachmentItem) => void
	refreshAttachments?: () => Promise<void> | void
	allowDownload?: boolean
	duplicateFileHandler?: ReturnType<typeof useDuplicateFileHandler>
}

/**
 * Thin bridge: reuse useFileOperations handlers + shared download menu builder (same rules as useContextMenu).
 * Batch ZIP is handled by useBatchDownload in TopicFilesPanel — not duplicated here.
 */
export function useMobileProjectFilesDownload({
	projectId,
	attachments,
	selectedProject,
	selectedTopic,
	onFileClick,
	refreshAttachments,
	allowDownload = true,
	duplicateFileHandler: externalDuplicateHandler,
}: UseMobileProjectFilesDownloadOptions) {
	const { t } = useTranslation("super")

	const internalDuplicateHandler = useDuplicateFileHandler({
		attachments: attachments || [],
	})
	const duplicateFileHandler = externalDuplicateHandler || internalDuplicateHandler

	const {
		handleDownloadOriginal,
		handleDownloadPdf,
		handleDownloadPpt,
		handleDownloadPptx,
		handleDownloadImage,
	} = useFileOperations({
		onFileClick,
		attachments,
		selectedTopic,
		projectId,
		getItemId: getMobileAttachmentKey,
		selectedProject,
		duplicateFileHandler,
		onUpdateAttachments: refreshAttachments,
	})

	const {
		agreementModal,
		handleDownloadNoWaterMark,
		shouldUseSingleDownloadEntry,
		preloadWaterMarkFreeModal,
	} = useDownloadImageMenu({
		onDownload: (mode?: DownloadImageMode, item?: AttachmentItem | object) =>
			handleDownloadOriginal(item as AttachmentItem, mode),
	})

	const downloadHandlers = useMemo(
		() => ({
			handleDownloadOriginal,
			handleDownloadPdf,
			handleDownloadPpt,
			handleDownloadPptx,
			handleDownloadImage,
			handleDownloadNoWaterMark,
			preloadWaterMarkFreeModal,
		}),
		[
			handleDownloadOriginal,
			handleDownloadPdf,
			handleDownloadPpt,
			handleDownloadPptx,
			handleDownloadImage,
			handleDownloadNoWaterMark,
			preloadWaterMarkFreeModal,
		],
	)

	const getSingleFileDownloadMenuItems = useCallback(
		(item: AttachmentItem): MobileDownloadMenuItem[] => {
			if (!allowDownload) return []
			return buildSingleFileDownloadMenu({
				item,
				handlers: downloadHandlers,
				t,
				shouldUseSingleDownloadEntry,
			})
		},
		[allowDownload, downloadHandlers, shouldUseSingleDownloadEntry, t],
	)

	return {
		allowDownload,
		agreementModal,
		getSingleFileDownloadMenuItems,
		preloadWaterMarkFreeModal,
	}
}
