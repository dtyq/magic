import Konva from "konva"
import { ImageStaticLoader } from "../../resources/image/ImageStaticLoader"
import type { TFunction } from "../../../public/i18n-types"
import { LAYOUT, IMAGE_CONFIG, COLORS } from "../../elements/image/ImageElement.config"
import type { Canvas } from "../../core/Canvas"
import {
	applyPlaceholderTextLayout,
	createPlaceholderTextNode,
	type PlaceholderTextNodeResult,
} from "./placeholderTextLayout"

/**
 * 居中图标+文本配置
 */
export interface CenteredIconTextConfig {
	/** 文本内容 */
	text: string
	/** 文本颜色 */
	textColor: string
	/** 图标源 */
	iconSrc: string
	/** 是否添加文本背景 */
	withBackground?: boolean
	/** 是否是错误状态（需要特殊处理重试按钮） */
	isErrorState?: boolean
	/** 翻译函数 */
	t?: TFunction
	/** 错误重试回调（仅在 isErrorState 为 true 时使用） */
	onRetry?: () => void
	/** 是否有生成请求（用于判断是否显示重试按钮） */
	hasGenerateImageRequest?: boolean
	/** Canvas 实例（用于检查工具状态） */
	canvas?: Canvas
}

interface CenteredIconTextRuntimeState {
	text: string
	withBackground: boolean
	isErrorState: boolean
	hasRetryButton: boolean
	retryText?: string
}

interface CenteredIconTextResolvedLayout {
	inverseScale: { x: number; y: number }
	effectiveScale: { x: number; y: number }
	iconY: number
	textContainerY: number
	textResult: PlaceholderTextNodeResult
	retryResult?: PlaceholderTextNodeResult
	totalContentHeight: number
}

const centeredIconTextRuntimeState = new WeakMap<Konva.Group, CenteredIconTextRuntimeState>()
const PLACEHOLDER_VERTICAL_INSET = 16

/**
 * 渲染工具类
 * 提供通用的渲染方法，可被多个元素复用
 */
export class RenderUtils {
	private static imageLoader = new ImageStaticLoader()

	private static isImageResourceErrorText(text: string, t?: TFunction): boolean {
		const loadErrorText = t ? t("image.loadError", "图片加载失败") : "图片加载失败"
		const fileMissingText = t ? t("image.fileMissing", "图片文件不存在") : "图片文件不存在"

		return text === loadErrorText || text === fileMissingText
	}

	/**
	 * 获取反向缩放比例（用于抵消 viewport 和元素的缩放）
	 * 当元素屏幕尺寸过小时，会额外缩小内容以防止溢出
	 */
	public static getInverseScale(group: Konva.Group): { x: number; y: number } {
		const stage = group.getStage()
		if (!stage) {
			return { x: 1, y: 1 }
		}

		const viewportScale = stage.scaleX()
		const elementScaleX = group.scaleX()
		const elementScaleY = group.scaleY()
		const groupWidth = group.width()
		const groupHeight = group.height()

		// 基础反向缩放
		let inverseX = 1 / (viewportScale * elementScaleX)
		let inverseY = 1 / (viewportScale * elementScaleY)

		// 计算元素在屏幕上的实际尺寸
		const screenWidth = groupWidth * elementScaleX * viewportScale
		const screenHeight = groupHeight * elementScaleY * viewportScale
		const minScreenSize = Math.min(screenWidth, screenHeight)

		// 如果屏幕尺寸小于阈值，计算额外的缩小比例
		if (minScreenSize < LAYOUT.MIN_CONTENT_SCREEN_SIZE) {
			// 计算缩小因子：从 1 到 MIN_CONTENT_SCALE 线性变化
			const shrinkFactor = Math.max(
				LAYOUT.MIN_CONTENT_SCALE,
				minScreenSize / LAYOUT.MIN_CONTENT_SCREEN_SIZE,
			)

			// 应用缩小因子
			inverseX *= shrinkFactor
			inverseY *= shrinkFactor
		}

		return {
			x: inverseX,
			y: inverseY,
		}
	}

	private static getBackgroundImageSize(backgroundImage: CanvasImageSource):
		| {
				width: number
				height: number
		  }
		| undefined {
		const { width, height } = backgroundImage as { width?: unknown; height?: unknown }
		if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) {
			return undefined
		}

