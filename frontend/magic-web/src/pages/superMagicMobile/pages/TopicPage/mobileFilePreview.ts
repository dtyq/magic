import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import type { PreviewDetail } from "@/pages/superMagicMobile/components/PreviewDetailPopup/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

type MobileFilePreviewItem = Partial<AttachmentItem> & {
	file_id?: string | number
	file_size?: number
	file_url?: string
	url?: string
}

/** Narrows unknown message payloads to the file metadata fields used by mobile preview. */
function normalizePreviewItem(value: unknown): MobileFilePreviewItem | undefined {
	if (!value || typeof value !== "object") return undefined
	return value as MobileFilePreviewItem
}

/** Normalizes file identifiers so message and project attachment records can be matched safely. */
function normalizeFileId(fileId: MobileFilePreviewItem["file_id"]): string {
	if (typeof fileId === "string" && fileId.trim()) return fileId.trim()
	if (typeof fileId === "number" && Number.isFinite(fileId)) return String(fileId)
	return ""
}

/** Resolves an extension from a filename when the message payload omits file_extension. */
function inferFileExtension(fileName?: string): string {
	const normalizedName = fileName?.trim() ?? ""
	const dotIndex = normalizedName.lastIndexOf(".")
	if (dotIndex < 0 || dotIndex === normalizedName.length - 1) return ""
	return normalizedName.slice(dotIndex + 1).toLowerCase()
}

/** Builds the smallest mobile preview detail without requiring the project attachment tree. */
export function buildMobileFilePreviewDetail(
	value?: unknown,
	attachmentList: readonly AttachmentItem[] = [],
): PreviewDetail | null {
	const fileItem = normalizePreviewItem(value)
	const fileId = normalizeFileId(fileItem?.file_id)
	if (!fileId) return null

	const projectAttachment = attachmentList.find(
		(item) => normalizeFileId(item.file_id) === fileId,
	) as MobileFilePreviewItem | undefined
	// Message metadata keeps preview available; loaded project metadata enriches it when present.
	const source = { ...(fileItem ?? {}), ...(projectAttachment ?? {}) }
	const fileName =
		source.display_filename || source.file_name || source.filename || fileItem?.file_name || ""
	const fileExtension = (source.file_extension || inferFileExtension(fileName))
		.toLowerCase()
		.replace(/^\./, "")

	return {
		type: getFileType(fileExtension) as PreviewDetail["type"],
		data: {
			file_id: fileId,
			file_name: fileName,
			file_extension: fileExtension,
			...(source.display_config ? { display_config: source.display_config } : {}),
			...(source.relative_file_path ? { relative_file_path: source.relative_file_path } : {}),
			...(source.file_size !== undefined ? { file_size: source.file_size } : {}),
			...(source.file_url || source.url ? { file_url: source.file_url || source.url } : {}),
		},
		currentFileId: fileId,
	} as PreviewDetail
}
