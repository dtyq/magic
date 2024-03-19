import type { Canvas } from "../Canvas"
import type { LayerElement } from "../types"
import { ElementTypeEnum } from "../types"

/**
 * 对齐类型
 */
export type AlignType =
	| "left"
	| "horizontal-center"
	| "right"
	| "top"
	| "vertical-center"
	| "bottom"

/**
 * 分布类型
 */
export type DistributeType = "horizontal-spacing" | "vertical-spacing" | "auto-layout"

/**
 * 对齐和排列管理器
 * 职责：
 * 1. 处理多选元素的对齐操作
 * 2. 处理单选画框内元素的对齐操作
 * 3. 处理多选元素的分布操作
 * 4. 处理单选画框内元素的分布操作
 */
export class AlignmentManager {
	private canvas: Canvas

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
	}

	/**
	 * 执行对齐操作
	 * @param alignType - 对齐类型
	 */
	public align(alignType: AlignType): void {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 场景1: 单选画框，对齐画框内的子元素
		if (selectedIds.length === 1) {
			const elementData = this.canvas.elementManager.getElementData(selectedIds[0])
			if (elementData?.type === ElementTypeEnum.Frame && elementData.children) {
				this.alignFrameChildren(elementData, alignType)
				return
			}
		}

		// 场景2: 多选元素，对齐这些元素
		this.alignElements(selectedIds, alignType)
	}

	/**
	 * 执行分布操作
	 * @param distributeType - 分布类型
	 */
	public distribute(distributeType: DistributeType): void {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 场景1: 单选画框，分布画框内的子元素
		if (selectedIds.length === 1) {
			const elementData = this.canvas.elementManager.getElementData(selectedIds[0])
			if (elementData?.type === ElementTypeEnum.Frame && elementData.children) {
				// 画框内分布考虑边界间距，1个元素即可(居中效果)
				if (elementData.children.length < 1) return
				this.distributeFrameChildren(elementData, distributeType)
				return
			}
		}

		// 场景2: 多选元素，分布这些元素
		if (selectedIds.length < 3) return // 至少需要3个元素
		this.distributeElements(selectedIds, distributeType)
	}

	/**
	 * 对齐多个选中的元素
	 */
	private alignElements(elementIds: string[], alignType: AlignType): void {
		const elements = elementIds
			.map((id) => this.canvas.elementManager.getElementData(id))
			.filter((el): el is LayerElement => {
				// 使用 PermissionManager 统一判断：过滤掉不存在、不可见或锁定的元素
				return el !== undefined && this.canvas.permissionManager.canAlign(el)
			})

		if (elements.length === 0) return

		// 计算边界框
		const bounds = this.calculateBounds(elements)

		// 根据对齐类型更新元素位置
		elements.forEach((element) => {
			const width = element.width || 0
			const height = element.height || 0

			let newX = element.x
			let newY = element.y

			switch (alignType) {
				case "left":
					newX = bounds.minX
					break
				case "horizontal-center":
					newX = bounds.centerX - width / 2
					break
				case "right":
					newX = bounds.maxX - width
					break
				case "top":
					newY = bounds.minY
					break
				case "vertical-center":
					newY = bounds.centerY - height / 2
					break
				case "bottom":
					newY = bounds.maxY - height
					break
			}

			this.canvas.elementManager.update(element.id, {
				x: newX,
				y: newY,
			})
		})
	}

	/**
	 * 对齐画框内的子元素
	 */
	private alignFrameChildren(frameElement: LayerElement, alignType: AlignType): void {
		if (!("children" in frameElement) || !frameElement.children) return

		// 使用 PermissionManager 统一判断元素是否可以参与对齐操作
		const children = frameElement.children.filter((child) =>
			this.canvas.permissionManager.canAlign(child),
		)

		if (children.length === 0) return

		// 计算子元素的边界框（相对于画框）
		const bounds = this.calculateBounds(children)

		// 根据对齐类型更新子元素位置
		children.forEach((child) => {
			const width = child.width || 0
			const height = child.height || 0

			let newX = child.x
			let newY = child.y

			switch (alignType) {
				case "left":
					newX = bounds.minX
					break
				case "horizontal-center":
					newX = bounds.centerX - width / 2
					break
				case "right":
					newX = bounds.maxX - width
					break
				case "top":
					newY = bounds.minY
					break
				case "vertical-center":
					newY = bounds.centerY - height / 2
					break
				case "bottom":
					newY = bounds.maxY - height
					break
			}

			// 更新子元素
			this.canvas.elementManager.update(child.id, {
				x: newX,
				y: newY,
			})
		})
	}

	/**
	 * 分布多个选中的元素
	 */
	private distributeElements(elementIds: string[], distributeType: DistributeType): void {
		const elements = elementIds
			.map((id) => this.canvas.elementManager.getElementData(id))
			.filter((el): el is LayerElement => {
				// 使用 PermissionManager 统一判断元素是否可以参与分布操作
				return el !== undefined && this.canvas.permissionManager.canAlign(el)
			})

		if (elements.length < 3) return

		this.performDistribute(elements, distributeType)
	}

	/**
	 * 分布画框内的子元素
	 */
	private distributeFrameChildren(
		frameElement: LayerElement,
		distributeType: DistributeType,
	): void {
		if (!("children" in frameElement) || !frameElement.children) return

		// 使用 PermissionManager 统一判断元素是否可以参与分布操作
		const children = frameElement.children.filter((child) =>
			this.canvas.permissionManager.canAlign(child),
		)

		if (children.length === 0) return

		// 画框内分布需要考虑边界间距，使用专门的方法
		this.performFrameDistribute(frameElement, children, distributeType)
	}

	/**
	 * 执行分布操作的核心逻辑（多选元素）
	 */
	private performDistribute(elements: LayerElement[], distributeType: DistributeType): void {
		switch (distributeType) {
			case "horizontal-spacing":
				this.distributeHorizontalSpacing(elements)
				break
			case "vertical-spacing":
				this.distributeVerticalSpacing(elements)
				break
			case "auto-layout":
				this.distributeAutoLayout(elements)
				break
		}
	}

	/**
	 * 执行画框内分布操作（考虑边界间距）
	 */
	private performFrameDistribute(
		frame: LayerElement,
		children: LayerElement[],
		distributeType: DistributeType,
	): void {
		switch (distributeType) {
			case "horizontal-spacing":
				this.distributeFrameHorizontalSpacing(frame, children)
				break
			case "vertical-spacing":
				this.distributeFrameVerticalSpacing(frame, children)
				break
			case "auto-layout":
				// 自动网格布局不需要考虑画框边界，复用原有逻辑
				this.distributeAutoLayout(children)
				break
		}
	}

	/**
	 * 水平间距分布
	 */
	private distributeHorizontalSpacing(elements: LayerElement[]): void {
		// 按 x 坐标排序
		const sortedElements = [...elements].sort((a, b) => (a.x || 0) - (b.x || 0))

		// 计算总宽度和元素总宽度
		const firstElement = sortedElements[0]
		const lastElement = sortedElements[sortedElements.length - 1]
		const totalWidth = (lastElement.x || 0) + (lastElement.width || 0) - (firstElement.x || 0)
		const elementsWidth = sortedElements.reduce((sum, element) => sum + (element.width || 0), 0)
		const totalSpacing = totalWidth - elementsWidth
		const spacing = totalSpacing / (sortedElements.length - 1)

		// 重新分布
		let currentX = firstElement.x || 0
		sortedElements.forEach((element) => {
			this.canvas.elementManager.update(element.id, {
				x: currentX,
			})
			currentX += (element.width || 0) + spacing
		})
	}

	/**
	 * 垂直间距分布
	 */
	private distributeVerticalSpacing(elements: LayerElement[]): void {
		// 按 y 坐标排序
		const sortedElements = [...elements].sort((a, b) => (a.y || 0) - (b.y || 0))

		// 计算总高度和元素总高度
		const firstElement = sortedElements[0]
		const lastElement = sortedElements[sortedElements.length - 1]
		const totalHeight = (lastElement.y || 0) + (lastElement.height || 0) - (firstElement.y || 0)
		const elementsHeight = sortedElements.reduce(
			(sum, element) => sum + (element.height || 0),
			0,
		)
		const totalSpacing = totalHeight - elementsHeight
		const spacing = totalSpacing / (sortedElements.length - 1)

		// 重新分布
		let currentY = firstElement.y || 0
		sortedElements.forEach((element) => {
			this.canvas.elementManager.update(element.id, {
				y: currentY,
			})
			currentY += (element.height || 0) + spacing
		})
	}

	/**
	 * 画框内水平间距分布（包含左右边距）
	 */
	private distributeFrameHorizontalSpacing(frame: LayerElement, children: LayerElement[]): void {
		// 按 x 坐标排序
		const sortedChildren = [...children].sort((a, b) => (a.x || 0) - (b.x || 0))

		const frameWidth = frame.width || 0
		const childrenWidth = sortedChildren.reduce((sum, child) => sum + (child.width || 0), 0)
		const totalSpacing = frameWidth - childrenWidth
		// N个元素有N+1个间距（包含左右边距）
		const spacing = totalSpacing / (sortedChildren.length + 1)

		// 从第一个间距开始布局
		let currentX = spacing
		sortedChildren.forEach((child) => {
			this.canvas.elementManager.update(child.id, {
				x: currentX,
			})
			currentX += (child.width || 0) + spacing
		})
	}

	/**
	 * 画框内垂直间距分布（包含上下边距）
	 */
	private distributeFrameVerticalSpacing(frame: LayerElement, children: LayerElement[]): void {
		// 按 y 坐标排序
		const sortedChildren = [...children].sort((a, b) => (a.y || 0) - (b.y || 0))

		const frameHeight = frame.height || 0
		const childrenHeight = sortedChildren.reduce((sum, child) => sum + (child.height || 0), 0)
		const totalSpacing = frameHeight - childrenHeight
		// N个元素有N+1个间距（包含上下边距）
		const spacing = totalSpacing / (sortedChildren.length + 1)

		// 从第一个间距开始布局
		let currentY = spacing
		sortedChildren.forEach((child) => {
			this.canvas.elementManager.update(child.id, {
				y: currentY,
			})
			currentY += (child.height || 0) + spacing
		})
	}

	/**
	 * 自动网格布局
	 */
	private distributeAutoLayout(elements: LayerElement[]): void {
		// 计算边界框
		const bounds = this.calculateBounds(elements)

		// 按照原始位置排序（从左到右，从上到下）
		const sortedElements = [...elements].sort((a, b) => {
			const aY = a.y || 0
			const bY = b.y || 0
			const aX = a.x || 0
			const bX = b.x || 0

			// 先按 y 排序，如果 y 相近（差距小于平均高度的一半），则按 x 排序
			const avgHeight =
				elements.reduce((sum, el) => sum + (el.height || 0), 0) / elements.length
			if (Math.abs(aY - bY) < avgHeight / 2) {
				return aX - bX
			}
			return aY - bY
		})

		// 计算网格列数（取平方根向上取整）
		const cols = Math.ceil(Math.sqrt(sortedElements.length))

		// 计算最大宽度和高度
		const maxWidth = Math.max(...sortedElements.map((el) => el.width || 0))
		const maxHeight = Math.max(...sortedElements.map((el) => el.height || 0))

		// 间距设置为最大尺寸的 20%
		const spacingX = maxWidth * 0.2
		const spacingY = maxHeight * 0.2

		// 重新排列
		sortedElements.forEach((element, index) => {
			const row = Math.floor(index / cols)
			const col = index % cols

			const newX = bounds.minX + col * (maxWidth + spacingX)
			const newY = bounds.minY + row * (maxHeight + spacingY)

			this.canvas.elementManager.update(element.id, {
				x: newX,
				y: newY,
			})
		})
	}

	/**
	 * 计算元素集合的边界框
	 */
	private calculateBounds(elements: LayerElement[]): {
		minX: number
		maxX: number
		minY: number
		maxY: number
		centerX: number
		centerY: number
	} {
		let minX = Infinity
		let maxX = -Infinity
		let minY = Infinity
		let maxY = -Infinity

		elements.forEach((element) => {
			const x = element.x || 0
			const y = element.y || 0
			const width = element.width || 0
			const height = element.height || 0

			minX = Math.min(minX, x)
			maxX = Math.max(maxX, x + width)
			minY = Math.min(minY, y)
			maxY = Math.max(maxY, y + height)
		})

		const centerX = (minX + maxX) / 2
		const centerY = (minY + maxY) / 2

		return { minX, maxX, minY, maxY, centerX, centerY }
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		// 清理资源
	}
}
