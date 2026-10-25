import { createFileApi, type FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"

interface DownloadRecordingAttachmentParams {
	fileId: string
	fileName?: string
	fileApi?: Pick<FileApi, "getTemporaryDownloadUrl">
}

/**
 * Resolves one temporary OSS link and triggers a browser download for a recording attachment.
 */
export async function downloadRecordingAttachmentFile({
	fileId,
	fileName,
	fileApi = createFileApi(),
}: DownloadRecordingAttachmentParams): Promise<boolean> {
	if (!fileId) return false

	try {
		const [urlItem] = await fileApi.getTemporaryDownloadUrl({
			file_ids: [fileId],
			is_download: true,
			download_mode: DownloadImageMode.Download,
		})
		if (!urlItem?.url) return false

		await downloadFileWithAnchor(urlItem.url, fileName || undefined)
		return true
	} catch (error) {
		console.error("Failed to download recording attachment:", error)
		return false
	}
}
