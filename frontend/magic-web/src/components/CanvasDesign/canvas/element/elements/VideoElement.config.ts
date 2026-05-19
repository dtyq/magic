import { COLORS, IMAGE_CONFIG, LAYOUT } from "./ImageElement.config"

/**
 * 视频占位 UI：从 Image 元素配置派生，与图片占位视觉对齐；
 * 后续若视频需要独立样式，仅在本对象上覆盖对应字段即可。
 */
export const VIDEO_PLACEHOLDER = {
	colors: {
		textEmpty: COLORS.EMPTY_TEXT,
		textLoading: COLORS.LOADING_TEXT,
		loadingBg: COLORS.LOADING_BG,
	},
	layout: {
		textPaddingX: LAYOUT.TEXT_PADDING_X,
		textPaddingY: LAYOUT.TEXT_PADDING_Y,
		textFontSize: LAYOUT.TEXT_FONT_SIZE,
		textFontFamily: LAYOUT.TEXT_FONT_FAMILY,
		iconTextSpacing: 8,
	},
	/** 占位中文本条背景圆角，与 Image 一致 */
	textBackgroundCornerRadius: IMAGE_CONFIG.CORNER_RADIUS,
} as const

/**
 * 视频元素：默认尺寸、轮询、预览/播放器视觉等
 */
export const VIDEO_CONFIG = {
	DEFAULT_WIDTH: 1280,
	DEFAULT_HEIGHT: 720,
	/** Konva 视频画面圆角，默认与 Image 元素一致 */
	CORNER_RADIUS: IMAGE_CONFIG.CORNER_RADIUS,
	POLLING_INTERVAL: 10000,
	/** 占位态播放图标的逻辑尺寸；实际屏幕尺寸由渲染阶段按 inverseScale 保持稳定 */
	PLACEHOLDER_PLAY_ICON_SIZE: 38,
	/** 播放器中心播放按钮图标的逻辑尺寸；实际屏幕尺寸由渲染阶段按 inverseScale 保持稳定 */
	PLAYER_PLAY_ICON_SIZE: 32,
	PLAY_ICON_WIDTH_RATIO: 0.62,
	PLAY_ICON_HEIGHT_RATIO: 0.72,
	PLAY_ICON_FILL: "#FFFFFF",
	CONTROL_PADDING: 8,
	CONTROL_GAP: 8,
	CONTROL_BUTTON_SIZE: IMAGE_CONFIG.INFO_BUTTON_SIZE,
	CONTROL_BUTTON_BG: COLORS.BUTTON_BG,
	CONTROL_BUTTON_BG_HOVER: COLORS.BUTTON_BG_HOVER,
	CONTROL_TEXT_COLOR: "#FFFFFF",
	CONTROL_TEXT_BG: "rgba(0, 0, 0, 0.64)",
	CONTROL_TEXT_FONT_SIZE: LAYOUT.TEXT_FONT_SIZE,
	CONTROL_TEXT_FONT_FAMILY: LAYOUT.TEXT_FONT_FAMILY,
	CONTROL_TEXT_PADDING_X: LAYOUT.TEXT_PADDING_X,
	CONTROL_TEXT_PADDING_Y: LAYOUT.TEXT_PADDING_Y,
	/** 与 VideoFullscreenOverlay `.spinner` 动画周期一致 */
	BUFFER_SPINNER_PERIOD_MS: 800,
} as const
