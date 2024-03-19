/**
 * 面包屑宽度计算相关工具函数
 * 用于根据容器宽度动态计算可显示的面包屑项
 */

// 宽度计算相关常量
export const BREADCRUMB_SEPARATOR_WIDTH = 26 // IconChevronRight: 18px + margin 0 4px = 26px
export const BREADCRUMB_ELLIPSIS_WIDTH = 24 // 省略号按钮固定宽度
export const BREADCRUMB_LOCK_ICON_WIDTH = 16 // 锁图标宽度 (12px + margin 4px)
export const BREADCRUMB_MIN_ITEM_WIDTH = 60 // 单个项的最小宽度
export const BREADCRUMB_PADDING_BUFFER = 40 // 额外的安全缓冲（增加以适应实际渲染）
export const BREADCRUMB_MAX_TEXT_WIDTH = 400 // name 样式最大宽度

// 创建用于测量文本宽度的 Canvas 上下文（复用以提高性能）
let canvasContext: CanvasRenderingContext2D | null = null

function getCanvasContext(): CanvasRenderingContext2D | null {
	if (!canvasContext) {
		const canvas = document.createElement("canvas")
		canvasContext = canvas.getContext("2d")
		if (canvasContext) {
			// 设置与实际渲染相同的字体样式
			canvasContext.font =
				'14px Inter, "PingFang SC", -apple-system, "system-ui", "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
		}
	}
	return canvasContext
}

/**
 * 使用 Canvas API 精确测量文本的实际渲染宽度
 */
export function measureTextWidth(text: string): number {
	if (!text) return 0

	try {
		const ctx = getCanvasContext()
		if (!ctx) {
			// 降级方案：粗略估算
			return Math.min(text.length * 8, BREADCRUMB_MAX_TEXT_WIDTH)
		}

		const metrics = ctx.measureText(text)
		return Math.min(Math.ceil(metrics.width), BREADCRUMB_MAX_TEXT_WIDTH)
	} catch (error) {
		// 发生错误时使用降级方案
		console.warn("Failed to measure text width:", error)
		return Math.min(text.length * 8, BREADCRUMB_MAX_TEXT_WIDTH)
	}
}

/**
 * 根据实际文本宽度计算面包屑项的宽度
 */
export function estimateBreadcrumbItemWidth(item: { name: string; operation?: string }): number {
	// 使用 Canvas API 精确测量文本宽度
	const textWidth = measureTextWidth(item.name)
	const lockWidth = item.operation ? 0 : BREADCRUMB_LOCK_ICON_WIDTH

	// 总宽度 = 文本宽度 + 锁图标宽度（如果有）
	// 确保不小于最小宽度
	return Math.max(textWidth + lockWidth, BREADCRUMB_MIN_ITEM_WIDTH)
}

/**
 * 面包屑项接口
 */
export interface BreadcrumbItem {
	name: string
	id: string
	operation?: string
	children?: BreadcrumbItem[]
	[key: string]: unknown // 允许其他属性
}

/**
 * 根据可用宽度计算要显示的面包屑项
 * @param items 所有面包屑项
 * @param containerWidth 容器宽度
 * @returns 计算后的显示项数组
 */
export function calculateBreadcrumbDisplayItems(
	items: BreadcrumbItem[],
	containerWidth: number,
): BreadcrumbItem[] {
	// 如果容器宽度尚未测量或项目太少，显示全部
	if (containerWidth === 0 || items.length <= 2) {
		return items
	}

	// 计算显示所有项需要的总宽度
	const itemWidths = items.map(estimateBreadcrumbItemWidth)
	const totalSeparatorsWidth = (items.length - 1) * BREADCRUMB_SEPARATOR_WIDTH
	const totalWidthNeeded =
		itemWidths.reduce((sum, w) => sum + w, 0) + totalSeparatorsWidth + BREADCRUMB_PADDING_BUFFER

	// 如果所有内容都能放下，显示全部
	if (totalWidthNeeded <= containerWidth) {
		return items
	}

	// 需要折叠一些项 - 始终显示首项和末项
	const firstItem = items[0]
	const lastItem = items[items.length - 1]
	const firstItemWidth = itemWidths[0]
	const lastItemWidth = itemWidths[itemWidths.length - 1]

	// 计算中间项的可用宽度
	// 必需：首项 + 分隔符 + 省略号 + 分隔符 + 末项
	const requiredWidth =
		firstItemWidth +
		BREADCRUMB_SEPARATOR_WIDTH +
		BREADCRUMB_ELLIPSIS_WIDTH +
		BREADCRUMB_SEPARATOR_WIDTH +
		lastItemWidth +
		BREADCRUMB_PADDING_BUFFER

	// 如果连 首项 + 省略号 + 末项 都放不下，还是显示它们
	if (requiredWidth >= containerWidth) {
		return [
			firstItem,
			{
				...firstItem,
				name: "...",
				id: "ellipsis",
				children: items.slice(1, -1),
			},
			lastItem,
		]
	}

	// 尝试从开头尽可能多地放入项（在首项之后，末项之前）
	const availableWidth = containerWidth - requiredWidth
	let accumulatedWidth = 0
	let visibleMiddleCount = 0

	// 检查中间项（排除首项和末项）
	for (let i = 1; i < items.length - 1; i++) {
		const itemWidth = itemWidths[i] + BREADCRUMB_SEPARATOR_WIDTH
		if (accumulatedWidth + itemWidth <= availableWidth) {
			accumulatedWidth += itemWidth
			visibleMiddleCount++
		} else {
			break
		}
	}

	// 如果可以显示所有中间项，则不需要省略号
	if (visibleMiddleCount === items.length - 2) {
		return items
	}

	// 构建显示数组：首项 + 可见的中间项 + 省略号 + 末项
	const result: BreadcrumbItem[] = [firstItem]

	// 添加可见的中间项
	for (let i = 1; i <= visibleMiddleCount; i++) {
		result.push(items[i])
	}

	// 添加省略号及其包含的隐藏项
	const hiddenItems = items.slice(visibleMiddleCount + 1, -1)
	if (hiddenItems.length > 0) {
		result.push({
			...firstItem,
			name: "...",
			id: "ellipsis",
			children: hiddenItems,
		})
	}

	// 添加末项
	result.push(lastItem)

	return result
}
