import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	type DirectoryMentionData,
	MentionItemType,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { isPendingProjectFileMention } from "../../utils/mention"
import type { FileData } from "../../types"

/** Rebuilds project file and directory references without uploading their content again. */
export function createPastedProjectFileReferences(
	items: TiptapMentionAttributes[],
	existingFileIds: Iterable<string>,
): FileData[] {
	const knownFileIds = new Set(existingFileIds)

	return items
		.filter(isPendingProjectFileMention)
		.map((item): FileData | null => {
			const data = item.data as ProjectFileMentionData | DirectoryMentionData
			const isDirectory = item.type === MentionItemType.FOLDER
			const fileId = isDirectory
				? (data as DirectoryMentionData).source_directory_id ||
					(data as DirectoryMentionData).directory_id
				: (data as ProjectFileMentionData).source_file_id ||
					(data as ProjectFileMentionData).file_id
			if (!fileId || knownFileIds.has(fileId)) return null

			knownFileIds.add(fileId)
			const name = isDirectory
				? (data as DirectoryMentionData).directory_name
				: (data as ProjectFileMentionData).file_name
			const path = isDirectory
				? (data as DirectoryMentionData).directory_path
				: (data as ProjectFileMentionData).file_path

			return {
				id: fileId,
				name,
				file: new File([], name),
				status: "done",
				isVirtualReference: true,
				progress: 100,
				saveResult: {
					file_id: fileId,
					file_key: path,
					file_name: name,
					file_size: isDirectory ? 0 : ((data as ProjectFileMentionData).file_size ?? 0),
					file_type: isDirectory ? "directory" : "user_upload",
					project_id: data.project_id ?? data.source_project_id ?? "",
					topic_id: "",
					task_id: "",
					created_at: "",
					relative_file_path: path,
				},
			}
		})
		.filter((file): file is FileData => Boolean(file))
}

/**
 * Rebuilds completed upload references from pasted mention data without restarting uploads.
 * Pending uploads are intentionally excluded because cutting them cancels their local session.
 */
export function createPastedUploadFileReferences(
	items: TiptapMentionAttributes[],
	existingFileIds: Iterable<string>,
): FileData[] {
	const knownFileIds = new Set(existingFileIds)

	return items
		.filter((item) => item.type === MentionItemType.UPLOAD_FILE)
		.map((item): FileData | null => {
			const data = item.data as UploadFileMentionData
			if (
				data.upload_status !== "done" ||
				!data.file_id ||
				!data.file_name ||
				!data.file_path ||
				knownFileIds.has(data.file_id)
			) {
				return null
			}

			knownFileIds.add(data.file_id)
			return {
				id: data.file_id,
				name: data.file_name,
				file: new File([], data.file_name),
				status: "done",
				progress: 100,
				isVirtualReference: true,
				defaultRelativePath: data.relative_file_path,
				isHidden: data.is_hidden,
				isCanvasClipboard: data.is_canvas_clipboard,
				result: {
					key: data.file_path,
					name: data.file_name,
					size: data.file_size ?? 0,
				},
			}
		})
		.filter((file): file is FileData => Boolean(file))
}
