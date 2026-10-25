import projectFilesStore from "@/stores/projectFiles"
import { useFileApi, type FileApi } from "@/pages/superMagic/fileAccess/fileApi"

export const PROJECT_FILE_PICKER_DRAG_MIME = "application/x-magic-self-media-project-file"

export interface SelfMediaProjectFileRef {
	fileId: string
	fileName: string
	filePath?: string
}

interface ProjectFilePickerDragPayload {
	type: "project-file-picker"
	fileId: string
	fileName: string
	filePath?: string
}

interface TopicFileMoveDragPayload {
	type: "file-move"
	fileIds: string[]
}

export type DropPayload =
	{ kind: "local"; files: File[] } | { kind: "project"; files: SelfMediaProjectFileRef[] }

export function setProjectFilePickerDragData(
	dataTransfer: DataTransfer,
	payload: SelfMediaProjectFileRef,
) {
	const data: ProjectFilePickerDragPayload = {
		type: "project-file-picker",
		fileId: payload.fileId,
		fileName: payload.fileName,
		filePath: payload.filePath,
	}
	dataTransfer.setData(PROJECT_FILE_PICKER_DRAG_MIME, JSON.stringify(data))
	dataTransfer.effectAllowed = "copy"
}

function resolveProjectFileRefs(fileIds: string[]): SelfMediaProjectFileRef[] {
	const refs: SelfMediaProjectFileRef[] = []
	for (const fileId of fileIds) {
		const file = projectFilesStore.workspaceFilesList.find(
			(item) => item.file_id === fileId && !item.is_directory,
		)
		if (!file?.file_id) continue
		refs.push({
			fileId: file.file_id,
			fileName: file.display_filename || file.file_name || "未命名文件",
			filePath: file.relative_file_path || undefined,
		})
	}
	return refs
}

export function parseDropPayload(dataTransfer: DataTransfer): DropPayload | null {
	if (dataTransfer.files?.length > 0) {
		return { kind: "local", files: Array.from(dataTransfer.files) }
	}

	const pickerRaw = dataTransfer.getData(PROJECT_FILE_PICKER_DRAG_MIME)
	if (pickerRaw) {
		try {
			const parsed = JSON.parse(pickerRaw) as ProjectFilePickerDragPayload
			if (parsed.type === "project-file-picker" && parsed.fileId) {
				return {
					kind: "project",
					files: [
						{
							fileId: parsed.fileId,
							fileName: parsed.fileName,
							filePath: parsed.filePath,
						},
					],
				}
			}
		} catch {
			// ignore malformed payload
		}
	}

	const jsonRaw = dataTransfer.getData("application/json")
	if (jsonRaw) {
		try {
			const parsed = JSON.parse(jsonRaw) as TopicFileMoveDragPayload
			if (parsed.type === "file-move" && Array.isArray(parsed.fileIds)) {
				const files = resolveProjectFileRefs(parsed.fileIds)
				if (files.length > 0) return { kind: "project", files }
			}
		} catch {
			// ignore malformed payload
		}
	}

	return null
}

export function acceptDropEvent(e: React.DragEvent) {
	e.preventDefault()
	e.stopPropagation()
}

export async function loadProjectFilesAsFiles(
	refs: SelfMediaProjectFileRef[],
	fileApi: Pick<FileApi, "getFileContentById">,
): Promise<File[]> {
	return Promise.all(
		refs.map(async ({ fileId, fileName }) => {
			const blob = (await fileApi.getFileContentById(fileId, {
				responseType: "blob",
			})) as Blob
			return new File([blob], fileName, { type: blob.type || "application/octet-stream" })
		}),
	)
}

export function filesToFileList(files: File[]): FileList {
	const dt = new DataTransfer()
	for (const file of files) {
		dt.items.add(file)
	}
	return dt.files
}
