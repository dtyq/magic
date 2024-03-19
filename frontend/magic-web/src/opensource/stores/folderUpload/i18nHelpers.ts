import type { TFunction } from "i18next"

/**
 * 格式化时间
 */
export const formatTimeRemaining = (seconds: number, t: TFunction): string => {
	if (seconds < 60) {
		return t("folderUpload.progress.estimatedTime.seconds", { count: Math.round(seconds) })
	} else if (seconds < 3600) {
		return t("folderUpload.progress.estimatedTime.minutes", { count: Math.round(seconds / 60) })
	} else {
		return t("folderUpload.progress.estimatedTime.hours", { count: Math.round(seconds / 3600) })
	}
}

/**
 * 格式化文件大小
 * 使用十进制单位（SI标准）与操作系统保持一致
 */
export const formatFileSize = (bytes: number, _t?: TFunction): string => {
	const units = ["B", "KB", "MB", "GB"]
	let size = bytes
	let unitIndex = 0

	// 使用十进制单位（1000）而不是二进制单位（1024）
	while (size >= 1000 && unitIndex < units.length - 1) {
		size /= 1000
		unitIndex++
	}

	return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * 格式化上传速度
 * @param speedInKBps 速度，单位为 KB/s
 */
export const formatUploadSpeed = (speedInKBps: number): string => {
	if (speedInKBps < 1) {
		// 小于 1 KB/s，显示为 B/s
		const speedInBps = speedInKBps * 1024
		return `${Math.round(speedInBps)} B/s`
	} else if (speedInKBps < 1024) {
		// 1 KB/s ~ 1024 KB/s，显示为 KB/s
		return `${Math.round(speedInKBps)} KB/s`
	} else {
		// 大于等于 1024 KB/s，显示为 MB/s
		const speedInMBps = speedInKBps / 1024
		return `${speedInMBps.toFixed(1)} MB/s`
	}
}

/**
 * 获取任务状态文本
 */
export const getTaskStatusText = (status: string, t: TFunction): string => {
	return t(`folderUpload.status.${status}`)
}

/**
 * 格式化项目名称（处理长名称）
 */
export const formatProjectName = (name: string, maxLength: number = 20): string => {
	if (name.length <= maxLength) return name
	return `${name.substring(0, maxLength - 3)}...`
}

/**
 * 获取本地化的消息文本
 */
export const getLocalizedMessage = (
	key: string,
	t: TFunction,
	values?: Record<string, any>,
): string => {
	return t(`folderUpload.messages.${key}`, values)
}

/**
 * 获取本地化的错误文本
 */
export const getLocalizedError = (
	key: string,
	t: TFunction,
	values?: Record<string, any>,
): string => {
	return t(`folderUpload.errors.${key}`, values)
}

/**
 * 获取本地化的工具提示文本
 */
export const getLocalizedTooltip = (
	key: string,
	t: TFunction,
	values?: Record<string, any>,
): string => {
	return t(`folderUpload.tooltips.${key}`, values)
}
