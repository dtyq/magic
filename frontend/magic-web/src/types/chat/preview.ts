import type { FileTypeResult } from "file-type"
import { ConversationMessageAttachment } from "./conversation_message"

/**
 * 文件预览信息
 */
export type FilePreviewInfo = {
	src?: string
	message_id?: string
	conversation_id?: string
} & Partial<ConversationMessageAttachment>

/**
 * 图片预览信息
 */
export type ImagePreviewInfo = {
	messageId: string | undefined
	conversationId: string | undefined
	fileId?: string
	// 原图文件id
	oldFileId?: string
	// 原图文件url
	oldUrl?: string
	fileName?: string
	fileSize?: number
	index?: number
	url?: string
	ext?:
		| Partial<FileTypeResult>
		| { ext?: "svg"; mime?: "image/svg+xml" }
		| { ext?: string; mime?: string }
	/** 是否独立显示 */
	standalone?: boolean
	/** 是否使用转高清功能 */
	useHDImage?: boolean
}
