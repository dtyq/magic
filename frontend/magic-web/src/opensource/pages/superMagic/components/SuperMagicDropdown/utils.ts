import { MenuProps } from "antd"

// 位置信息接口
export interface Position {
	top: number
	left: number
}

// 视口尺寸接口
export interface ViewportSize {
	width: number
	height: number
}

// 下拉菜单尺寸配置
export interface DropdownSizeConfig {
	width?: number
	menuItems?: MenuProps["items"]
	itemHeight?: number
	padding?: number
	minWidth?: number
	maxWidth?: number
}

// 常量定义
export const DROPDOWN_CONSTANTS = {
	DEFAULT_WIDTH: 200,
	DEFAULT_ITEM_HEIGHT: 32,
	DEFAULT_PADDING: 16,
	DEFAULT_MARGIN: 8,
} as const

/**
 * 获取当前视口尺寸
 */
export function getViewportSize(): ViewportSize {
	return {
		width: window.innerWidth,
		height: window.innerHeight,
	}
}

/**
 * 获取下拉菜单尺寸（优先使用DOM测量，回退到估算）
 */
export function getDropdownSize(config: DropdownSizeConfig): { width: number; height: number } {
	const {
		width,
		menuItems,
		itemHeight = DROPDOWN_CONSTANTS.DEFAULT_ITEM_HEIGHT,
		padding = DROPDOWN_CONSTANTS.DEFAULT_PADDING,
		minWidth = DROPDOWN_CONSTANTS.DEFAULT_WIDTH,
	} = config

	const estimatedWidth = width || minWidth

	// 1. 尝试从已存在的DOM获取实际尺寸
	const existingSize = measureDropdownFromDOM()
	if (existingSize) {
		return existingSize
	}

	// 2. 回退到估算方式
	const estimatedHeight = calculateMenuHeight(menuItems, itemHeight, padding)

	return {
		width: estimatedWidth,
		height: estimatedHeight,
	}
}

/**
 * 从DOM中测量现有的下拉菜单尺寸
 */
function measureDropdownFromDOM(): { width: number; height: number } | null {
	// 查找当前页面中的 Antd Dropdown 菜单
	const dropdownMenu = document.querySelector('.ant-dropdown:not([style*="display: none"])')

	if (dropdownMenu) {
		const rect = dropdownMenu.getBoundingClientRect()

		if (rect.width > 0 && rect.height > 0) {
			return {
				width: rect.width,
				height: rect.height,
			}
		}
	}

	return null
}

/**
 * 通过观察者模式监听下拉菜单的渲染并获取尺寸
 */
export function observeDropdownMenu(
	callback: (size: { width: number; height: number }) => void,
): () => void {
	let observer: MutationObserver | null = null

	const checkForDropdown = () => {
		const dropdown = document.querySelector('.ant-dropdown:not([style*="display: none"])')
		if (dropdown) {
			const rect = dropdown.getBoundingClientRect()
			if (rect.width > 0 && rect.height > 0) {
				callback({
					width: Math.ceil(rect.width),
					height: Math.ceil(rect.height),
				})
				return true
			}
		}
		return false
	}

	// 立即检查
	if (!checkForDropdown()) {
		// 如果没有找到，设置观察者
		observer = new MutationObserver(() => {
			if (checkForDropdown() && observer) {
				observer.disconnect()
				observer = null
			}
		})

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["style", "class"],
		})
	}

	// 返回清理函数
	return () => {
		if (observer) {
			observer.disconnect()
			observer = null
		}
	}
}

/**
 * 根据菜单项内容计算实际菜单高度
 */
export function calculateMenuHeight(
	menuItems: MenuProps["items"] | undefined,
	itemHeight: number = DROPDOWN_CONSTANTS.DEFAULT_ITEM_HEIGHT,
	basePadding: number = 8, // 基础 padding
): number {
	if (!menuItems || menuItems.length === 0) {
		return itemHeight + basePadding
	}

	let totalHeight = 0
	let actualItemCount = 0

	// 遍历菜单项计算高度
	for (const item of menuItems) {
		if (!item) continue // 跳过 null 项

		actualItemCount++ // 计算实际菜单项数量

		if (item.type === "divider") {
			// 分隔线高度 (Antd 分隔线实际高度 + margin)
			totalHeight += 9
		} else if (item.type === "group") {
			// 分组标题高度
			totalHeight += 24
			// 递归计算子项高度
			if ("children" in item && item.children) {
				totalHeight += calculateMenuHeight(item.children, itemHeight, 0)
			}
		} else {
			// 普通菜单项高度 (Antd 菜单项实际高度)
			totalHeight += 32
		}
	}

	// 加上菜单容器的各种边距和 padding
	// 1. 菜单容器上下 padding: 4px + 4px = 8px
	// 2. 菜单项之间的间距: 每个菜单项可能有 margin-bottom
	// 3. 菜单容器的边框和阴影占用的空间
	const extraSpacing = calculateExtraMenuSpacing(actualItemCount)
	totalHeight += basePadding + extraSpacing

	return totalHeight
}

