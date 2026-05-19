/**
 * 上传状态枚举
 */
export const UPLOAD_STATUS = {
	UPLOADING: "uploading",
	DONE: "done",
	ERROR: "error",
} as const

export type UploadStatus = (typeof UPLOAD_STATUS)[keyof typeof UPLOAD_STATUS]

/**
 * 状态显示文本映射（中文） - 已废弃，使用 i18n
 * @deprecated 使用 i18n
 */
export const UPLOAD_STATUS_LABELS_ZH: Record<UploadStatus, string> = {
	[UPLOAD_STATUS.UPLOADING]: "上传中",
	[UPLOAD_STATUS.DONE]: "已完成",
	[UPLOAD_STATUS.ERROR]: "上传失败",
}

/**
 * 状态显示文本映射（英文） - 已废弃，使用 i18n
 * @deprecated 使用 i18n
 */
export const UPLOAD_STATUS_LABELS_EN: Record<UploadStatus, string> = {
	[UPLOAD_STATUS.UPLOADING]: "Uploading",
	[UPLOAD_STATUS.DONE]: "Completed",
	[UPLOAD_STATUS.ERROR]: "Failed",
}
