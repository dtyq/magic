import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"

export function resolvePublishedDefaultOpenFileId(shareData: unknown): string | null {
	const value = shareData as {
		default_open_file_id?: unknown
		data?: { default_open_file_id?: unknown; data?: { default_open_file_id?: unknown } }
	}
	const id =
		value?.default_open_file_id ??
		value?.data?.default_open_file_id ??
		value?.data?.data?.default_open_file_id
	return id === null || id === undefined || id === "" ? null : String(id)
}

export function buildPreviewFile(entryFile: AttachmentItem) {
	return {
		...entryFile,
		file_id: entryFile.file_id,
		file_name: entryFile.file_name || entryFile.filename || entryFile.name,
		file_extension: entryFile.file_extension,
		display_config: entryFile.display_config,
	}
}
