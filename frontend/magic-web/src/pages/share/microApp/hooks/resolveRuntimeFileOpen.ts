import type { PreviewDetail } from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import { getFileManagerRequest } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/fileManagerTabs"
import type { FileManagerContext } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"

export type RuntimeFileOpenResult =
	| { kind: "preview"; detail: PreviewDetail }
	| { kind: "file-manager"; context: FileManagerContext }
	| { kind: "ignore" }

export function buildRuntimeFilePreviewDetail(payload: {
	fileId?: string
	fileData?: Record<string, unknown>
}): PreviewDetail | undefined {
	const fileData = payload.fileData
	const fileIdValue = fileData?.file_id ?? payload.fileId
	const fileId =
		typeof fileIdValue === "number"
			? String(fileIdValue)
			: typeof fileIdValue === "string"
				? fileIdValue
				: ""
	if (!fileId) return undefined
	const fileName =
		(typeof fileData?.file_name === "string" && fileData.file_name) ||
		(typeof fileData?.display_filename === "string" && fileData.display_filename) ||
		""
	const fileExtension =
		(typeof fileData?.file_extension === "string" && fileData.file_extension) ||
		fileName.split(".").pop() ||
		""
	return {
		// Match FilesViewer: map extension to DetailType, not the raw suffix.
		type: getFileType(fileExtension),
		data: {
			...fileData,
			file_id: fileId,
			file_name: fileName,
			file_extension: fileExtension,
		},
		currentFileId: fileId,
	} as PreviewDetail
}

export function resolveRuntimeFileOpen(file?: unknown): RuntimeFileOpenResult {
	if (!file || typeof file !== "object" || Array.isArray(file)) return { kind: "ignore" }
	const manager = getFileManagerRequest(file)
	if (manager) return { kind: "file-manager", context: manager }
	const fileData = file as Record<string, unknown>
	if (fileData.is_directory) return { kind: "ignore" }
	const detail = buildRuntimeFilePreviewDetail({
		fileId:
			typeof fileData.file_id === "string" || typeof fileData.file_id === "number"
				? String(fileData.file_id)
				: undefined,
		fileData,
	})
	return detail ? { kind: "preview", detail } : { kind: "ignore" }
}
