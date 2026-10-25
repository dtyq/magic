import type { ReferenceResourcePanelItem } from "../../../../public/props"
import type { CanvasAssetMediaType } from "../../../../public/magic-types"
import { CANVAS_REFERENCE_MENTION_ITEM_TYPE } from "./canvasReferenceMention.constants"
import type { ReferenceDropProjectFile } from "./useReferenceResourcePanelDataService"

export function getFileExtension(filePath: string): string {
	const lastDotIndex = filePath.lastIndexOf(".")
	if (lastDotIndex < 0) return ""
	return filePath.slice(lastDotIndex + 1)
}

/** file_id 若只是 path 回退值，则不算结构化宿主身份。 */
export function isStructuredFileId(fileId: string | undefined, path: string): boolean {
	const trimmed = fileId?.trim()
	if (!trimmed) return false
	return trimmed !== path.trim()
}

export interface CreateReferenceResourcePanelItemOptions {
	path: string
	fileName: string
	fileId?: string
	sourceFileId?: string
	sourceProjectId?: string
	projectId?: string
	relativeFilePath?: string
	mediaType?: CanvasAssetMediaType | null
}

/**
 * 统一构造 Canvas mention / 面板项。
 * 已知宿主 fileId 时必须写入，避免后续跨编辑器预览把 path 当成 file_ids。
 */
export function createReferenceResourcePanelItem(
	options: CreateReferenceResourcePanelItemOptions,
): ReferenceResourcePanelItem {
	const path = options.path
	const fileName = options.fileName
	return {
		type: CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile,
		data: {
			file_id: options.fileId || path,
			file_name: fileName,
			file_path: path,
			file_extension: getFileExtension(path || fileName),
			...(options.mediaType ? { media_type: options.mediaType } : {}),
			...(options.relativeFilePath ? { relative_file_path: options.relativeFilePath } : {}),
			...(options.projectId ? { project_id: options.projectId } : {}),
			...(options.sourceProjectId ? { source_project_id: options.sourceProjectId } : {}),
			...(options.sourceFileId ? { source_file_id: options.sourceFileId } : {}),
		},
	}
}

export function createReferenceResourcePanelItemFromPath(
	path: string,
	fileName: string,
	identity?: Omit<CreateReferenceResourcePanelItemOptions, "path" | "fileName">,
): ReferenceResourcePanelItem {
	return createReferenceResourcePanelItem({
		path,
		fileName,
		...identity,
	})
}

export function createReferenceResourcePanelItemFromDropFile(
	file: ReferenceDropProjectFile,
): ReferenceResourcePanelItem {
	return createReferenceResourcePanelItem({
		path: file.path,
		fileName: file.fileName,
		fileId: file.fileId,
	})
}

/** 从 mention / 面板项提取可持久化的 UploadFileResponse 身份字段。 */
export function createUploadFileIdentityFromPanelItem(item: ReferenceResourcePanelItem): {
	file_id?: string
	source_file_id?: string
	source_project_id?: string
	project_id?: string
} {
	const path = item.data.file_path
	return {
		...(isStructuredFileId(item.data.file_id, path) ? { file_id: item.data.file_id } : {}),
		...(item.data.source_file_id ? { source_file_id: item.data.source_file_id } : {}),
		...(item.data.source_project_id ? { source_project_id: item.data.source_project_id } : {}),
		...(item.data.project_id ? { project_id: item.data.project_id } : {}),
	}
}

export function createUploadFileResponseFromPanelItem(item: ReferenceResourcePanelItem): {
	path: string
	src: string
	fileName: string
	file_id?: string
	source_file_id?: string
	source_project_id?: string
	project_id?: string
} {
	const path = item.data.file_path
	return {
		path,
		src: path,
		fileName: item.data.file_name,
		...createUploadFileIdentityFromPanelItem(item),
	}
}