/**
 * 计算菜单额外间距
 */
function calculateExtraMenuSpacing(itemCount: number): number {
	// 基于观察到的10px差异，分析可能的来源：
	// 1. 菜单项之间的间距 (每个菜单项可能有 margin-bottom: 4px，但最后一个没有)
	// 2. 菜单容器的边框和阴影
	// 3. 其他未计算的样式

	if (itemCount <= 1) {
		return 10 // 基础额外间距
	}

	// 菜单项间距：(itemCount - 1) * 4px，因为最后一个菜单项没有 margin-bottom
	const itemSpacing = Math.max(0, (itemCount - 1) * 4)

	// 基础容器间距：边框、阴影等
	const containerSpacing = 6

	return itemSpacing + containerSpacing
}

/**
 * 检查位置是否超出边界
 */
export function checkBoundary(
	position: Position,
	size: { width: number; height: number },
	viewport: ViewportSize,
) {
	const margin = DROPDOWN_CONSTANTS.DEFAULT_MARGIN

	return {
		overflowRight: position.left + size.width > viewport.width - margin,
		overflowBottom: position.top + size.height > viewport.height - margin,
		overflowLeft: position.left < margin,
		overflowTop: position.top < margin,
	}
}

/**
 * 调整位置以避免超出边界
 */
export function adjustPositionForBoundary(
	targetPosition: Position,
	size: { width: number; height: number },
	viewport: ViewportSize,
): Position {
	const margin = DROPDOWN_CONSTANTS.DEFAULT_MARGIN

	let { top, left } = targetPosition

	// 检查右边界，如果超出则向左调整
	if (left + size.width > viewport.width - margin) {
		left = targetPosition.left - size.width
		// 如果还是超出左边界，则贴着右边界
		if (left < margin) {
			left = viewport.width - size.width - margin
		}
	}

	// 检查下边界，如果超出则向上调整
	if (top + size.height > viewport.height - margin) {
		// 让菜单底部对齐到原始点击位置，而不是顶部
		top = targetPosition.top - size.height
		// 如果向上还是超出，则贴着下边界
		if (top < margin) {
			top = viewport.height - size.height - margin
		}
	}

	// 确保不超出左边界和上边界
	left = Math.max(margin, left)
	top = Math.max(margin, top)

	return { top, left }
}

/**
 * 计算下拉菜单的最佳位置
 */
export function calculateDropdownPosition(
	targetTop: number,
	targetLeft: number,
	sizeConfig: DropdownSizeConfig,
): Position {
	const viewport = getViewportSize()
	const size = getDropdownSize(sizeConfig)
	const targetPosition = { top: targetTop, left: targetLeft }

	return adjustPositionForBoundary(targetPosition, size, viewport)
}

/**
 * 从元素获取位置信息
 */
export function getElementPosition(
	element: Element,
	placement: "bottom-left" | "bottom-right" | "top-left" | "top-right" = "bottom-left",
): Position {
	const rect = element.getBoundingClientRect()

	switch (placement) {
		case "bottom-left":
			return { top: rect.bottom, left: rect.left }
		case "bottom-right":
			return { top: rect.bottom, left: rect.right }
		case "top-left":
			return { top: rect.top, left: rect.left }
		case "top-right":
			return { top: rect.top, left: rect.right }
		default:
			return { top: rect.bottom, left: rect.left }
	}
}

/**
 * 专门处理右键菜单的位置计算
 */
