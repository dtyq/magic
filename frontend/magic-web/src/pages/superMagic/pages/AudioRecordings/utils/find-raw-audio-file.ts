import type { AudioAttachmentNode } from "./find-audio-entry-file"

/** Audio extensions supported by Detail AudioPreview (aligned with getFileType) */
const RAW_AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"])

/** Returns true when the attachment node is a visible, playable audio file */
function isPlayableRawAudioFile(item: AudioAttachmentNode): boolean {
	if (item.is_directory) return false
	if (item.is_hidden === true || item.hidden === true) return false

	const extension = (item.file_extension ?? "").toLowerCase().replace(/^\./, "")
	if (!extension) return false

	return RAW_AUDIO_EXTENSIONS.has(extension)
}

/**
 * Locates a raw audio file in the flat attachment list for not-summarized preview.
 * Prefers the list API audio_file_id, then falls back to the first visible audio file.
 */
export function findRawAudioFile(
	attachmentList: AudioAttachmentNode[],
	preferredFileId?: string,
): AudioAttachmentNode | null {
	const trimmedId = preferredFileId?.trim()
	if (trimmedId) {
		const preferred = attachmentList.find(
			(item) => item.file_id === trimmedId && !item.is_directory,
		)
		if (preferred) return preferred
	}

	for (const item of attachmentList) {
		if (isPlayableRawAudioFile(item)) return item
	}

	return null
}
