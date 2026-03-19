/**
 * View Transition API 类型定义
 */

// View Transition API 类型已在全局定义中，这里不需要重复声明

/**
 * View Transition 动画类型
 */
export type ViewTransitionType = "fade" | "slide" | "scale" | "flip" | "custom"

/**
 * 滑动方向
 */
export type ViewTransitionDirection = "left" | "right" | "up" | "down"

/**
 * View Transition 配置选项
 */
export interface ViewTransitionConfig {
	/** 是否启用 View Transition */
	enabled?: boolean
	/** 过渡动画类型 */
	type?: ViewTransitionType
	/** 滑动方向（当 type 为 'slide' 时有效） */
	direction?: ViewTransitionDirection
	/** 动画持续时间（毫秒） */
	duration?: number
	/** 缓动函数 */
	easing?: string
	/** View Transition 名称（用于 CSS 选择器） */
	name?: string
	/** 降级回调函数（当浏览器不支持时调用） */
	fallback?: () => void
	/** 动画开始前的回调 */
	onStart?: () => void
	/** 动画完成后的回调 */
	onComplete?: () => void
	/** 动画被跳过时的回调 */
	onSkip?: () => void
}

/**
 * 扩展的导航选项，包含 View Transition 支持
 */
export interface EnhancedNavigateOptions {
	/** React Router 原生选项 */
	replace?: boolean
	state?: any
	relative?: "route" | "path"
	preventScrollReset?: boolean
	/** View Transition 配置 */
	viewTransition?: boolean | ViewTransitionConfig
}

/**
 * View Transition 状态
 */
export interface ViewTransitionState {
	/** 是否正在进行过渡 */
	isTransitioning: boolean
	/** 当前过渡类型 */
	type?: ViewTransitionType
	/** 过渡名称 */
	name?: string
	/** 过渡是否已准备好 */
	isReady: boolean
	/** 过渡是否已完成 */
	isFinished: boolean
}

/**
 * View Transition 上下文
 */
export interface ViewTransitionContextValue {
	/** 当前状态 */
	state: ViewTransitionState
	/** 启动过渡动画 */
	startTransition: (
		callback: () => void | Promise<void>,
		config?: ViewTransitionConfig,
	) => Promise<void>
	/** 跳过当前过渡 */
	skipTransition: () => void
	/** 检查浏览器是否支持 View Transition API */
	isSupported: boolean
}

/**
 * 预定义的动画配置
 */
export const ViewTransitionPresets = {
	// 淡入淡出
	fade: {
		type: "fade" as const,
		duration: 300,
		easing: "ease-in-out",
	},
	// 左滑
	slideLeft: {
		type: "slide" as const,
		direction: "left" as const,
		duration: 300,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
	},
	// 右滑
	slideRight: {
		type: "slide" as const,
		direction: "right" as const,
		duration: 300,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
	},
	// 上滑
	slideUp: {
		type: "slide" as const,
		direction: "up" as const,
		duration: 300,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
	},
	// 下滑
	slideDown: {
		type: "slide" as const,
		direction: "down" as const,
		duration: 300,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
	},
	// 缩放
	scale: {
		type: "scale" as const,
		duration: 250,
		easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
	},
	// 翻转
	flip: {
		type: "flip" as const,
		duration: 400,
		easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
	},
} as const
