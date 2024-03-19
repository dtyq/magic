import { I18N } from "xgplayer"
import ZH from "xgplayer/es/lang/zh-cn"
import EN from "xgplayer/es/lang/en"

// Define text keys type for better type safety
export type TextKey =
	| "loading"
	| "loadFailed"
	| "checkFormat"
	| "invalidFile"
	| "fileIdNotFound"
	| "playerError"

// Setup international language support
const setupI18N = (): string => {
	// Load language packages
	I18N.use(ZH)
	I18N.use(EN)

	// Auto detect language from browser or default to Chinese
	const browserLang = navigator.language || navigator.languages?.[0] || "zh-CN"
	const defaultLang = browserLang.toLowerCase().startsWith("zh") ? "zh-cn" : "en"

	return defaultLang
}

// Initialize internationalization
export const defaultLanguage = setupI18N()

// Localized text messages
export const getLocalizedText = (key: TextKey): string => {
	const texts = {
		"zh-cn": {
			loading: "正在加载视频...",
			loadFailed: "播放器加载失败",
			checkFormat: "请检查视频文件格式或网络连接",
			invalidFile: "无效的视频文件",
			fileIdNotFound: "文件ID不存在",
			playerError: "播放器错误",
		},
		en: {
			loading: "Loading video...",
			loadFailed: "Player failed to load",
			checkFormat: "Please check video format or network connection",
			invalidFile: "Invalid video file",
			fileIdNotFound: "File ID not found",
			playerError: "Player error",
		},
	}

	return texts[defaultLanguage as keyof typeof texts]?.[key] || texts.en[key]
}
