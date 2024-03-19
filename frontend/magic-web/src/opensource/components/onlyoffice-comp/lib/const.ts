export const ONLYOFFICE_ID = "iframe-office-id"

// 编辑器容器挂载配置
export const ONLYOFFICE_CONTAINER_CONFIG = {
	// 容器元素 ID
	ID: ONLYOFFICE_ID,
	// 容器父元素选择器（用于自动挂载）
	PARENT_SELECTOR: ".onlyoffice-container",
	// 容器父元素类名（用于 JSX className）
	PARENT_CLASS_NAME: "onlyoffice-container",
	// 容器样式配置
	STYLE: {
		position: "absolute",
		top: "0",
		right: "0",
		bottom: "0",
		left: "0",
		zIndex: "-999",
	},
} as const

export const ONLYOFFICE_RESOURCE = {
	DOCUMENTS: "/packages/onlyoffice/7.0.3/web-apps/apps/api/documents/api.js",
	X2T: "/packages/onlyoffice/7.0.3/wasm/x2t/x2t.js",
	XLSX: "/packages/onlyoffice/7.0.3/libs/sheetjs/xlsx.full.min.js",
}

// EventBus 事件名称
export const ONLYOFFICE_EVENT_KEYS = {
	SAVE_DOCUMENT: "saveDocument",
	DOCUMENT_READY: "documentReady",
	LOADING_CHANGE: "loadingChange",
} as const

export const FILE_TYPE = {
	DOCX: "DOCX",
	XLSX: "XLSX",
	PPTX: "PPTX",
} as const

// 超时和延迟配置（单位：毫秒）
export const READONLY_TIMEOUT_CONFIG = {
	// X2T 初始化超时时间（300秒）
	X2T_INIT: 300000,
	// 文档保存事件等待超时时间（10秒）
	SAVE_DOCUMENT: 10000,
	// 文档准备就绪事件等待超时时间（10秒）
	DOCUMENT_READY: 10000,
	// 只读模式切换最小延迟时间，防止切换过快导致界面闪烁
	READONLY_SWITCH_MIN_DELAY: 200,
} as const

// 向后兼容：保留旧的导出名称
export const READONLY_SWITCH_MIN_DELAY = READONLY_TIMEOUT_CONFIG.READONLY_SWITCH_MIN_DELAY

// 语言 key 常量
export const ONLYOFFICE_LANG_KEY = {
	ZH: "zh",
	EN: "en",
} as const

// WASM 文件缓存配置接口
export interface CacheFileConfig {
	// URL 匹配规则（字符串或正则表达式）
	url: string | RegExp
	// 自定义处理函数，返回处理后的 URL 和压缩信息
	event: (url: string) => {
		fetchUrl: string
		isCompressed?: boolean
		compressionType?: "gzip" | "br"
	}
}

// WASM 文件缓存配置
export const ONLYOFFICE_CACHE_FILE: CacheFileConfig[] = [
	{
		url: "wasm/x2t/x2t.wasm",
		event: (url: string) => {
			// 对于 x2t.wasm，使用压缩版本 x2t.wasm.gz
			if (url.includes("x2t.wasm") && !url.includes(".gz") && !url.includes(".br")) {
				return {
					fetchUrl: url.replace("x2t.wasm", "x2t.wasm.gz"),
					isCompressed: true,
					compressionType: "gzip",
				}
			}
			return {
				fetchUrl: url,
				isCompressed: false,
			}
		},
	},
]

export const ONLYOFFICE_INDEXEDDB_NAME = "onlyoffice-cache"
