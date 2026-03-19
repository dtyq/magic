import Konva from "konva"
import { BaseTool, type ToolOptions, type ToolMetadata } from "./BaseTool"
import { ElementTypeEnum, type ImageElement, type LayerElement } from "../../types"
import { ElementFactory } from "../../element/ElementFactory"
import { generateElementId } from "../../utils/utils"
import type { ImageModelItem } from "../../../types.magic"

/**
 * ImageGeneratorTool 配置接口
 */
export interface ImageGeneratorToolOptions extends ToolOptions {}

/**
 * 图像生成工具 - 用于在画布上点击位置创建图像元素
 */
export class ImageGeneratorTool extends BaseTool {
	private clickHandler: ((e: Konva.KonvaEventObject<MouseEvent>) => void) | null = null
	private cachedImageModelList: ImageModelItem[] | null = null
	private cachedDefaultSize: { width: number; height: number } | null = null

	constructor(options: ImageGeneratorToolOptions) {
		super(options)
	}

	/**
	 * 获取工具元数据
	 */
	public getMetadata(): ToolMetadata {
		return {
			name: "图片生成工具",
			shortcuts: ["a"],
			description: "在画布上点击位置创建图像元素",
			isTemporary: false,
			cursor: "crosshair",
		}
	}

	/**
	 * 激活工具
	 */
	public activate(): void {
		this.isActive = true

		// 尝试异步获取并缓存 imageModelList（用于获取默认尺寸）
		this.loadImageModelList()

		// 监听画布点击事件
		this.clickHandler = (e: Konva.KonvaEventObject<MouseEvent>) => {
			// 获取点击位置（画布坐标）
			const pos = this.canvas.stage.getPointerPosition()
			if (!pos) return

			// 转换为画布坐标（考虑viewport的缩放和偏移）
			const transform = this.canvas.stage.getAbsoluteTransform().copy()
			transform.invert()
			const canvasPos = transform.point(pos)

			// 使用缓存的默认尺寸
			const defaultSize = this.cachedDefaultSize

			// 在点击位置创建图像元素
			this.createImageElementAt(
				canvasPos.x,
				canvasPos.y,
				defaultSize?.width,
				defaultSize?.height,
			)
		}

		this.canvas.stage.on("click", this.clickHandler)
	}

	/**
	 * 异步加载并缓存 imageModelList，并计算默认尺寸
	 */
	private async loadImageModelList(): Promise<void> {
		try {
			if (this.cachedImageModelList) {
				return
			}
			const getImageModelList =
				this.canvas.magicConfigManager.config?.methods?.getImageModelList
			if (getImageModelList) {
				const models = await getImageModelList()
				this.cachedImageModelList = models
				// 计算并缓存默认尺寸
				this.cachedDefaultSize = this.calculateDefaultSize(models)
			}
		} catch (error) {
			// 如果获取失败，使用 null（将使用默认值 1024x1024）
			this.cachedImageModelList = null
			this.cachedDefaultSize = null
		}
	}

	/**
	 * 计算默认尺寸（优先使用 rootStorage 中的配置）
	 */
	private calculateDefaultSize(
		imageModelList: ImageModelItem[],
	): { width: number; height: number } | null {
		if (imageModelList.length === 0) {
			return null
		}

		// 尝试从 rootStorage 获取默认配置
		const methods = this.canvas.magicConfigManager.config?.methods
		const rootStorage = methods?.getRootStorage?.()
		const defaultConfig = rootStorage?.defaultGenerateImageConfig

		// 如果有 rootStorage 配置且有 size 字段
		if (defaultConfig?.size) {
			// 遍历所有模型，查找匹配的 size
			for (const model of imageModelList) {
				const sizes = model.image_size_config?.sizes
				if (!sizes || sizes.length === 0) continue

				// 查找匹配的尺寸（size 和 resolution 都要匹配）
				const matchedSize = sizes.find(
					(sizeItem) =>
						sizeItem.value === defaultConfig.size &&
						(sizeItem.scale || undefined) === (defaultConfig.resolution || undefined),
				)

				if (matchedSize) {
					// 找到匹配的尺寸，解析并返回
					const [width, height] = matchedSize.value.split("x").map(Number)
					if (!isNaN(width) && !isNaN(height)) {
						return { width, height }
					}
				}
			}
		}

		// 如果 rootStorage 没有配置或没有匹配到，使用第一个模型的第一个 size
		const firstModel = imageModelList[0]
		const sizes = firstModel?.image_size_config?.sizes
		if (!sizes || sizes.length === 0) {
			return null
		}

		const firstSize = sizes[0]
		if (!firstSize?.value) {
			return null
		}

		const [width, height] = firstSize.value.split("x").map(Number)
		if (isNaN(width) || isNaN(height)) {
			return null
		}

		return { width, height }
	}

