// 布局常量
export const LAYOUT_CONSTANTS = {
	MAIN_MIN_WIDTH_WITH_TOPIC: 600,
	MAIN_MIN_WIDTH_WITHOUT_TOPIC: 400,
	FILE_PREVIEW_RATIO: 0.4,
	MAIN_PANEL_RATIO: 0.6,
	WINDOW_MARGIN: 100,
} as const

// 面板索引枚举
export const enum PanelIndex {
	Sider = 0,
	Main = 1,
	FilePreview = 2,
}

// 计算面板尺寸的工具函数
export const calculatePanelSizes = {
	// 计算主面板最小宽度
	getMainMinWidth: (hasTopicOpen: boolean): number => {
		return hasTopicOpen
			? LAYOUT_CONSTANTS.MAIN_MIN_WIDTH_WITH_TOPIC
			: LAYOUT_CONSTANTS.MAIN_MIN_WIDTH_WITHOUT_TOPIC
	},

	// 计算两面板布局
	getTwoPanelSizes: (totalWidth: number, siderWidth: number): [number, number] => {
		return [siderWidth, totalWidth - siderWidth]
	},

	// 计算三面板布局（包含文件预览）
	getThreePanelSizes: (
		totalWidth: number,
		siderWidth: number,
		filePreviewWidth: number,
		mainMinWidth: number,
	): [number, number, number] => {
		const remainingWidth = totalWidth - siderWidth
		const adjustedMainWidth = Math.max(remainingWidth - filePreviewWidth, mainMinWidth)
		const adjustedFilePreviewWidth = totalWidth - siderWidth - adjustedMainWidth

		return [siderWidth, adjustedMainWidth, adjustedFilePreviewWidth]
	},

	// 计算文件预览打开时的默认布局
	getFilePreviewOpenSizes: (totalWidth: number, siderWidth: number): [number, number, number] => {
		const availableWidth = totalWidth - siderWidth
		const mainWidth = availableWidth * LAYOUT_CONSTANTS.MAIN_PANEL_RATIO
		const filePreviewWidth = availableWidth * LAYOUT_CONSTANTS.FILE_PREVIEW_RATIO

		return [siderWidth, mainWidth, filePreviewWidth]
	},

	// 处理侧边栏调整时的尺寸重计算
	handleSiderResize: (
		prevSizes: (number | undefined)[],
		newSizes: number[],
		totalWidth: number,
		mainMinWidth: number,
	): (number | undefined)[] => {
		// 两面板模式
		if (newSizes.length === 2) {
			return newSizes
		}

		// 三面板模式
		if (newSizes.length === 3) {
			const [newSiderWidth, , newFilePreviewWidth] = newSizes
			const [prevSiderWidth, , prevFilePreviewWidth] = prevSizes

			// 侧边栏宽度未变，调整的是文件预览面板
			if (prevSiderWidth === newSiderWidth) {
				return calculatePanelSizes.getThreePanelSizes(
					totalWidth,
					newSiderWidth,
					newFilePreviewWidth,
					mainMinWidth,
				)
			}

			// 文件预览宽度未变，调整的是侧边栏
			if (prevFilePreviewWidth === newFilePreviewWidth) {
				return calculatePanelSizes.getThreePanelSizes(
					totalWidth,
					newSiderWidth,
					newFilePreviewWidth,
					mainMinWidth,
				)
			}

			// 默认重新计算
			return calculatePanelSizes.getThreePanelSizes(
				totalWidth,
				newSiderWidth,
				newFilePreviewWidth,
				mainMinWidth,
			)
		}

		return prevSizes
	},
}

// 默认导出，方便使用
export default calculatePanelSizes
