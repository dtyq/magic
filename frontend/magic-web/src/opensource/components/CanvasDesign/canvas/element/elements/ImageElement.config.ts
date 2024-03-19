/**
 * 图片元素相关配置
 */
export const IMAGE_CONFIG = {
	/** 默认宽度（像素） */
	DEFAULT_WIDTH: 1024,
	/** 默认高度（像素） */
	DEFAULT_HEIGHT: 1024,
	/** 占位符图标尺寸（像素） */
	ICON_SIZE: 48,
	/** Info 按钮尺寸（像素） */
	INFO_BUTTON_SIZE: 24,
	/** Info 按钮内图标尺寸（像素） */
	INFO_ICON_SIZE: 16,
	/** 圆角半径（像素） */
	CORNER_RADIUS: 8,
	/** 按钮距离边缘的偏移量（像素） */
	OFFSET: 8,
	/** 图片生成结果轮询间隔（毫秒） */
	POLLING_INTERVAL: 5000,
	/** hover 事件延迟检查时间（毫秒），用于避免快速移动时的闪烁 */
	HOVER_DELAY: 50,
	/** 图片元素在屏幕上的最小尺寸阈值（像素），小于此值时隐藏 info 按钮 */
	MIN_ELEMENT_SCREEN_SIZE_FOR_INFO_BUTTON: 60,
} as const

/**
 * 颜色配置
 */
export const COLORS = {
	/** 空状态文本颜色 */
	EMPTY_TEXT: "#737373",
	/** 加载状态文本颜色 */
	LOADING_TEXT: "#0A0A0A",
	/** 错误文本颜色 */
	ERROR_TEXT: "#737373",
	/** 错误重试按钮颜色 */
	ERROR_RETRY_TEXT: "#2563EB",
	/** 错误重试按钮 hover 透明度 */
	ERROR_RETRY_HOVER_OPACITY: 0.7,
	/** Info 按钮背景颜色 */
	BUTTON_BG: "rgba(0, 0, 0, 0.70)",
	/** Info 按钮 hover 状态背景颜色 */
	BUTTON_BG_HOVER: "rgba(0, 0, 0, 0.85)",
	/** 加载状态文本背景颜色 */
	LOADING_BG: "rgba(255, 255, 255, 0.30)",
} as const

/**
 * 布局和样式配置
 */
export const LAYOUT = {
	/** 文本水平内边距（像素） */
	TEXT_PADDING_X: 8,
	/** 文本垂直内边距（像素） */
	TEXT_PADDING_Y: 4,
	/** 文本字体大小（像素） */
	TEXT_FONT_SIZE: 12,
	/** 文本字体族 */
	TEXT_FONT_FAMILY: "Arial, sans-serif",
	/** 图标和文本之间的间距（像素） */
	ICON_TEXT_SPACING: 10,
	/** Info 按钮最小屏幕像素偏移量（像素） */
	MIN_SCREEN_OFFSET: 4,
	/** Info 按钮最大屏幕像素偏移量（像素） */
	MAX_SCREEN_OFFSET: 8,
	/** 内容最小屏幕尺寸阈值（像素），小于此值时开始缩小内容 */
	MIN_CONTENT_SCREEN_SIZE: 150,
	/** 内容最小缩放比例，防止内容过小看不清 */
	MIN_CONTENT_SCALE: 0.3,
} as const