export function calculateContextMenuPosition(
	mouseX: number,
	mouseY: number,
	sizeConfig: DropdownSizeConfig,
): Position {
	const viewport = getViewportSize()
	const size = getDropdownSize(sizeConfig)
	const margin = DROPDOWN_CONSTANTS.DEFAULT_MARGIN

	// 计算四个可能的位置
	const positions = {
		// 默认位置：鼠标右下（菜单底部对齐鼠标位置，向下偏移20px）
		bottomRight: { top: mouseY - size.height + 20, left: mouseX },
		// 鼠标左下（菜单底部对齐鼠标位置，向下偏移20px）
		bottomLeft: { top: mouseY - size.height + 20, left: mouseX - size.width },
		// 鼠标右上（菜单顶部对齐鼠标位置）
		topRight: { top: mouseY, left: mouseX },
		// 鼠标左上（菜单顶部对齐鼠标位置）
		topLeft: { top: mouseY, left: mouseX - size.width },
	}

	// 检查每个位置是否在边界内
	const checkPosition = (pos: Position) => {
		return (
			pos.left >= margin &&
			pos.left + size.width <= viewport.width - margin &&
			pos.top >= margin &&
			pos.top + size.height <= viewport.height - margin
		)
	}

	// 优先级顺序：右上（菜单在鼠标下方）-> 左上（菜单在鼠标下方）-> 右下（菜单在鼠标上方）-> 左下（菜单在鼠标上方）
	const preferredOrder = ["topRight", "topLeft", "bottomRight", "bottomLeft"] as const

	// 找到第一个符合条件的位置
	for (const positionKey of preferredOrder) {
		const position = positions[positionKey]
		if (checkPosition(position)) {
			return position
		}
	}

	// 如果所有位置都不符合，使用备选逻辑
	// 默认：菜单顶部对齐鼠标位置，菜单在鼠标右下方
	let top = mouseY
	let left = mouseX

	// 检查右边界，如果超出则向左调整
	if (left + size.width > viewport.width - margin) {
		left = mouseX - size.width
		// 如果还是超出左边界，则贴着右边界
		if (left < margin) {
			left = viewport.width - size.width - margin
		}
	}

	// 检查下边界，如果超出则向上调整
	if (top + size.height > viewport.height - margin) {
		// 如果向下超出，则让菜单底部对齐鼠标位置（菜单在鼠标上方，向下偏移20px）
		top = mouseY - size.height + 20
		// 如果向上还是超出，则贴着上边界
		if (top < margin) {
			top = margin
		}
	}

	// 确保不超出边界
	left = Math.max(margin, Math.min(left, viewport.width - size.width - margin))
	top = Math.max(margin, Math.min(top, viewport.height - size.height - margin))

	return { top, left }
}

/**
 * 智能选择最佳的 placement
 */
export function selectBestPlacement(
	element: Element,
	sizeConfig: DropdownSizeConfig,
	config?: {
		preferredPlacements?: ("bottom-left" | "bottom-right" | "top-left" | "top-right")[]
		fallbackToAnyPlacement?: boolean
		minMargin?: number
	},
): "bottom-left" | "bottom-right" | "top-left" | "top-right" {
	const viewport = getViewportSize()
	const size = getDropdownSize(sizeConfig)
	const rect = element.getBoundingClientRect()
	const margin = config?.minMargin ?? DROPDOWN_CONSTANTS.DEFAULT_MARGIN

	// 默认的 placement 优先级顺序
	const defaultOrder: ("bottom-left" | "bottom-right" | "top-left" | "top-right")[] = [
		"bottom-left",
		"bottom-right",
		"top-left",
		"top-right",
	]

	// 使用用户配置的优先级顺序，或使用默认顺序
	const preferredOrder = config?.preferredPlacements ?? defaultOrder

	// 计算所有可能的 placement 位置
	const allPlacements = {
		"bottom-left": { top: rect.bottom, left: rect.left },
		"bottom-right": { top: rect.bottom, left: rect.right - size.width },
		"top-left": { top: rect.top - size.height, left: rect.left },
		"top-right": { top: rect.top - size.height, left: rect.right - size.width },
	}

	// 按照首选顺序检查每个 placement 是否在边界内
	for (const placement of preferredOrder) {
		const position = allPlacements[placement]
		const isValid =
			position.left >= margin &&
			position.left + size.width <= viewport.width - margin &&
			position.top >= margin &&
			position.top + size.height <= viewport.height - margin

		if (isValid) {
			return placement
		}
	}

	// 如果首选的 placement 都不可用，根据配置决定是否回退
	if (config?.fallbackToAnyPlacement !== false) {
		// 计算所有 placement 的溢出分数，选择溢出最少的
		const placementScores = Object.entries(allPlacements).map(([type, position]) => {
			const boundary = checkBoundary(position, size, viewport)

			// 计算溢出分数（越小越好）
			let score = 0
			if (boundary.overflowRight)
				score += position.left + size.width - (viewport.width - margin)
			if (boundary.overflowBottom)
				score += position.top + size.height - (viewport.height - margin)
			if (boundary.overflowLeft) score += margin - position.left
			if (boundary.overflowTop) score += margin - position.top

			return {
				type: type as "bottom-left" | "bottom-right" | "top-left" | "top-right",
				score,
			}
		})

		// 返回溢出分数最小的 placement
		const bestFallback = placementScores.sort((a, b) => a.score - b.score)[0]
		return bestFallback.type
	}

	// 如果不允许回退，返回第一个首选的 placement
	return preferredOrder[0]
}