	/**
	 * 停用工具
	 */
	public deactivate(): void {
		this.isActive = false

		// 移除事件监听
		if (this.clickHandler) {
			this.canvas.stage.off("click", this.clickHandler)
			this.clickHandler = null
		}
	}

	/**
	 * 在画布中心创建图像元素（用于点击按钮时）
	 * 智能避免与现有元素重叠
	 * @param imageModelList 可选的模型列表，用于获取默认尺寸
	 */
	public createImageAtCenter(imageModelList?: ImageModelItem[]): void {
		// 获取视口中心位置（屏幕中心）
		const screenCenterX = this.canvas.stage.width() / 2
		const screenCenterY = this.canvas.stage.height() / 2

		// 转换为画布坐标（考虑视口缩放和平移）
		const transform = this.canvas.stage.getAbsoluteTransform().copy().invert()
		const canvasCenter = transform.point({ x: screenCenterX, y: screenCenterY })

		// 获取默认尺寸（优先使用 rootStorage 中的配置）
		let defaultSize: { width: number; height: number } | null = null
		if (imageModelList) {
			defaultSize = this.calculateDefaultSize(imageModelList)
		}

		const imageWidth = defaultSize?.width
		const imageHeight = defaultSize?.height

		// 获取图片元素的默认配置
		const defaultConfig = ElementFactory.getDefaultConfig(ElementTypeEnum.Image, {
			imageWidth,
			imageHeight,
		})
		const elementWidth = defaultConfig.width as number
		const elementHeight = defaultConfig.height as number

		// 智能寻找合适的位置
		const position = this.findAvailablePosition(
			canvasCenter.x,
			canvasCenter.y,
			elementWidth,
			elementHeight,
		)

		// 在找到的位置创建图像元素
		this.createImageElementAt(position.x, position.y, imageWidth, imageHeight)
	}

	/**
	 * 智能寻找可用的位置，避免与现有元素重叠
	 * 使用螺旋搜索策略，从中心向外扩散
	 */
	private findAvailablePosition(
		centerX: number,
		centerY: number,
		width: number,
		height: number,
	): { x: number; y: number } {
		// 获取所有顶层元素（只关注元素本身，不考虑子元素）
		// 每次调用都重新获取，确保包含最新创建的元素
		const allElements = this.canvas.elementManager.getAllElements()

		// 使用 PermissionManager 统一判断：过滤出可见且未锁定的元素（用于计算位置，避免与其他元素重叠）
		const visibleElements = allElements.filter((el) => {
			return (
				this.canvas.permissionManager.isVisible(el) &&
				!this.canvas.permissionManager.isLocked(el)
			)
		})

		// 如果没有其他元素，直接返回中心位置
		if (visibleElements.length === 0) {
			return {
				x: centerX - width / 2,
				y: centerY - height / 2,
			}
		}

		// 计算初始位置（元素中心对齐视口中心）
		const startX = centerX - width / 2
		const startY = centerY - height / 2

		// 检查初始位置是否可用
		if (!this.hasOverlap(startX, startY, width, height, visibleElements)) {
			return { x: startX, y: startY }
		}

		// 使用螺旋搜索策略寻找空位
		// 搜索参数：根据元素大小动态调整
		const elementSize = Math.max(width, height)
		const step = Math.max(20, Math.min(elementSize * 0.3, 60)) // 步长：元素大小的30%，最小20px，最大60px
		const maxRadius = Math.max(1000, elementSize * 3) // 最大搜索半径：至少1000px或元素大小的3倍

		// 螺旋搜索：从内向外，每一圈增加半径
		for (let radius = step; radius <= maxRadius; radius += step) {
			// 计算当前半径需要检查的点数（半径越大，点越多，但也要考虑性能）
			const circumference = 2 * Math.PI * radius
			const pointsInCircle = Math.max(12, Math.min(Math.floor(circumference / step), 64))
			const currentAngleStep = (2 * Math.PI) / pointsInCircle

			// 在当前半径的圆上均匀分布检查点
			for (let i = 0; i < pointsInCircle; i++) {
				const angle = i * currentAngleStep
				const testX = centerX + radius * Math.cos(angle) - width / 2
				const testY = centerY + radius * Math.sin(angle) - height / 2

				// 检查该位置是否可用
				if (!this.hasOverlap(testX, testY, width, height, visibleElements)) {
					return { x: testX, y: testY }
				}
			}
		}

		// 如果螺旋搜索找不到，尝试网格搜索（更密集但更慢）
		const gridStep = Math.max(30, elementSize * 0.2)
		const gridRadius = Math.min(maxRadius, 2000)

		for (let offsetY = -gridRadius; offsetY <= gridRadius; offsetY += gridStep) {
			for (let offsetX = -gridRadius; offsetX <= gridRadius; offsetX += gridStep) {
				// 跳过中心区域（已经在螺旋搜索中检查过）
				const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY)
				if (distance < step * 2) continue

				const testX = startX + offsetX
				const testY = startY + offsetY

				if (!this.hasOverlap(testX, testY, width, height, visibleElements)) {
					return { x: testX, y: testY }
				}
			}
		}

