import { ONLYOFFICE_LANG_KEY } from "./const"

/**
 * 文档状态管理
 * 使用 Proxy 模式管理文档状态
 */
interface DocumentState {
	fileName: string
	file?: File
	url?: string | URL
}

const DocumentStateProxy = new Proxy(
	{
		instance: {
			fileName: "",
			file: undefined,
			url: undefined,
		} as DocumentState,
	},
	{
		// 可以在这里添加拦截器逻辑，比如验证、日志等
	},
)

const getDocumentState = (): DocumentState => {
	return { ...DocumentStateProxy.instance }
}

const setDocumentState = (state: Partial<DocumentState>): void => {
	DocumentStateProxy.instance = {
		...DocumentStateProxy.instance,
		...state,
	}
}

// 为了保持向后兼容，导出旧的函数名（注意：getDocmentObj 拼写有误）
export const getDocmentObj = getDocumentState
export const setDocmentObj = setDocumentState

// 导出新的正确拼写的函数
export { getDocumentState, setDocumentState, DocumentStateProxy }

// 导出类型
export type { DocumentState }

/**
 * 获取当前语言代码（'zh' 或 'en'）
 * 优先级：URL 参数 locale -> localStorage -> 浏览器语言 -> 默认 'en'
 */
export function getCurrentLang(): "zh" | "en" {
	if (typeof window === "undefined") return ONLYOFFICE_LANG_KEY.EN

	// 1. 从 URL 参数获取
	const params = new URLSearchParams(window.location.search)
	const urlLang = params.get("locale")
	if (urlLang === ONLYOFFICE_LANG_KEY.ZH || urlLang === "zh-CN") {
		return ONLYOFFICE_LANG_KEY.ZH
	}
	if (urlLang === ONLYOFFICE_LANG_KEY.EN) {
		return ONLYOFFICE_LANG_KEY.EN
	}

	// 3. 从浏览器语言获取
	const browserLang = navigator.language.toLowerCase()
	if (browserLang.startsWith(ONLYOFFICE_LANG_KEY.ZH)) {
		return ONLYOFFICE_LANG_KEY.ZH
	}

	// 4. 默认英文
	return ONLYOFFICE_LANG_KEY.ZH
}

/**
 * 设置语言并保存到 localStorage
 */
export function setCurrentLang(lang: "zh" | "en"): void {
	if (typeof window !== "undefined") {
		localStorage.setItem("document-lang", lang)
	}
}

/**
 * 获取 OnlyOffice 语言代码（BCP 47 标准）
 * 优先级：URL 参数 locale -> localStorage -> 浏览器语言 -> 默认 'en'
 */
export function getOnlyOfficeLang(): string {
	const lang = getCurrentLang()
	return lang === ONLYOFFICE_LANG_KEY.ZH ? "zh-CN" : ONLYOFFICE_LANG_KEY.EN
}
