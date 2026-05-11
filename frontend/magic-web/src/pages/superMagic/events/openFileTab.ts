export type OpenFileIdLike = string | number

/**
 * Open_File_Tab 事件附带的文件上下文对象。
 * 兼容历史多种字段命名，发布方直接传入原始文件对象即可，无需重新整理内部字段。
 */
export interface OpenFileTabRecord {
	file_id?: OpenFileIdLike
	fileId?: OpenFileIdLike
	currentFileId?: OpenFileIdLike
	id?: OpenFileIdLike
	data?: {
		file_id?: OpenFileIdLike
		fileId?: OpenFileIdLike
		[key: string]: unknown
	} | null
	[key: string]: unknown
}

/**
 * 打开文件预览 Tab 时发布，供所有详情区（工作台、分享页、移动端）统一消费。
 * fileId 是唯一必填字段；fileData 为可选的原始文件对象，内部字段格式不限。
 */
export interface SuperMagicOpenFileTabPayload {
	fileId: string
	fileData?: OpenFileTabRecord
}
