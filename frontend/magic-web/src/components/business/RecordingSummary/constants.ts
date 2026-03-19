// PC端和移动端尺寸常量
export const SIZES = {
	PC: {
		COLLAPSED: { width: 380, height: 42 },
		EXPANDED: { width: "100vw", height: "100vh", maxWidth: "100vw" },
		SAFE_MARGIN: 10,
	},
	MOBILE: {
		COLLAPSED: { width: 46, height: 46 },
		EXPANDED: { width: 420, height: 600 }, // 实际会被CSS的max-width/max-height限制
		SAFE_MARGIN: 8,
	},
	HEADER_HEIGHT: 80,
	FOOTER_HEIGHT: 100,
	MESSAGE_MAX_HEIGHT: 430,
}

// 兼容性：保持原有的导出格式（PC端）
export const COLLAPSED = SIZES.PC.COLLAPSED
export const EXPANDED = SIZES.PC.EXPANDED
export const SAFE_MARGIN = SIZES.PC.SAFE_MARGIN
