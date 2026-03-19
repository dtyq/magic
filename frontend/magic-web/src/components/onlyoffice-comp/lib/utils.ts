// 简单的工具函数，替代 ranuts/utils
import { editorManager } from "./editor-manager"
import { initX2T, loadScript } from "./x2t"
/**
 * 从 MIME 类型获取文件扩展名
 */
export function getExtensions(mimeType: string): string[] {
	const mimeToExt: Record<string, string[]> = {
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
		"application/msword": ["doc"],
		"application/vnd.oasis.opendocument.text": ["odt"],
		"application/rtf": ["rtf"],
		"text/plain": ["txt"],
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
		"application/vnd.ms-excel": ["xls"],
		"application/vnd.oasis.opendocument.spreadsheet": ["ods"],
		"text/csv": ["csv"],
		"application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
		"application/vnd.ms-powerpoint": ["ppt"],
		"application/vnd.oasis.opendocument.presentation": ["odp"],
	}

	return mimeToExt[mimeType] || []
}

// 加载编辑器 API（已移至 editorManager）
export function loadEditorApi(): Promise<void> {
	return editorManager.loadAPI()
}

// 生命周期

// 统一的初始化函数 - 一次性加载所有必需的资源
let initializationPromise: Promise<void> | null = null
let isInitialized = false

/**
 * 初始化 OnlyOffice 编辑器环境
 * 包括：加载脚本、API 和 X2T 转换器
 * 使用单例模式，确保只初始化一次
 */
export async function initializeOnlyOffice(): Promise<void> {
	// 如果已经初始化完成，直接返回
	if (isInitialized) {
		return
	}

	// 如果正在初始化，返回同一个 Promise
	if (initializationPromise) {
		return initializationPromise
	}

	// 开始初始化
	initializationPromise = (async () => {
		try {
			// 并行加载脚本和 API（它们之间没有依赖关系）
			await Promise.all([
				// loadscript 好像没用
				// loadScript(),
				loadEditorApi(),
			])

			// X2T 初始化需要等待脚本加载完成
			// await initX2T();

			isInitialized = true
			console.log("OnlyOffice environment initialized successfully")
		} catch (error) {
			// 初始化失败，重置状态以允许重试
			initializationPromise = null
			throw error
		}
	})()

	return initializationPromise
}

/**
 * 检查 OnlyOffice 环境是否已初始化
 */
export function isOnlyOfficeInitialized(): boolean {
	return isInitialized
}