/**
 * 通用的事件处理器工厂 - 泛型支持（原有版本，保持向后兼容）
 */
export function createEventHandler<T = any>(
	onPositionCalculated: (position: Position, itemData: T) => void,
	sizeConfig: DropdownSizeConfig,
) {
	return {
		/**
		 * 处理元素点击事件
		 */
		handleElementClick: (
			event: React.MouseEvent<HTMLElement>,
			placement: "bottom-left" | "bottom-right" | "top-left" | "top-right" = "bottom-left",
			itemData: T,
		) => {
			event.stopPropagation()
			event.preventDefault()

			const position = getElementPosition(event.currentTarget, placement)
			const calculatedPosition = calculateDropdownPosition(
				position.top,
				position.left,
				sizeConfig,
			)

			onPositionCalculated(calculatedPosition, itemData)
		},

		/**
		 * 处理右键菜单事件
		 */
		handleContextMenu: (event: React.MouseEvent<HTMLElement>, itemData: T) => {
			event.stopPropagation()
			event.preventDefault()

			const calculatedPosition = calculateContextMenuPosition(
				event.clientX,
				event.clientY,
				sizeConfig,
			)

			onPositionCalculated(calculatedPosition, itemData)
		},
	}
}

/**
 * 增强的元素点击处理器，自动选择最佳 placement
 */
export function createSmartEventHandler<T = any>(
	onPositionCalculated: (position: Position, itemData: T) => void,
	sizeConfig: DropdownSizeConfig,
	smartConfig?: {
		preferredPlacements?: ("bottom-left" | "bottom-right" | "top-left" | "top-right")[]
		fallbackToAnyPlacement?: boolean
		minMargin?: number
	},
) {
	return {
		/**
		 * 处理元素点击事件 - 智能选择 placement
		 */
		handleElementClick: (
			event: React.MouseEvent<HTMLElement>,
			_preferredPlacement:
				| "bottom-left"
				| "bottom-right"
				| "top-left"
				| "top-right" = "bottom-left",
			itemData: T,
		) => {
			event.stopPropagation()
			event.preventDefault()

			// 智能选择最佳 placement
			const bestPlacement = selectBestPlacement(event.currentTarget, sizeConfig, smartConfig)

			// 直接使用智能选择中计算的位置，避免重复计算

			const rect = event.currentTarget.getBoundingClientRect()
			const size = getDropdownSize(sizeConfig)

			let position: Position
			switch (bestPlacement) {
				case "bottom-left":
					position = { top: rect.bottom, left: rect.left }
					break
				case "bottom-right":
					position = { top: rect.bottom, left: rect.right - size.width }
					break
				case "top-left":
					position = { top: rect.top + rect.height - size.height, left: rect.left }
					break
				case "top-right":
					position = {
						top: rect.top + rect.height - size.height,
						left: rect.right - size.width,
					}
					break
				default:
					position = { top: rect.bottom, left: rect.left }
			}

			// 应用边界调整
			const calculatedPosition = calculateDropdownPosition(
				position.top,
				position.left,
				sizeConfig,
			)

			onPositionCalculated(calculatedPosition, itemData)
		},

		/**
		 * 处理右键菜单事件
		 */
		handleContextMenu: (event: React.MouseEvent<HTMLElement>, itemData: T) => {
			event.stopPropagation()
			event.preventDefault()

			const calculatedPosition = calculateContextMenuPosition(
				event.clientX,
				event.clientY,
				sizeConfig,
			)

			onPositionCalculated(calculatedPosition, itemData)
		},
	}
}
