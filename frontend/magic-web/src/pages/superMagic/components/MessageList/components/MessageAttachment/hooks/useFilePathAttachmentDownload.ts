import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { useMemoizedFn } from "ahooks"
import { useMessageListProjectFilesStore } from "@/pages/superMagic/components/MessageList/context"
import {
	downloadFileByPath as publishDownloadFileByPath,
	findFilePathAttachment,
	type FilePathAttachment,
} from "@/pages/superMagic/components/MessageList/utils/attachmentByFilePath"
import { useMessageAttachmentDownload } from "./useMessageAttachmentDownload"

/** Resolves path attachments before downloading related resources. */
export function useFilePathAttachmentDownload() {
	const projectFilesStore = useMessageListProjectFilesStore()
	const downloadFile = useMessageAttachmentDownload()
	const { permissions: access } = useFileAccess()

	return useMemoizedFn((attachment: FilePathAttachment) => {
		if (!access.download) return
		const file = findFilePathAttachment(projectFilesStore?.workspaceFilesList || [], attachment)

		if (file?.file_id) {
			return downloadFile(file.file_id)
		}

		publishDownloadFileByPath(attachment)
	})
}
