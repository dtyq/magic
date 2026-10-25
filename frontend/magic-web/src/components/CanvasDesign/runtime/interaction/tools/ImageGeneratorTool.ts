import Konva from "konva"
import { BaseTool, type ToolOptions, type ToolMetadata } from "./BaseTool"
import { ElementTypeEnum, type ImageElement } from "../../document/types"
import { ElementFactory } from "../../elements/core/ElementFactory"
import { generateElementId } from "../../shared/ids"
import {
	resolveHorizontalPlacements,
	resolveNearestFreeMediaPlacement,
} from "../../shared/placement/placementEngine"
import type { ImageModelItem } from "../../../public/magic-types"

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
		this.clickHandler = () => {
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
				const matchedSize =
					sizes.find(
						(sizeItem) =>
							sizeItem.value === defaultConfig.size &&
							(sizeItem.scale || undefined) ===
								(defaultConfig.resolution || undefined),
					) || sizes.find((sizeItem) => sizeItem.value === defaultConfig.size)

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
		const position = resolveNearestFreeMediaPlacement(this.canvas, imageSize)

		// 在找到的位置创建图像元素
		this.createImageElementAt(position.x, position.y, imageSize.width, imageSize.height)
	}

	public createImageAtCanvasPoint(
		centerX: number,
		centerY: number,
		imageModelList?: ImageModelItem[],
		options?: ImageGeneratorElementCreateOptions,
	): string {
		const size = this.getImageElementSizeForModelList(imageModelList)
		return this.createImageElementAtCenter(centerX, centerY, size.width, size.height, options)
	}

	public getImageElementSizeForModelList(imageModelList?: ImageModelItem[]): {
		width: number
		height: number
	} {
		const defaultSize = imageModelList ? this.calculateDefaultSize(imageModelList) : null
		return this.getImageElementSize(defaultSize?.width, defaultSize?.height)
	}

	public createImageElementNearViewport(width?: number, height?: number): string {
		const imageSize = this.getImageElementSize(width, height)
		const position = resolveNearestFreeMediaPlacement(this.canvas, imageSize)

		return this.createImageElementAt(position.x, position.y, imageSize.width, imageSize.height)
	}

	public createImageElementsNearViewport(
		count: number,
		width?: number,
		height?: number,
	): string[] {
		const nextCount = Math.max(1, count)
		const imageSize = this.getImageElementSize(width, height)
		const firstPosition = resolveNearestFreeMediaPlacement(this.canvas, imageSize)
		const positions = resolveHorizontalPlacements(
			Array.from({ length: nextCount }, () => imageSize),
			{
				x: firstPosition.x + imageSize.width / 2,
				y: firstPosition.y + imageSize.height / 2,
			},
			0,
		)

		return positions.map((position) =>
			this.createImageElementAt(
				position.x - imageSize.width / 2,
				position.y - imageSize.height / 2,
				imageSize.width,
				imageSize.height,
				{
					select: false,
					ensureInViewport: false,
					completeTask: false,
				},
			),
		)
	}

	/** 暴露图片元素尺寸解析，供外部落点算法先计算占位框。 */
	public resolveImageElementSize(
		width?: number,
		height?: number,
	): { width: number; height: number } {
		return this.getImageElementSize(width, height)
	}

	/** 按画布左上角坐标批量创建图片占位符；落点和视口聚焦由调用方控制。 */
	public createImageElementsAtPositions(
		positions: Array<{ x: number; y: number }>,
		width?: number,
		height?: number,
		options?: { temporary?: boolean },
	): string[] {
		const imageSize = this.getImageElementSize(width, height)
		return positions.map((position) =>
			this.createImageElementAt(position.x, position.y, imageSize.width, imageSize.height, {
				select: false,
				ensureInViewport: false,
				completeTask: false,
				temporary: options?.temporary,
			}),
		)
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
		options?: ImageGeneratorElementCreateOptions,
	): string {
		const size = this.getImageElementSize(width, height)
		return this.createImageElementAt(
			centerX - size.width / 2,
			centerY - size.height / 2,
			size.width,
			size.height,
			options,
		)
	}

	/**
	 * 在指定位置创建图像元素
	 * @param x 画布坐标 x
	 * @param y 画布坐标 y
	 * @param width 可选的宽度，如果不提供则使用默认值
	 * @param height 可选的高度，如果不提供则使用默认值
	 */
	private createImageElementAt(
		x: number,
		y: number,
		width?: number,
		height?: number,
		options?: ImageGeneratorElementCreateOptions & { temporary?: boolean },
	): string {
		const size = this.getImageElementSize(width, height)

		// 生成唯一 ID
		const elementId = generateElementId()

		// 获取下一个 zIndex（顶层元素的下一个 zIndex，因为新元素总是创建在顶层）
		const newZIndex = this.canvas.elementManager.getNextZIndexInLevel()

		// 创建图片元素（使用占位图），传入左上角坐标
		// 不传入 name，使用 getRenderName() 返回的默认名称
		const imageElement = ElementFactory.createElementData(
			ElementTypeEnum.Image,
			elementId,
			x,
			y,
			size.width,
			size.height,
			newZIndex,
		) as ImageElement

		if (options?.temporary) {
			this.canvas.elementManager.createTemporaryElement(imageElement, { silent: true })
		} else {
			this.canvas.elementManager.create(imageElement)
		}
		if (options?.select !== false) {
			this.canvas.selectionManager?.select(elementId)
		}

		if (options?.ensureInViewport !== false) {
			this.ensureElementVisible(elementId)
		}

		// 创建完成后切回选择工具
		if (options?.completeTask !== false) {
			this.onTaskComplete()
		}

		return elementId
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

export interface ImageGeneratorElementCreateOptions {
	select?: boolean
	ensureInViewport?: boolean
	completeTask?: boolean
}
