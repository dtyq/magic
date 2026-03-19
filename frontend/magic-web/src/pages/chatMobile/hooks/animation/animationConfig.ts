// 移动端聊天页面动画配置
export const CHAT_MOBILE_ANIMATION = {
	// 对话页面滑动动画
	CONVERSATION: {
		duration: 300,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
		direction: "right" as const,
	},

	// 模态框动画
	MODAL: {
		duration: 200,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
		type: "fade" as const,
	},

	// 底部弹出动画
	BOTTOM_SHEET: {
		duration: 250,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
		type: "slideUp" as const,
	},

	// 侧边栏滑动动画
	SIDEBAR: {
		duration: 280,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
		direction: "left" as const,
	},
} as const

// 通用动画缓动函数
export const EASING = {
	// 标准缓动
	STANDARD: "cubic-bezier(0.4, 0, 0.2, 1)",
	// 快速进入
	DECELERATE: "cubic-bezier(0.0, 0, 0.2, 1)",
	// 快速退出
	ACCELERATE: "cubic-bezier(0.4, 0, 1, 1)",
	// 弹性
	SPRING: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const

// 通用动画持续时间
export const DURATION = {
	FAST: 150,
	NORMAL: 200,
	SLOW: 300,
	VERY_SLOW: 500,
} as const
