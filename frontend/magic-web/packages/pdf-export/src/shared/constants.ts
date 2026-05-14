export const DEFAULT_DPI = 96
export const MM_PER_INCH = 25.4

export const RENDER_TIMEOUT_MS = 30000
export const READY_STATE_FALLBACK_MS = 6000
export const READY_STATE_POLL_MS = 50
export const NATIVE_LOAD_WAIT_MS = 1500
export const EXTERNAL_RESOURCE_TIMEOUT_MS = 30000

/** A4 页面尺寸（mm） */
export const A4_PAGE_SIZE = {
	width: 210,
	height: 297,
} as const

export const DEFAULT_PAGE_CONFIG = {
	viewport: {
		width: 1440,
		height: 900,
	},
	paper: {
		widthMm: A4_PAGE_SIZE.width,
		heightMm: A4_PAGE_SIZE.height,
	},
	pagination: "slice",
	pixelRatio: 2,
	imageType: "jpeg",
	imageQuality: 0.95,
	output: "download",
} as const
