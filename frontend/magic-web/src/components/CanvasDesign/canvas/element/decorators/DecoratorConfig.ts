/**
 * 装饰器通用配置
 */
export const DECORATOR_CONFIG = {
	/** 边框宽度（像素） */
	BORDER_WIDTH: 1.2,
} as const

/**
 * 装饰器颜色配置
 */
export const DECORATOR_COLORS = {
	/** 默认边框颜色 */
	BORDER_DEFAULT: "#E5E5E5",
	/** 渐变边框起始颜色 */
	GRADIENT_START: "#3F8FFF",
	/** 渐变边框结束颜色 */
	GRADIENT_END: "#EF2FDF",
} as const

/**
 * 装饰器布局和样式配置
 */
export const DECORATOR_LAYOUT = {
	/** 渐变边框角度（度） */
	GRADIENT_ANGLE: 128,
	/** 渐变起始位置（0-1 之间的值，对应 5.59%） */
	GRADIENT_START_STOP: 0.0559,
	/** 渐变结束位置（0-1 之间的值，对应 95.08%） */
	GRADIENT_END_STOP: 0.9508,
	/** 边框旋转动画速度（度/毫秒），完整旋转一圈约需 20 秒 */
	ANIMATION_ROTATION_SPEED: 0.05,
} as const
