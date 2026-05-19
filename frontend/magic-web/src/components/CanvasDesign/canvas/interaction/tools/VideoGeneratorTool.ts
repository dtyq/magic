import Konva from "konva"
import { BaseTool, type ToolMetadata, type ToolOptions } from "./BaseTool"
import { ElementTypeEnum, type VideoElement } from "../../types"
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
import type {
	DefaultGenerateVideoConfig,
	VideoGenerationSizeOption,
	VideoModelItem,
} from "../../../types.magic"

export interface VideoGeneratorToolOptions extends ToolOptions {}

export class VideoGeneratorTool extends BaseTool {
	private clickHandler: ((e: Konva.KonvaEventObject<MouseEvent>) => void) | null = null
	private cachedVideoModelList: VideoModelItem[] | null = null
	private cachedDefaultSize: { width: number; height: number } | null = null

	public getMetadata(): ToolMetadata {
		return {
			name: "视频生成工具",
			description: "在画布上点击位置创建视频元素",
			isTemporary: false,
			cursor: "crosshair",
		}
	}

	public activate(): void {
		this.isActive = true
		this.loadVideoModelList()

		this.clickHandler = () => {
			const pos = this.canvas.stage.getPointerPosition()
			if (!pos) return

			const transform = this.canvas.stage.getAbsoluteTransform().copy()
			transform.invert()
			const canvasPos = transform.point(pos)
			const defaultSize = this.cachedDefaultSize

			this.createVideoElementAtCenter(
				canvasPos.x,
				canvasPos.y,
				defaultSize?.width,
				defaultSize?.height,
			)
		}

		this.canvas.stage.on("click", this.clickHandler)
	}

	public deactivate(): void {
		this.isActive = false
		if (this.clickHandler) {
			this.canvas.stage.off("click", this.clickHandler)
			this.clickHandler = null
		}
	}

	public destroy(): void {
		this.deactivate()
	}

	public setDefaultSize(size: { width: number; height: number }): void {
		this.cachedDefaultSize = size
	}

	/**
	 * 根据宽高比（如 16:9）设置点击创建视频时的默认像素尺寸
	 */
	public setDefaultSizeByAspectRatio(aspectRatio: string): void {
		this.cachedDefaultSize = this.calculateSizeFromAspectRatio(aspectRatio)
	}

