import {
	KeyboardAction,
	KeyboardMapping,
	MentionItemType,
	AnimationConfig,
	MentionPanelTheme,
	PanelState,
} from "./types"
import type { I18nTexts } from "./i18n/types"
export {
	createDefaultItems,
	DEFAULT_ITEMS,
	isSelectableBuiltinItemId,
	NON_SELECTABLE_BUILTIN_ITEM_IDS,
} from "./runtime/builtin/default-items"
import { createDefaultItems, DEFAULT_ITEMS } from "./runtime/builtin/default-items"

// Keyboard mappings
export const KEYBOARD_MAPPING: KeyboardMapping = {
	ArrowUp: KeyboardAction.SELECT_PREVIOUS,
	ArrowDown: KeyboardAction.SELECT_NEXT,
	Enter: KeyboardAction.CONFIRM,
	ArrowLeft: KeyboardAction.NAVIGATE_BACK,
	ArrowRight: KeyboardAction.ENTER_FOLDER,
	Escape: KeyboardAction.EXIT,
}

// Default configuration
export const createDefaultConfig = (t: I18nTexts) => ({
	height: 280, // Reduced fixed height for better proportions
	width: 320,
	itemHeight: 32,
	headerHeight: 30, // Actual search header height from Figma design
	searchPlaceholder: t.projectFilesSearchPlaceholder,
	animationDuration: 150,
})

// Panel state titles
export const createPanelTitles = (t: I18nTexts) => ({
	[PanelState.DEFAULT]: t.panelTitles.default,
	[PanelState.SEARCH]: t.panelTitles.search,
	[PanelState.FOLDER]: t.panelTitles.folder,
	[PanelState.CATALOG]: t.selectItem,
})

// Animation configurations
export const ANIMATIONS: Record<string, AnimationConfig> = {
	panel: {
		duration: 150,
		easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
	},
	selection: {
		duration: 100,
		easing: "ease-out",
	},
	search: {
		duration: 80,
		easing: "ease-in-out",
	},
}

// Theme configuration
export const DEFAULT_THEME: MentionPanelTheme = {
	colors: {
		background: "#ffffff",
		selectedBackground: "#eef3fd",
		text: "rgba(28, 29, 35, 0.8)",
		secondaryText: "rgba(28, 29, 35, 0.6)",
		hintText: "rgba(28, 29, 35, 0.35)",
		border: "rgba(28, 29, 35, 0.08)",
	},
	fonts: {
		primary: "PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif",
		secondary: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
	},
	sizes: {
		itemHeight: 32,
		padding: 4,
		borderRadius: 8,
	},
	shadows: {
		panel: "0px 4px 14px rgba(0, 0, 0, 0.1), 0px 0px 1px rgba(0, 0, 0, 0.3)",
	},
}

// Icon mappings for different item types (using TSIcon names)
export const ICON_MAPPINGS: Record<string, string> = {
	"file-folder": "ts-folder",
	"file-sharefolder": "ts-folder-share",
	"file-markdown": "ts-doc-file",
	"file-document": "ts-doc-file",
	"project-file": "ts-doc-file",
	"upload-file": "ts-attachment",
	"cloud-file": "ts-cloud-doc",
	plug: "ts-api",
	"magic-bots": "ts-bear",
	// For SVG icons from Figma, we'll use class names for styling
	"tabler-icon-chevron-right": "ts-arrow-right",
} as const

// File type icon mappings (using TSIcon names)
export const FILE_TYPE_ICONS: Record<string, string> = {
	// Documents
	md: "ts-md",
	txt: "ts-txt",
	doc: "ts-word-file",
	docx: "ts-docx-file",
	pdf: "ts-pdf-file",

	// Spreadsheets
	xls: "ts-execl-file",
	xlsx: "ts-execl-file",
	csv: "ts-execl-file",

	// Presentations
	ppt: "ts-ppt-file",
	pptx: "ts-ppt-file",

	// Images
	jpg: "ts-image-file",
	jpeg: "ts-image-file",
	png: "ts-image-file",
	gif: "ts-image-file",
	svg: "ts-image-file",

	// Code files
	js: "ts-code",
	ts: "ts-code",
	jsx: "ts-code",
	tsx: "ts-code",
	html: "ts-html",
	css: "ts-code",
	scss: "ts-code",
	json: "ts-code",
	xml: "ts-code",

	// Archives
	zip: "ts-zip-file",
	rar: "ts-rar-file",
	tar: "ts-compressed-files",
	gz: "ts-compressed-files",
	"7z": "ts-compressed-files",

	// Audio files
	mp3: "ts-audio-file",
	wav: "ts-audio-file",
	flac: "ts-audio-file",
	aac: "ts-audio-file",

	// Video files
	mp4: "ts-video-file",
	avi: "ts-video-file",
	mov: "ts-video-file",
	mkv: "ts-video-file",

	// Special files
	xmind: "ts-xmind-file",
	mindmap: "ts-mindmap-file",
	whiteboard: "ts-whiteboard-file",
	bitable: "ts-bitable-file",

	// Other files
	py: "ts-code",

	// Default
	default: "ts-other-file",
}

// Error messages
export const createErrorMessages = (t: I18nTexts) => ({
	LOAD_FAILED: t.errorMessages.loadFailed,
	SEARCH_FAILED: t.errorMessages.searchFailed,
	NETWORK_ERROR: t.errorMessages.networkError,
	UNKNOWN_ERROR: t.errorMessages.unknownError,
})

// Static error messages (for backwards compatibility)
export const ERROR_MESSAGES = {
	LOAD_FAILED: "加载失败，请重试",
	SEARCH_FAILED: "搜索失败，请检查网络连接",
	NETWORK_ERROR: "网络连接异常",
	UNKNOWN_ERROR: "未知错误",
}

// Debounce delays
export const DEBOUNCE_DELAYS = {
	SEARCH: 300,
	RESIZE: 100,
	KEYBOARD: 50,
}

// Z-index values
export const Z_INDEX = {
	PANEL: 1000,
	OVERLAY: 999,
	DROPDOWN: 1001,
}

// Create all internationalized configurations
export const createI18nConfigs = (t: I18nTexts) => ({
	defaultConfig: createDefaultConfig(t),
	panelTitles: createPanelTitles(t),
	defaultItems: createDefaultItems(t),
	errorMessages: createErrorMessages(t),
})
