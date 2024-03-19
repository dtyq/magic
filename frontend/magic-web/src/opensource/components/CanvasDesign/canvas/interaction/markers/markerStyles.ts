/**
 * 标记通用样式
 */
export const MARKER_COMMON_STYLES = {
	// 文字样式
	TEXT_COLOR: "#FFFFFF",
	TEXT_FONT_SIZE: 14,
	TEXT_FONT_WEIGHT: "600",
	TEXT_FONT_FAMILY: "Arial, sans-serif",
	TEXT_LINE_HEIGHT: 1,

	// 边框样式
	STROKE_WIDTH: 2,
	STROKE_COLOR: "#FFFFFF",

	// 填充颜色
	FILL_COLOR: "#000000",
} as const

/**
 * 点标记样式
 */
export const POINT_MARKER_STYLES = {
	// 尺寸
	WIDTH: 26.5,
	HEIGHT: 32,

	...MARKER_COMMON_STYLES,
} as const

/**
 * 区域标记样式
 */
export const AREA_MARKER_STYLES = {
	// 圆圈尺寸
	CIRCLE_DIAMETER: 24,
	CIRCLE_RADIUS: 12,

	// 区域矩形样式
	AREA_STROKE_WIDTH: 2,
	AREA_STROKE_COLOR: "#FAFAFA",
	AREA_FILL_COLOR: "rgba(23, 23, 23, 0.30)",
	AREA_CORNER_RADIUS: 6,

	...MARKER_COMMON_STYLES,
} as const
