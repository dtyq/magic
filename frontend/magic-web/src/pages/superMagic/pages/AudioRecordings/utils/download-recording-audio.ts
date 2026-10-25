import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { getAttachmentFileName } from "./recording-detail-files"
import { downloadRecordingAttachmentFile } from "./download-recording-attachment"

interface DownloadRecordingAudioParams {
	fileId?: string
	audioFile?: AttachmentItem
	fallbackName?: string
	fileApi?: Pick<FileApi, "getTemporaryDownloadUrl">
}

/**
 * Downloads the original recording asset by resolving one temporary OSS link and
 * forwarding it to the shared browser download helper.
 */
export async function downloadRecordingAudioFile({
	fileId,
	audioFile,
	fallbackName,
	fileApi,
}: DownloadRecordingAudioParams): Promise<boolean> {
	if (!fileId) return false

	const preferredName = getAttachmentFileName(audioFile) || fallbackName
	return downloadRecordingAttachmentFile({
		fileId,
		fileName: preferredName || undefined,
		fileApi,
	})
}
