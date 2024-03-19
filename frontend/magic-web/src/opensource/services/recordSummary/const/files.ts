/**
 * Recording content file constants
 * 录音内容文件常量
 */

/**
 * File names for recording session
 * 录音会话文件名
 */
export const RECORDING_FILE_NAMES = {
	/** Note file name - 笔记文件名 */
	NOTE: "note.md",
	/** Transcript file name - 转写文件名 */
	TRANSCRIPT: "transcript.md",
} as const

/**
 * Directory names for recording session
 * 录音会话目录名
 */
export const RECORDING_DIRECTORY_NAMES = {
	/** Images directory name - 图片目录名 */
	IMAGES: "images",
} as const

/**
 * Get full path for note file in recording session
 * 获取录音会话中笔记文件的完整路径
 * @param displayDirPath - Display directory path (e.g., "recording/session-xxx")
 * @returns Full path to note file (e.g., "recording/session-xxx/note.md")
 */
export function getRecordingNotePath(displayDirPath: string): string {
	const normalizedPath = displayDirPath.replace(/^\/+/, "").replace(/\/+$/, "")
	return `/${normalizedPath}/${RECORDING_FILE_NAMES.NOTE}`
}

/**
 * Get full path for transcript file in recording session
 * 获取录音会话中转写文件的完整路径
 * @param displayDirPath - Display directory path (e.g., "recording/session-xxx")
 * @returns Full path to transcript file (e.g., "recording/session-xxx/transcript.md")
 */
export function getRecordingTranscriptPath(displayDirPath: string): string {
	const normalizedPath = displayDirPath.replace(/^\/+/, "").replace(/\/+$/, "")
	return `/${normalizedPath}/${RECORDING_FILE_NAMES.TRANSCRIPT}`
}

/**
 * Get full path for images directory in recording session
 * 获取录音会话中图片目录的完整路径
 * @param displayDirPath - Display directory path (e.g., "recording/session-xxx")
 * @returns Full path to images directory (e.g., "recording/session-xxx/images")
 */
export function getRecordingImagesDirPath(displayDirPath: string): string {
	const normalizedPath = displayDirPath.replace(/^\/+/, "").replace(/\/+$/, "")
	return `${normalizedPath}/${RECORDING_DIRECTORY_NAMES.IMAGES}`
}