		// 如果还是找不到合适的位置，返回稍微偏移的中心位置
		// 使用更大的随机偏移避免完全重叠
		const randomOffsetX = (Math.random() - 0.5) * (elementSize + 200)
		const randomOffsetY = (Math.random() - 0.5) * (elementSize + 200)
		return {
			x: startX + randomOffsetX,
			y: startY + randomOffsetY,
		}
	}

	/**
	 * 检查指定位置是否与现有元素重叠
	 * 只检测顶层元素（包括画框和组）的边界，不考虑子元素
	 */
	private hasOverlap(
		x: number,
		y: number,
		width: number,
		height: number,
		elements: LayerElement[],
	): boolean {
		// 添加间距，避免元素贴得太近（根据元素大小动态调整）
		const elementSize = Math.max(width, height)
		const padding = Math.max(20, elementSize * 0.1) // 至少20px，或元素大小的10%

		const rect1 = {
			x1: x - padding,
			y1: y - padding,
			x2: x + width + padding,
			y2: y + height + padding,
		}

		// 检查与每个元素的重叠
		for (const element of elements) {
			// 跳过没有宽高的元素
			if (!element.width || !element.height) continue

			const elemWidth = element.width * (element.scaleX || 1)
			const elemHeight = element.height * (element.scaleY || 1)

			// 顶层元素的坐标就是画布坐标
			const elemX = element.x || 0
			const elemY = element.y || 0

			const rect2 = {
				x1: elemX,
				y1: elemY,
				x2: elemX + elemWidth,
				y2: elemY + elemHeight,
			}

			// 检查两个矩形是否重叠（使用严格的边界检查）
			const overlaps = !(
				rect1.x2 <= rect2.x1 ||
				rect1.x1 >= rect2.x2 ||
				rect1.y2 <= rect2.y1 ||
				rect1.y1 >= rect2.y2
			)

			if (overlaps) {
				return true
			}
		}

		return false
	}

	/**
	 * 在指定位置创建图像元素
	 * @param x 画布坐标 x
	 * @param y 画布坐标 y
	 * @param width 可选的宽度，如果不提供则使用默认值
	 * @param height 可选的高度，如果不提供则使用默认值
	 */
	private createImageElementAt(x: number, y: number, width?: number, height?: number): void {
		// 生成唯一 ID
		const elementId = generateElementId()

		// 获取下一个 zIndex（顶层元素的下一个 zIndex，因为新元素总是创建在顶层）
		const newZIndex = this.canvas.elementManager.getNextZIndexInLevel()

		// 获取图片元素的默认配置
		const defaultConfig = ElementFactory.getDefaultConfig(ElementTypeEnum.Image, {
			imageWidth: width,
			imageHeight: height,
		})

		// 创建图片元素（使用占位图），点击位置为左上角
		// 不传入 name，使用 getRenderName() 返回的默认名称
		const imageElement: ImageElement = {
			id: elementId,
			type: ElementTypeEnum.Image,
			x: x,
			y: y,
			...defaultConfig,
			zIndex: newZIndex,
		}

		// 创建元素
		this.canvas.elementManager.create(imageElement)

		// 在下一帧聚焦到新创建的元素（确保元素已完全渲染）
		// 聚焦时会自动选中元素
		requestAnimationFrame(() => {
			// 移动端使用百分比，桌面端使用固定值
			const isMobile = this.canvas.isMobileDevice
			this.canvas.viewportController.focusOnElements([elementId], {
				padding: isMobile
					? { top: "5%", right: "5%", bottom: "15%", left: "5%" }
					: { top: 150, right: 150, bottom: 250, left: 150 },
				animated: true,
			})
		})

		// 创建完成后切回选择工具
		this.onTaskComplete()
	}

	/**
	 * 任务完成时的处理
	 * 添加图片后立即切换回选择工具
	 */
	protected onTaskComplete(): void {
		if (!this.canvas.toolManager) return

		// 添加图片后立即切换到选择工具
		this.canvas.toolManager.switchToSelection()
	}

	/**
	 * 销毁工具
	 */
	public destroy(): void {
		this.deactivate()
	}

	/**
	 * 设置默认尺寸
	 * @param size 默认尺寸
	 */
	public setDefaultSize(size: { width: number; height: number }): void {
		this.cachedDefaultSize = size
	}
}
