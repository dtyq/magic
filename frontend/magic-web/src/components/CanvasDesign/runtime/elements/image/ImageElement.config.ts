/**
 * 图片元素相关配置
 */
export const IMAGE_CONFIG = {
	/** 图片等待超过 10 分钟可重新生成；不代表后台任务已取消。 */
	GENERATION_TIMEOUT_MS: 10 * 60 * 1000,
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
	/** 废稿静态展示强度；悬浮时仅恢复图片内容节点，原图与角标不变。 */
	DISCARDED_OPACITY: 0.55,
	/** 生成进度后缀的测量探针：取最长形态，保证百分比位数变化时胶囊宽度不跳动 */
	PROGRESS_TEXT_PROBE: "100%",
	/** 生成进度推进间隔（毫秒）；估算精度远低于 1 秒，不需要更密的刷新 */
	PROGRESS_TICK_INTERVAL: 1000,
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
	/** 废稿是人工取舍，使用独立角标，不覆盖原主版本或生成状态。 */
	DISCARDED_TAG_BG: "#DC2626",
	/** 保持不同底图上的标签边界和图标对比度。 */
	DISCARDED_TAG_BORDER: "#FFFFFF",
	/** 加载状态文本背景颜色 */
	LOADING_BG: "rgba(255, 255, 255, 0.30)",
} as const

/**
 * 布局和样式配置
 */
export const LAYOUT = {
	/** 废稿小标签中的图标与文字间距（屏幕像素）。 */
	DISCARDED_ICON_TEXT_GAP: 4,
	/** 废稿角标宽高各不超过图片屏幕尺寸的此比例，正常尺寸不放大。 */
	DISCARDED_TAG_MAX_IMAGE_RATIO: 0.2,
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

/**
 * 将元素内边距限制在统一的屏幕像素范围内。
 * 返回值为元素局部坐标，调用方仍需结合自身缩放进行定位。
 */
export function resolveImageControlCanvasOffset(totalScale: number): number {
	const baseCanvasOffset = IMAGE_CONFIG.OFFSET
	if (!Number.isFinite(totalScale) || totalScale <= 0) return baseCanvasOffset

	const screenOffset = baseCanvasOffset * totalScale
	if (screenOffset > LAYOUT.MAX_SCREEN_OFFSET) {
		return LAYOUT.MAX_SCREEN_OFFSET / totalScale
	}
	if (screenOffset < LAYOUT.MIN_SCREEN_OFFSET) {
		return LAYOUT.MIN_SCREEN_OFFSET / totalScale
	}
	return baseCanvasOffset
}
