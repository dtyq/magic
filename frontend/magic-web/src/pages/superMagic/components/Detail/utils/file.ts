import type { AttachmentItem } from "../../TopicFilesButton/hooks/types"
import { isSlidesTemplateFolder } from "../../TopicFilesButton/utils/slides-template-folder"
import { DetailType } from "../types"

function collectAttachmentItems(
	items: AttachmentItem[] | undefined,
	result: AttachmentItem[] = [],
): AttachmentItem[] {
	for (const item of items || []) {
		result.push(item)
		collectAttachmentItems(item.children, result)
	}
	return result
}

function getAttachmentName(item: AttachmentItem | undefined): string {
	return item?.file_name || item?.filename || item?.name || item?.display_filename || ""
}

function isHtmlFile(item: AttachmentItem | undefined): boolean {
	return (
		item?.file_extension?.toLowerCase() === "html" ||
		getAttachmentName(item).toLowerCase().endsWith(".html")
	)
}

export const hasPPTMetadata = (attachmentItem: AttachmentItem) => {
	return attachmentItem?.display_config?.type === "slide"
}

/** Reads the optional runtime rollout switch; an absent value keeps the new renderer enabled. */
export const isAudioFolderRootRenderEnabled = (): boolean => {
	if (typeof window === "undefined") return true
	const configured = window.CONFIG?.MAGIC_AUDIO_FOLDER_ROOT_RENDER_ENABLED
	return configured !== false && configured !== "false" && configured !== 0 && configured !== "0"
}

/** Keep PPTRootRender routing consistent across the renderer and FilesViewer portal boundary. */
export const shouldUsePPTRootRender = (type: unknown, data: unknown): boolean => {
	return type === DetailType.Html && hasPPTMetadata(data as AttachmentItem)
}

/** Detects audio bundle folders and legacy index.html entries that should use the recording workbench. */
export const shouldUseAudioRootRender = (type: unknown, data: unknown): boolean => {
	return (
		isAudioFolderRootRenderEnabled() &&
		type === DetailType.Html &&
		(data as AttachmentItem)?.display_config?.type === "audio"
	)
}

/** Detect if a folder/file carries self-media metadata */
export const hasSelfMediaMetadata = (
	attachmentItem: AttachmentItem | { metadata?: Record<string, unknown> } | null,
) => {
	return attachmentItem?.metadata?.type === "self-media"
}

/**
 * Check if a file is in PPT mode by checking its parent folder's metadata
 */
export const isFileInPPTMode = (fileId: string, attachmentList: AttachmentItem[]): boolean => {
	const parentId = attachmentList?.find((item) => item.file_id === fileId)?.parent_id

	if (!parentId) return false

	const parentFolder = attachmentList.find((item) => item.file_id === parentId)

	return parentFolder ? hasPPTMetadata(parentFolder) : false
}

/** Check if an HTML file is a page inside a standard project slides template. */
export const isFileInSlidesTemplateMode = (
	fileId: string,
	attachmentList: AttachmentItem[] = [],
): boolean => {
	const items = collectAttachmentItems(attachmentList)
	const file = items.find((item) => String(item.file_id || "") === String(fileId || ""))
	if (!file || !isHtmlFile(file)) return false

	const slidesDirectory = items.find(
		(item) => String(item.file_id || "") === String(file.parent_id || ""),
	)
	if (!slidesDirectory?.is_directory || getAttachmentName(slidesDirectory) !== "slides") {
		return false
	}

	const templateRoot = items.find(
		(item) => String(item.file_id || "") === String(slidesDirectory.parent_id || ""),
	)
	if (!templateRoot?.is_directory) return false

	const rootChildrenById = items.filter(
		(item) => String(item.parent_id || "") === String(templateRoot.file_id || ""),
	)
	const rootChildren = Array.from(
		new Map(
			[...(templateRoot.children || []), ...rootChildrenById].map((item) => [
				String(item.file_id || getAttachmentName(item)),
				item,
			]),
		).values(),
	)

	return isSlidesTemplateFolder({ ...templateRoot, children: rootChildren })
}

/** Fixed-size slide canvas preview, shared by PPT projects and project slide templates. */
export const isFileInSlideCanvasMode = (
	fileId: string,
	attachmentList: AttachmentItem[] = [],
): boolean => {
	return (
		isFileInPPTMode(fileId, attachmentList) ||
		isFileInSlidesTemplateMode(fileId, attachmentList)
	)
}

/**
 * Check if a file's extension matches any of the given types.
 * @param attachmentItem - the file to check
 * @param extensions - allowed extensions to match against
 *
 * @example
 * isConvertibleFile(item, ["html"])           // only html → PPTX export
 * isConvertibleFile(item, ["html", "md"])     // html + md → PDF export
 */
export const isConvertibleFile = (
	attachmentItem: AttachmentItem,
	extensions: string[],
): boolean => {
	const ext = attachmentItem?.file_extension?.toLowerCase() ?? ""
	return extensions.includes(ext)
}
