import Konva from "konva"
import { BaseTool, type ToolOptions, type ToolMetadata } from "./BaseTool"
import { ElementTypeEnum, type ImageElement } from "../../types"
import { ElementFactory } from "../../element/ElementFactory"
import { generateElementId } from "../../utils/utils"
import {
	collectObstacleRects,
	findNextImageVideoPlaceholderPositionNearViewport,
} from "../../utils/findNonOverlappingPlacement"
import {
	getCanvasCenter,
	getResolvedMediaPlacementConfig,
	getViewportCanvasRect,
} from "../../utils/elementUtils"
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

			// 在点击位置创建图像元素（点击点作为元素中心）
			this.createImageElementAtCenter(
				canvasPos.x,
				canvasPos.y,
				defaultSize?.width,
				defaultSize?.height,
			)
		}

		this.canvas.stage.on("click", this.clickHandler)
	}

	/** 模型列表或界面语言变化时清空缓存；工具仍激活时会重新拉取 */
	public clearModelListCache(): void {
		this.cachedImageModelList = null
		this.cachedDefaultSize = null
		if (this.getIsActive()) void this.loadImageModelList()
	}

	/** 异步加载并缓存 imageModelList，并计算默认尺寸 */
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
	 * 从工具栏创建图像元素：优先在当前 viewport 中心附近寻找空位，找不到时再回退到全局占位布局。
	 * @param imageModelList 可选的模型列表，用于获取默认尺寸
	 */
	public createImageAtCenter(imageModelList?: ImageModelItem[]): void {
		// 获取默认尺寸（优先使用 rootStorage 中的配置）
		let defaultSize: { width: number; height: number } | null = null
		if (imageModelList) {
			defaultSize = this.calculateDefaultSize(imageModelList)
		}

		const imageWidth = defaultSize?.width
		const imageHeight = defaultSize?.height
		const imageSize = this.getImageElementSize(imageWidth, imageHeight)
		const mediaPlacementConfig = getResolvedMediaPlacementConfig(this.canvas)

		const obstacles = collectObstacleRects(
			this.canvas.elementManager.getAllElements(),
			(el) => {
				return (
					this.canvas.permissionManager.isVisible(el) &&
					!this.canvas.permissionManager.isLocked(el)
				)
			},
		)
		const position = findNextImageVideoPlaceholderPositionNearViewport(obstacles, {
			elementWidth: imageSize.width,
			elementHeight: imageSize.height,
			viewportRect: getViewportCanvasRect(this.canvas),
			anchor: getCanvasCenter(this.canvas),
			spacing: mediaPlacementConfig.spacing,
			maxPerRow: mediaPlacementConfig.maxPerRow,
			maxSearchRings: mediaPlacementConfig.maxSearchRings,
		})

		// 在找到的位置创建图像元素
		this.createImageElementAt(position.x, position.y, imageSize.width, imageSize.height)
	}

	private getImageElementSize(
		width?: number,
		height?: number,
	): { width: number; height: number } {
		const defaultConfig = ElementFactory.getDefaultConfig(ElementTypeEnum.Image, {
			imageWidth: width,
			imageHeight: height,
		})
		return {
			width: Number(defaultConfig.width) || width || 1024,
			height: Number(defaultConfig.height) || height || 1024,
		}
	}

	private createImageElementAtCenter(
		centerX: number,
		centerY: number,
		width?: number,
		height?: number,
	): void {
		const size = this.getImageElementSize(width, height)
		this.createImageElementAt(
			centerX - size.width / 2,
			centerY - size.height / 2,
			size.width,
			size.height,
		)
	}

	/**
	 * 在指定位置创建图像元素
	 * @param x 画布坐标 x
	 * @param y 画布坐标 y
	 * @param width 可选的宽度，如果不提供则使用默认值
	 * @param height 可选的高度，如果不提供则使用默认值
	 */
	private createImageElementAt(x: number, y: number, width?: number, height?: number): void {
		const size = this.getImageElementSize(width, height)

		// 生成唯一 ID
		const elementId = generateElementId()

		// 获取下一个 zIndex（顶层元素的下一个 zIndex，因为新元素总是创建在顶层）
		const newZIndex = this.canvas.elementManager.getNextZIndexInLevel()

		// 获取图片元素的默认配置
		const defaultConfig = ElementFactory.getDefaultConfig(ElementTypeEnum.Image, {
			imageWidth: size.width,
			imageHeight: size.height,
		})

		// 创建图片元素（使用占位图），传入左上角坐标
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
		this.canvas.selectionManager?.select(elementId)

		// 在下一帧检查可视性；行为与图层列表点击定位保持一致
		requestAnimationFrame(() => {
			const isInViewport = this.canvas.viewportController.isElementInViewport([elementId])
			if (!isInViewport) {
				this.canvas.viewportController.moveElementToViewport([elementId], {
					animated: true,
					padding: { top: 50, right: 50, bottom: 50, left: 100 },
				})
			}
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