		return { width, height }
	}

	private static getBackgroundImageCoverCrop(
		imageSize: { width: number; height: number },
		width: number,
		height: number,
	): { x: number; y: number; width: number; height: number } {
		const imgWidth = imageSize.width
		const imgHeight = imageSize.height
		const imgRatio = imgWidth / imgHeight
		const containerRatio = width / height

		let cropX = 0
		let cropY = 0
		let cropWidth = imgWidth
		let cropHeight = imgHeight

		if (imgRatio > containerRatio) {
			cropWidth = imgHeight * containerRatio
			cropX = (imgWidth - cropWidth) / 2
		} else {
			cropHeight = imgWidth / containerRatio
			cropY = (imgHeight - cropHeight) / 2
		}

		return {
			x: cropX,
			y: cropY,
			width: cropWidth,
			height: cropHeight,
		}
	}

	public static updateBackgroundImageLayout(
		backgroundNode: Konva.Image,
		width: number,
		height: number,
	): void {
		backgroundNode.width(width)
		backgroundNode.height(height)

		const backgroundImage = backgroundNode.image()
		const backgroundImageSize = backgroundImage
			? RenderUtils.getBackgroundImageSize(backgroundImage)
			: undefined
		if (!backgroundImageSize || width <= 0 || height <= 0) {
			return
		}

		backgroundNode.crop(
			RenderUtils.getBackgroundImageCoverCrop(backgroundImageSize, width, height),
		)
	}

	/**
	 * 更新图片的 contain 布局：保持原始宽高比并完整显示，剩余空间由容器背景填充。
	 * 与 updateBackgroundImageLayout 的 cover 语义分开，避免预览图被中心裁剪。
	 */
	public static updateContainedImageLayout(
		imageNode: Konva.Image,
		width: number,
		height: number,
	): void {
		imageNode.position({ x: 0, y: 0 })
		imageNode.width(width)
		imageNode.height(height)

		const image = imageNode.image()
		const imageSize = image ? RenderUtils.getBackgroundImageSize(image) : undefined
		if (!imageSize || width <= 0 || height <= 0) {
			return
		}

		const scale = Math.min(width / imageSize.width, height / imageSize.height)
		const renderedWidth = imageSize.width * scale
		const renderedHeight = imageSize.height * scale
		imageNode.position({
			x: (width - renderedWidth) / 2,
			y: (height - renderedHeight) / 2,
		})
		imageNode.width(renderedWidth)
		imageNode.height(renderedHeight)
		imageNode.crop({
			x: 0,
			y: 0,
			width: imageSize.width,
			height: imageSize.height,
		})
	}

	/**
	 * 创建背景图片节点（使用 cover 模式裁剪）
	 * @param group 父容器
	 * @param width 容器宽度
	 * @param height 容器高度
	 * @param backgroundImage 背景图片
	 */
	public static createBackgroundImage(
		group: Konva.Group,
		width: number,
		height: number,
		backgroundImage: HTMLImageElement,
	): Konva.Image {
		const backgroundImageSize = RenderUtils.getBackgroundImageSize(backgroundImage)
		const backgroundNode = new Konva.Image({
			image: backgroundImage,
			x: 0,
			y: 0,
			width,
			height,
			name: "background",
			crop: backgroundImageSize
				? RenderUtils.getBackgroundImageCoverCrop(backgroundImageSize, width, height)
				: undefined,
			listening: false,
		})

		group.add(backgroundNode)
		return backgroundNode
	}

	/**
	 * 创建事件代理 hit 节点
	 * 用于接收所有事件，避免子节点阻止事件传播
	 */
	public static createHitNode(
		group: Konva.Group,
		width: number,
		height: number,
		options?: { cornerRadius?: number },
	): Konva.Rect {
		const hitNode = new Konva.Rect({
			x: 0,
			y: 0,
			width,
			height,
			fill: "transparent",
			cornerRadius: options?.cornerRadius,
			listening: true,
			name: "hit-area",
		})
		group.add(hitNode)
		return hitNode
	}

	private static resolveCenteredIconTextLayout(
		group: Konva.Group,
		width: number,
		height: number,
		config: {
			text: string
			textColor: string
			withBackground: boolean
			isErrorState: boolean
			t?: TFunction
			hasGenerateImageRequest: boolean
			retryText?: string
		},
	): CenteredIconTextResolvedLayout {
		const inverseScale = RenderUtils.getInverseScale(group)
		const iconHeight = IMAGE_CONFIG.ICON_SIZE
		const retryLineSpacing = LAYOUT.TEXT_PADDING_Y + 4
		const isImageLoadError =
			config.isErrorState && RenderUtils.isImageResourceErrorText(config.text, config.t)
		const hasRetryButton =
			config.isErrorState && config.hasGenerateImageRequest && !isImageLoadError
		const createTextResult = (
			text: string,
			fill: string,
			name: string,
			maxHeight?: number,
		): PlaceholderTextNodeResult =>
			createPlaceholderTextNode({
				text,
				availableWidth: width,
				inverseScaleX: inverseScale.x,
				fontSize: LAYOUT.TEXT_FONT_SIZE,
				fontFamily: LAYOUT.TEXT_FONT_FAMILY,
				maxHeight,
				paddingX: config.withBackground ? LAYOUT.TEXT_PADDING_X : 0,
				paddingY: config.withBackground ? LAYOUT.TEXT_PADDING_Y : 0,
				fill,
				name,
				listening: name === "decorator-error-retry-button",
			})

		let textResult = createTextResult(
			config.text,
			config.textColor,
			config.isErrorState ? "placeholder-error-text" : "placeholder-text",
		)
		const retryResult = hasRetryButton
			? createTextResult(
					config.retryText ?? "",
					COLORS.ERROR_RETRY_TEXT,
					"decorator-error-retry-button",
				)
			: undefined

		const getTextBlockHeight = (): number => {
			if (config.isErrorState) {
				return (
					textResult.layout.textHeight +
					(retryResult ? retryLineSpacing + retryResult.layout.textHeight : 0)
				)
			}
			return config.withBackground
				? textResult.layout.backgroundHeight
				: textResult.layout.textHeight
		}

		const getTotalContentHeight = (): number =>
			iconHeight + LAYOUT.ICON_TEXT_SPACING + getTextBlockHeight()
		const availableHeight = Math.max(1, height - PLACEHOLDER_VERTICAL_INSET * 2)
		const resolveFitScale = (totalHeight: number): number => {
			const scaledHeight = totalHeight * inverseScale.y
			if (scaledHeight <= availableHeight) return 1
			return Math.max(LAYOUT.MIN_CONTENT_SCALE, availableHeight / scaledHeight)
		}

		let totalContentHeight = getTotalContentHeight()
		let fitScale = resolveFitScale(totalContentHeight)

		if (
			fitScale === LAYOUT.MIN_CONTENT_SCALE &&
			totalContentHeight * inverseScale.y > availableHeight
		) {
			const occupiedHeight =
				iconHeight +
				LAYOUT.ICON_TEXT_SPACING +
				(retryResult ? retryLineSpacing + retryResult.layout.textHeight : 0)
			const availableTextHeight =
				availableHeight / (inverseScale.y * LAYOUT.MIN_CONTENT_SCALE)
			const maxTextHeight = Math.max(
				1,
				availableTextHeight -
					occupiedHeight -
					(config.withBackground ? LAYOUT.TEXT_PADDING_Y * 2 : 0),
			)

			textResult = createTextResult(
				config.text,
				config.textColor,
				config.isErrorState ? "placeholder-error-text" : "placeholder-text",
				maxTextHeight,
			)
			totalContentHeight = getTotalContentHeight()
			fitScale = resolveFitScale(totalContentHeight)
		}

		const effectiveScale = {
			x: inverseScale.x * fitScale,
			y: inverseScale.y * fitScale,
		}
		const scaledTotalHeight = totalContentHeight * effectiveScale.y
		const iconY = (height - scaledTotalHeight) / 2
		const textContainerY =
			iconY +
			IMAGE_CONFIG.ICON_SIZE * effectiveScale.y +
			LAYOUT.ICON_TEXT_SPACING * effectiveScale.y

		return {
			inverseScale,
			effectiveScale,
			iconY,
			textContainerY,
			textResult,
			retryResult,
			totalContentHeight,
		}
	}

	/**
	 * 创建居中的图标和文本布局（不受缩放影响）
	 * @param group 父容器
	 * @param width 容器宽度
	 * @param height 容器高度
	 * @param config 配置参数
	 * @returns Promise<Konva.Group> 返回内容组
	 */
	public static async createCenteredIconText(
		group: Konva.Group,
		width: number,
		height: number,
		config: CenteredIconTextConfig,
	): Promise<Konva.Group> {
		const {
			text,
			textColor,
			iconSrc,
			withBackground = false,
			isErrorState = false,
			t,
			onRetry,
			hasGenerateImageRequest = false,
			canvas,
		} = config
		const retryText = t ? t("image.errorRetry", "点击重试") : "点击重试"
		const iconImage = await RenderUtils.imageLoader.loadImage(iconSrc)
		const resolved = RenderUtils.resolveCenteredIconTextLayout(group, width, height, {
			text,
			textColor,
			withBackground,
			isErrorState,
			t,
			hasGenerateImageRequest,
			retryText,
		})
		const { effectiveScale, iconY, textContainerY, textResult, retryResult } = resolved
		const contentGroup = new Konva.Group({ listening: false })
		const iconSize = IMAGE_CONFIG.ICON_SIZE
		const scaledIconWidth = iconSize * effectiveScale.x

		contentGroup.add(
			new Konva.Image({
				image: iconImage,
				width: iconSize,
				height: iconSize,
				x: (width - scaledIconWidth) / 2,
				y: iconY,
				scaleX: effectiveScale.x,
				scaleY: effectiveScale.y,
				listening: false,
			}),
		)

		if (isErrorState) {
			const errorText = textResult.node
			errorText.x((width - textResult.layout.nodeWidth * effectiveScale.x) / 2)
			errorText.y(textContainerY)
			errorText.scale({ x: effectiveScale.x, y: effectiveScale.y })
			contentGroup.add(errorText)

			if (retryResult) {
				const retryButton = retryResult.node
				retryButton.x(0)
				retryButton.y(0)
				retryButton.scale({ x: effectiveScale.x, y: effectiveScale.y })
				const retryButtonGroup = new Konva.Group({
					x: (width - retryResult.layout.nodeWidth * effectiveScale.x) / 2,
					y:
						textContainerY +
						(textResult.layout.textHeight + LAYOUT.TEXT_PADDING_Y + 4) *
							effectiveScale.y,
					listening: true,
					name: "decorator-error-retry-button-group",
				})
				retryButtonGroup.add(retryButton)

				retryButton.on("mouseenter", () => {
					if (canvas && !canvas.permissionManager.canUseSelectionToolAffordance()) return
					retryButton.opacity(COLORS.ERROR_RETRY_HOVER_OPACITY)
					canvas?.cursorManager.setTemporary("pointer")
					group.getLayer()?.batchDraw()
				})
				retryButton.on("mouseleave", () => {
					if (canvas && !canvas.permissionManager.canUseSelectionToolAffordance()) return
					retryButton.opacity(1)
					canvas?.cursorManager.restoreToolCursor()
					group.getLayer()?.batchDraw()
				})

				const handleRetry = (e: Konva.KonvaEventObject<MouseEvent>) => {
					if (canvas && !canvas.permissionManager.canUseSelectionToolAffordance()) return
					e.cancelBubble = true
					e.evt?.stopPropagation()
					e.evt?.stopImmediatePropagation()
					onRetry?.()
				}
				retryButton.on("mousedown", handleRetry)
				retryButton.on("click tap", handleRetry)
				group.add(retryButtonGroup)
				retryButtonGroup.moveToTop()
			}
		} else if (withBackground) {
			const backgroundX = (width - textResult.layout.backgroundWidth * effectiveScale.x) / 2
			const textBackground = new Konva.Rect({
				x: backgroundX,
				y: textContainerY,
				width: textResult.layout.backgroundWidth,
				height: textResult.layout.backgroundHeight,
				fill: COLORS.LOADING_BG,
				cornerRadius: IMAGE_CONFIG.CORNER_RADIUS,
				scaleX: effectiveScale.x,
				scaleY: effectiveScale.y,
				listening: false,
				name: "placeholder-text-bg",
			})
			contentGroup.add(textBackground)

			const textNode = textResult.node
			textNode.x(
				backgroundX +
					(LAYOUT.TEXT_PADDING_X +
						(textResult.layout.textWidth - textResult.layout.nodeWidth) / 2) *
						effectiveScale.x,
			)
			textNode.y(textContainerY + LAYOUT.TEXT_PADDING_Y * effectiveScale.y)
			textNode.scale({ x: effectiveScale.x, y: effectiveScale.y })
			contentGroup.add(textNode)
		} else {
			const textNode = textResult.node
			textNode.x((width - textResult.layout.nodeWidth * effectiveScale.x) / 2)
			textNode.y(textContainerY)
			textNode.scale({ x: effectiveScale.x, y: effectiveScale.y })
			contentGroup.add(textNode)
		}

		centeredIconTextRuntimeState.set(contentGroup, {
			text,
			withBackground,
			isErrorState,
			hasRetryButton: Boolean(retryResult),
			retryText: retryResult ? retryText : undefined,
		})
		group.add(contentGroup)
		return contentGroup
	}

	/**
	 * 更新内容组的反向缩放
	 * @param contentGroup 内容组
	 * @param parentGroup 父容器
	 * @param width 容器宽度
	 * @param height 容器高度
	 */
	public static updateContentScale(
		contentGroup: Konva.Group,
		parentGroup: Konva.Group,
		width: number,
		height: number,
	): void {
		const state = centeredIconTextRuntimeState.get(contentGroup)
		if (!state) return

		const resolved = RenderUtils.resolveCenteredIconTextLayout(parentGroup, width, height, {
			text: state.text,
			textColor: state.isErrorState ? COLORS.ERROR_TEXT : COLORS.LOADING_TEXT,
			withBackground: state.withBackground,
			isErrorState: state.isErrorState,
			hasGenerateImageRequest: state.hasRetryButton,
			retryText: state.retryText,
		})
		const { effectiveScale, iconY, textContainerY, textResult, retryResult } = resolved
		const iconNode = contentGroup.findOne<Konva.Image>(
			(node: Konva.Node) => node instanceof Konva.Image,
		)
		const textNode = contentGroup.findOne<Konva.Text>(
			state.isErrorState ? ".placeholder-error-text" : ".placeholder-text",
		)
		const backgroundNode = contentGroup.findOne<Konva.Rect>(".placeholder-text-bg")
		if (!iconNode || !textNode) return

		contentGroup.children?.forEach((child) => {
			child.scale({ x: effectiveScale.x, y: effectiveScale.y })
		})
		applyPlaceholderTextLayout(textNode, textResult)
		iconNode.x((width - IMAGE_CONFIG.ICON_SIZE * effectiveScale.x) / 2)
		iconNode.y(iconY)

		if (state.isErrorState) {
			textNode.x((width - textResult.layout.nodeWidth * effectiveScale.x) / 2)
			textNode.y(textContainerY)

			const retryButtonGroup = parentGroup.findOne<Konva.Group>(
				".decorator-error-retry-button-group",
			)
			const retryButton = retryButtonGroup?.findOne<Konva.Text>(
				".decorator-error-retry-button",
			)
			if (retryButtonGroup && retryButton && retryResult) {
				applyPlaceholderTextLayout(retryButton, retryResult)
				retryButton.scale({ x: effectiveScale.x, y: effectiveScale.y })
				retryButton.x(0)
				retryButton.y(0)
				retryButtonGroup.x((width - retryResult.layout.nodeWidth * effectiveScale.x) / 2)
				retryButtonGroup.y(
					textContainerY +
						(textResult.layout.textHeight + LAYOUT.TEXT_PADDING_Y + 4) *
							effectiveScale.y,
				)
			}
			return
		}

		if (backgroundNode) {
			backgroundNode.width(textResult.layout.backgroundWidth)
			backgroundNode.height(textResult.layout.backgroundHeight)
			const backgroundX = (width - textResult.layout.backgroundWidth * effectiveScale.x) / 2
			backgroundNode.x(backgroundX)
			backgroundNode.y(textContainerY)
			textNode.x(
				backgroundX +
					(LAYOUT.TEXT_PADDING_X +
						(textResult.layout.textWidth - textResult.layout.nodeWidth) / 2) *
						effectiveScale.x,
			)
			textNode.y(textContainerY + LAYOUT.TEXT_PADDING_Y * effectiveScale.y)
		} else {
			textNode.x((width - textResult.layout.nodeWidth * effectiveScale.x) / 2)
			textNode.y(textContainerY)
		}
	}
}