	/**
	 * 从工具栏创建视频元素：优先在当前 viewport 中心附近寻找空位，找不到时再回退到全局占位布局。
	 */
	public createVideoAtCenter(videoModelList?: VideoModelItem[]): void {
		let defaultSize: { width: number; height: number } | null = null
		if (videoModelList) {
			defaultSize = this.calculateDefaultSize(videoModelList)
		}

		const videoWidth = defaultSize?.width
		const videoHeight = defaultSize?.height
		const videoSize = this.getVideoElementSize(videoWidth, videoHeight)
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
			elementWidth: videoSize.width,
			elementHeight: videoSize.height,
			viewportRect: getViewportCanvasRect(this.canvas),
			anchor: getCanvasCenter(this.canvas),
			spacing: mediaPlacementConfig.spacing,
			maxPerRow: mediaPlacementConfig.maxPerRow,
			maxSearchRings: mediaPlacementConfig.maxSearchRings,
		})

		this.createVideoElementAt(position.x, position.y, videoSize.width, videoSize.height)
	}

	/** 模型列表或界面语言变化时清空缓存；工具仍激活时会重新拉取 */
	public clearModelListCache(): void {
		this.cachedVideoModelList = null
		this.cachedDefaultSize = null
		if (this.getIsActive()) void this.loadVideoModelList()
	}

	private async loadVideoModelList(): Promise<void> {
		try {
			if (this.cachedVideoModelList) return
			const getVideoModelList =
				this.canvas.magicConfigManager.config?.methods?.getVideoModelList
			if (getVideoModelList) {
				const models = await getVideoModelList()
				this.cachedVideoModelList = models
				this.cachedDefaultSize = this.calculateDefaultSize(models)
			}
		} catch (error) {
			this.cachedVideoModelList = null
			this.cachedDefaultSize = null
		}
	}

	/**
	 * 结合根存储配置与模型尺寸列表，计算新建视频的默认尺寸
	 */
	private calculateDefaultSize(
		videoModelList: VideoModelItem[],
	): { width: number; height: number } | null {
		if (videoModelList.length === 0) {
			return null
		}

		const methods = this.canvas.magicConfigManager.config?.methods
		const rootStorage = methods?.getRootStorage?.()
		const defaultConfig = rootStorage?.defaultGenerateVideoConfig as
			| DefaultGenerateVideoConfig
			| undefined
		const selectedModel =
			videoModelList.find((model) => model.model_id === defaultConfig?.model_id) ||
			videoModelList[0]
		const configuredSize = this.resolveConfiguredSize(selectedModel, defaultConfig)

		if (configuredSize) {
			return configuredSize
		}

		const aspectRatio =
			defaultConfig?.generation?.aspect_ratio || this.getFirstAspectRatio(videoModelList)

		if (aspectRatio) {
			return this.calculateSizeFromAspectRatio(aspectRatio)
		}

		return null
	}

	private resolveConfiguredSize(
		model: VideoModelItem | undefined,
		defaultConfig: DefaultGenerateVideoConfig | undefined,
	): { width: number; height: number } | null {
		const sizes = this.getNormalizedGenerationSizes(model)
		if (sizes.length > 0) {
			const exactMatch =
				defaultConfig?.generation?.aspect_ratio && defaultConfig?.generation?.resolution
					? sizes.find(
							(size) =>
								size.label === defaultConfig.generation?.aspect_ratio &&
								size.resolution === defaultConfig.generation?.resolution,
						)
					: undefined
			const resolutionMatch = defaultConfig?.generation?.resolution
				? sizes.find((size) => size.resolution === defaultConfig.generation?.resolution)
				: undefined
			const aspectRatioMatch = defaultConfig?.generation?.aspect_ratio
				? sizes.find((size) => size.label === defaultConfig.generation?.aspect_ratio)
				: undefined
			const targetSize = exactMatch || resolutionMatch || aspectRatioMatch || sizes[0]

			if (targetSize) {
				return {
					width: targetSize.width,
					height: targetSize.height,
				}
			}
		}

		const aspectRatio =
			defaultConfig?.generation?.aspect_ratio ||
			model?.video_generation_config?.generation?.aspect_ratios?.[0]
		return aspectRatio ? this.calculateSizeFromAspectRatio(aspectRatio) : null
	}

	/** 遍历模型列表，返回第一个配置中的宽高比字符串 */
	private getFirstAspectRatio(videoModelList: VideoModelItem[]): string | undefined {
		for (const model of videoModelList) {
			const aspectRatio = model.video_generation_config?.generation?.aspect_ratios?.[0]
			if (aspectRatio) return aspectRatio
		}

		return undefined
	}

	private getNormalizedGenerationSizes(
		model: VideoModelItem | undefined,
	): Array<VideoGenerationSizeOption & { width: number; height: number }> {
		const sizes = model?.video_generation_config?.generation?.sizes || []
		return sizes
			.map((size) => {
				const parsedSize = this.parseSizeValue(size.value)
				const width = Number.isFinite(size.width) ? size.width : parsedSize?.width
				const height = Number.isFinite(size.height) ? size.height : parsedSize?.height
				if (!size.label || !size.value || !size.resolution || !width || !height) return null
				return {
					...size,
					width,
					height,
				}
			})
			.filter(
				(
					size,
				): size is VideoGenerationSizeOption & {
					width: number
					height: number
				} => Boolean(size),
			)
	}

	private parseSizeValue(value?: string): { width: number; height: number } | null {
		if (!value) return null
		const [width, height] = value.split("x").map(Number)
		if (!Number.isFinite(width) || !Number.isFinite(height)) return null
		return { width, height }
	}

	/**
	 * 将「宽:高」字符串转为像素尺寸，长边固定为 320，用于画布占位比例
	 */
	private calculateSizeFromAspectRatio(
		aspectRatio: string,
	): { width: number; height: number } | null {
		const [rawWidth, rawHeight] = aspectRatio.split(":").map(Number)
		if (!rawWidth || !rawHeight) return null

		const defaultLongSide = 320
		if (rawWidth >= rawHeight) {
			return {
				width: defaultLongSide,
				height: Math.round((defaultLongSide * rawHeight) / rawWidth),
			}
		}

		return {
			width: Math.round((defaultLongSide * rawWidth) / rawHeight),
			height: defaultLongSide,
		}
	}

	private getVideoElementSize(
		width?: number,
		height?: number,
	): { width: number; height: number } {
		const defaultConfig = ElementFactory.getDefaultConfig(ElementTypeEnum.Video, {
			videoWidth: width,
			videoHeight: height,
		})
		return {
			width: Number(defaultConfig.width) || width || 320,
			height: Number(defaultConfig.height) || height || 320,
		}
	}

	private createVideoElementAtCenter(
		centerX: number,
		centerY: number,
		width?: number,
		height?: number,
	): void {
		const size = this.getVideoElementSize(width, height)
		this.createVideoElementAt(
			centerX - size.width / 2,
			centerY - size.height / 2,
			size.width,
			size.height,
		)
	}

	private createVideoElementAt(x: number, y: number, width?: number, height?: number): void {
		const size = this.getVideoElementSize(width, height)
		const elementId = generateElementId()
		const newZIndex = this.canvas.elementManager.getNextZIndexInLevel()
		const defaultConfig = ElementFactory.getDefaultConfig(ElementTypeEnum.Video, {
			videoWidth: size.width,
			videoHeight: size.height,
		})

		const videoElement: VideoElement = {
			id: elementId,
			type: ElementTypeEnum.Video,
			x,
			y,
			...defaultConfig,
			zIndex: newZIndex,
		}

		this.canvas.elementManager.create(videoElement)
		this.canvas.selectionManager?.select(elementId)

		requestAnimationFrame(() => {
			const isInViewport = this.canvas.viewportController.isElementInViewport([elementId])
			if (!isInViewport) {
				this.canvas.viewportController.moveElementToViewport([elementId], {
					animated: true,
					padding: { top: 50, right: 50, bottom: 50, left: 100 },
				})
			}
		})

		this.onTaskComplete()
	}
}
