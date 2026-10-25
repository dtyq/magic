import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import magicToast from "@/components/base/MagicToaster/utils"
import { useDownloadProgress } from "@/pages/superMagic/hooks/useDownloadProgress"
import type { RecordingDetailFileMap } from "@/pages/superMagic/pages/AudioRecordings/types/recording-detail"
import { downloadRecordingAudioFile } from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-audio"
import { downloadRecordingAttachmentFile } from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-attachment"
import {
	collectExportableFileIds,
	downloadRecordingFilesBatch,
	resolveExportableFileRefs,
} from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-batch"
import { getAttachmentFileName } from "@/pages/superMagic/pages/AudioRecordings/utils/recording-detail-files"

export interface RecordingArtifactContent {
	content?: string
	fileId?: string
}

interface UseRecordingArtifactActionsInput {
	projectId: string
	recordingName: string
	fileMap: RecordingDetailFileMap | null
	activeContent: RecordingArtifactContent
}

/** Adapts recording file downloads and active-tab copying for the project preview header. */
export function useRecordingArtifactActions({
	projectId,
	recordingName,
	fileMap,
	activeContent,
}: UseRecordingArtifactActionsInput) {
	const { t } = useTranslation("audioRecordings")
	const [downloading, setDownloading] = useState(false)
	const downloadProgress = useDownloadProgress()
	const downloadCancelledRef = useRef(false)

	const exportAvailability = useMemo(
		() => ({
			hasAudio: Boolean(fileMap?.audio?.file_id),
			hasTranscript: Boolean(fileMap?.transcript?.file_id),
			hasNotes: Boolean(fileMap?.notes?.file_id),
			hasSummaryFiles: Boolean(fileMap?.summaryFiles.length),
			hasAnyExportable: collectExportableFileIds(fileMap).length > 0,
		}),
		[fileMap],
	)

	/** Copies only the text represented by the currently selected content tab. */
	const copyActiveContent = useCallback(async () => {
		if (!activeContent.content?.trim()) return false
		try {
			await navigator.clipboard.writeText(activeContent.content)
			magicToast.success(t("copy.success"))
			return true
		} catch {
			magicToast.error(t("copy.failed"))
			return false
		}
	}, [activeContent.content, t])

	/** Serializes download starts so duplicate clicks cannot create competing progress flows. */
	const runDownload = useCallback(
		async (task: () => Promise<boolean>) => {
			if (downloading) return false
			setDownloading(true)
			try {
				const ok = await task()
				if (!ok && !downloadCancelledRef.current) toast.error(t("detail.loadFailed"))
				return ok
			} finally {
				downloadCancelledRef.current = false
				setDownloading(false)
			}
		},
		[downloading, t],
	)

	/** Downloads the original recording audio with the established filename fallback. */
	const downloadAudio = useCallback(async () => {
		const fileId = fileMap?.audio?.file_id
		if (!fileId) return false
		return runDownload(() =>
			downloadRecordingAudioFile({
				fileId,
				audioFile: fileMap.audio,
				fallbackName: getAttachmentFileName(fileMap.audio),
			}),
		)
	}, [fileMap?.audio, runDownload])

	/** Downloads the transcript source file when the bundle provides one. */
	const downloadTranscript = useCallback(async () => {
		const fileId = fileMap?.transcript?.file_id
		if (!fileId) return false
		const fileName =
			getAttachmentFileName(fileMap.transcript) || `${recordingName}_transcript.md`
		return runDownload(() => downloadRecordingAttachmentFile({ fileId, fileName }))
	}, [fileMap?.transcript, recordingName, runDownload])

	/** Downloads the notes source file when the bundle provides one. */
	const downloadNotes = useCallback(async () => {
		const fileId = fileMap?.notes?.file_id
		if (!fileId) return false
		const fileName = getAttachmentFileName(fileMap.notes) || `${recordingName}_notes.md`
		return runDownload(() => downloadRecordingAttachmentFile({ fileId, fileName }))
	}, [fileMap?.notes, recordingName, runDownload])

	/** Downloads one generated summary by its stable recording summary type. */
	const downloadSummaryType = useCallback(
		async (type: string) => {
			const fileRef = fileMap?.summaryFiles.find((item) => item.type === type)
			const fileId = fileRef?.file?.file_id
			if (!fileId) return false
			const fileName = getAttachmentFileName(fileRef.file) || `${recordingName}_${type}.md`
			return runDownload(() => downloadRecordingAttachmentFile({ fileId, fileName }))
		},
		[fileMap?.summaryFiles, recordingName, runDownload],
	)

	/** Reuses the recording batch-download workflow for every available artifact file. */
	const downloadAll = useCallback(async () => {
		const fileIds = collectExportableFileIds(fileMap)
		if (fileIds.length === 0) return false
		const fileNameById = Object.fromEntries(
			resolveExportableFileRefs(fileMap, recordingName).map((ref) => [
				ref.fileId,
				ref.fileName,
			]),
		)

		return runDownload(() =>
			downloadRecordingFilesBatch({
				fileIds,
				projectId,
				fileNameById,
				startDownload: downloadProgress.startDownload,
				onCancel: () => {
					downloadCancelledRef.current = true
				},
			}),
		)
	}, [downloadProgress.startDownload, fileMap, projectId, recordingName, runDownload])

	return {
		downloading,
		exportAvailability,
		canCopy: Boolean(activeContent.content?.trim()),
		copyActiveContent,
		downloadAudio,
		downloadTranscript,
		downloadNotes,
		downloadSummaryType,
		downloadAll,
	}
}
