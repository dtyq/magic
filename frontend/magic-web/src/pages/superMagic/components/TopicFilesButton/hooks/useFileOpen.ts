import { useCallback } from "react"
import type { AttachmentItem } from "./types"
import { getFileType } from "../../../utils/handleFIle"

export interface UseFileOpenOptions {
	onFileClick?: (fileItem: any) => void
	setUserSelectDetail?: (detail: any) => void
	attachments?: AttachmentItem[]
}

export interface NodeFile {
	type: string
	data: {
		file_name: string
		content: string
		file_id: string
	}
	name: string
	action: string
	remark: string
	id: string
}

/**
 * useFileOpen - Handle file opening operations
 */
export function useFileOpen(options: UseFileOpenOptions = {}) {
	const { onFileClick, setUserSelectDetail, attachments } = options

	const handleOpenFile = useCallback(
		(item: AttachmentItem) => {
			// If it's a folder, do nothing
			if (item.is_directory) return

			// Handle file opening (now opens file tab in files mode)
			if (onFileClick && item.file_id) {
				onFileClick(item)
				return
			}

			// Fallback to original setUserSelectDetail logic (for compatibility with old single file mode)
			const fileName = item.display_filename || item.file_name || item.filename
			const fileExtension = item.file_extension || ""
			const type = getFileType(fileExtension)
			if (type) {
				setUserSelectDetail?.({
					type, // Determine type based on file extension
					data: {
						file_name: fileName,
						file_extension: fileExtension,
						file_id: item.file_id,
						file_size: item.file_size,
						metadata: item.metadata,
					},
					currentFileId: item.file_id,
					attachments,
				})
			} else {
				setUserSelectDetail?.({
					type: "empty",
					data: {
						text: "文件类型不支持",
					},
				})
			}
		},
		[onFileClick, setUserSelectDetail, attachments],
	)

	const handleNodeFile = (node: NodeFile) => {
		const { data, type } = node
		if (type) {
			const fileExtension = data.file_name?.split(".")?.pop()
			setUserSelectDetail?.({
				type, // Determine type based on file extension
				data: {
					...data,
					file_extension: fileExtension || "",
				},
				currentFileId: data.file_id,
				attachments,
			})
		} else {
			setUserSelectDetail?.({
				type: "empty",
				data: {
					text: "文件类型不支持",
				},
			})
		}
	}

	return {
		handleOpenFile,
		handleNodeFile,
	}
}
