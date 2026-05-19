import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { addFileToCurrentChat } from "@/pages/superMagic/utils/topics"
import {
	resolveSelfMediaAttachmentItem,
	resolveSelfMediaPostDirectoryAttachmentItem,
} from "../services/selfMediaCardChat"
import type { SelfMediaAttachmentNode, SelfMediaPost } from "../types"

interface UseShellFileHandlersOptions {
	attachmentList?: SelfMediaAttachmentNode[]
	activePost?: SelfMediaPost
}

/**
 * Common file-to-chat handlers shared by all platform shells.
 * Provides handlers for adding individual cards and post folder directories.
 */
export function useShellFileHandlers({ attachmentList, activePost }: UseShellFileHandlersOptions) {
	const { t } = useTranslation("super")

	const handleAddFileToCurrentChat = useCallback(
		(fileId?: string) => {
			const attachmentItem = resolveSelfMediaAttachmentItem(attachmentList, fileId)
			if (!attachmentItem) {
				magicToast.error(t("fileViewer.addToCurrentChatFailed"))
				return
			}
			addFileToCurrentChat({ fileItem: attachmentItem, isNewTopic: false, autoFocus: true })
		},
		[attachmentList, t],
	)

	const handleAddActivePostDirectoryToCurrentChat = useCallback(() => {
		const anyCardFileId = activePost?.cards.find((c) => c.fileId)?.fileId
		const folderItem = resolveSelfMediaPostDirectoryAttachmentItem(
			attachmentList,
			anyCardFileId,
		)
		if (!folderItem) {
			magicToast.error(t("fileViewer.addToCurrentChatFailed"))
			return
		}
		addFileToCurrentChat({ fileItem: folderItem, isNewTopic: false, autoFocus: true })
	}, [activePost, attachmentList, t])

	return { handleAddFileToCurrentChat, handleAddActivePostDirectoryToCurrentChat }
}
