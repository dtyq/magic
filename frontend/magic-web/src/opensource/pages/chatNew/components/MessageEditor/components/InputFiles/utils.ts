import { nanoid } from "nanoid"
import type { FileData } from "./types"
import { ConversationMessageAttachment } from "@/opensource/types/chat/conversation_message"

/**
 * 生成未上传文件数据
 * @param file 文件数据
 * @returns 未上传文件数据
 */
export function genFileData(file: File): FileData {
	return {
		id: nanoid(),
		name: file.name,
		size: file.size,
		file,
		status: "init",
		progress: 0,
	}
}

/**
 * 生成已上传文件数据
 * @param item 文件数据
 * @returns 已上传文件数据
 */
export function genPreviousFileData(item: ConversationMessageAttachment): FileData {
	return {
		id: item.file_id,
		name: item.file_name ?? "",
		file_id: item.file_id,
		size: item.file_size ?? 0,
		file: null,
		status: "done",
		progress: 100,
		result: {
			key: item.file_id,
			name: item.file_name ?? "",
			size: item.file_size ?? 0,
		},
	}
}
