import Konva from "konva"
import { ImageStaticLoader } from "./ImageStaticLoader"
import type { TFunction } from "../../context/I18nContext"
import { LAYOUT, IMAGE_CONFIG, COLORS } from "../element/elements/ImageElement.config"
import type { Canvas } from "../Canvas"

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

/**
 * 渲染工具类
 * 提供通用的渲染方法，可被多个元素复用
 */
export class RenderUtils {
	private static imageLoader = new ImageStaticLoader()

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
		// 计算 cover 模式下的裁剪参数
		const imgWidth = backgroundImage.width
		const imgHeight = backgroundImage.height
		const imgRatio = imgWidth / imgHeight
		const containerRatio = width / height

		let cropX = 0
		let cropY = 0
		let cropWidth = imgWidth
		let cropHeight = imgHeight

		if (imgRatio > containerRatio) {
			// 图片更宽，裁剪左右
			cropWidth = imgHeight * containerRatio
			cropX = (imgWidth - cropWidth) / 2
		} else {
			// 图片更高，裁剪上下
			cropHeight = imgWidth / containerRatio
			cropY = (imgHeight - cropHeight) / 2
		}

		const backgroundNode = new Konva.Image({
			image: backgroundImage,
			x: 0,
			y: 0,
			width,
			height,
			crop: {
				x: cropX,
				y: cropY,
				width: cropWidth,
				height: cropHeight,
			},
			listening: false,
		})

		group.add(backgroundNode)
		return backgroundNode
	}

	/**
	 * 创建事件代理 hit 节点
	 * 用于接收所有事件，避免子节点阻止事件传播
	 */
	public static createHitNode(group: Konva.Group, width: number, height: number): Konva.Rect {
		const hitNode = new Konva.Rect({
			x: 0,
			y: 0,
			width,
			height,
			fill: "transparent",
			listening: true,
			name: "hit-area",
		})
		group.add(hitNode)
		return hitNode
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

		const iconImage = await RenderUtils.imageLoader.loadImage(iconSrc)

		// 获取反向缩放比例
		const inverseScale = RenderUtils.getInverseScale(group)

		const iconWidth = IMAGE_CONFIG.ICON_SIZE
		const iconHeight = IMAGE_CONFIG.ICON_SIZE

		// 创建临时文本节点以获取文本尺寸
		let textWidth: number
		let textHeight: number

		if (isErrorState) {
			// 检查是否有 generateImageRequest，决定如何计算文本宽度
			const isImageLoadError =
				text === (t ? t("image.loadError", "图片加载失败") : "图片加载失败")

			if (hasGenerateImageRequest && !isImageLoadError) {
				// 有 generateImageRequest 且不是图片加载失败：计算错误消息 + 重试按钮的总宽度
				const tempErrorTextNode = new Konva.Text({
					text: text,
					fontSize: LAYOUT.TEXT_FONT_SIZE,
					fontFamily: LAYOUT.TEXT_FONT_FAMILY,
					listening: false,
				})
				const retryText = t ? t("image.errorRetry", "点击重试") : "点击重试"
				const tempRetryNode = new Konva.Text({
					text: `, ${retryText}`,
					fontSize: LAYOUT.TEXT_FONT_SIZE,
					fontFamily: LAYOUT.TEXT_FONT_FAMILY,
					listening: false,
				})
				textWidth = tempErrorTextNode.width() + tempRetryNode.width()
				textHeight = Math.max(tempErrorTextNode.height(), tempRetryNode.height())
			} else {
				// 没有 generateImageRequest 或是图片加载失败：只计算单个错误文本的宽度
				const tempTextNode = new Konva.Text({
					text,
					fontSize: LAYOUT.TEXT_FONT_SIZE,
					fontFamily: LAYOUT.TEXT_FONT_FAMILY,
					listening: false,
				})
				textWidth = tempTextNode.width()
				textHeight = tempTextNode.height()
			}
		} else {
			const tempTextNode = new Konva.Text({
				text,
				fontSize: LAYOUT.TEXT_FONT_SIZE,
				fontFamily: LAYOUT.TEXT_FONT_FAMILY,
				listening: false,
			})
			textWidth = tempTextNode.width()
			textHeight = tempTextNode.height()
		}

		// 计算布局（使用原始尺寸）
		let bgHeight = textHeight
		let bgWidth = textWidth

		if (withBackground) {
			bgWidth += LAYOUT.TEXT_PADDING_X * 2
			bgHeight += LAYOUT.TEXT_PADDING_Y * 2
		}

		const totalContentHeight = iconHeight + LAYOUT.ICON_TEXT_SPACING + bgHeight

		// 创建内容容器 Group，应用反向缩放
		const contentGroup = new Konva.Group({
			listening: false,
		})

		// 计算缩放后的实际尺寸
		const scaledIconWidth = iconWidth * inverseScale.x
		const scaledIconHeight = iconHeight * inverseScale.y
		const scaledBgWidth = bgWidth * inverseScale.x
		const scaledSpacing = LAYOUT.ICON_TEXT_SPACING * inverseScale.y
		const scaledTotalHeight = totalContentHeight * inverseScale.y

		// 计算居中位置
		const iconY = (height - scaledTotalHeight) / 2

		// 添加图标
		const iconNode = new Konva.Image({
			image: iconImage,
			width: iconWidth,
			height: iconHeight,
			x: (width - scaledIconWidth) / 2,
			y: iconY,
			scaleX: inverseScale.x,
			scaleY: inverseScale.y,
			listening: false,
		})
		contentGroup.add(iconNode)

		// 添加文本（可选背景）
		const textContainerY = iconY + scaledIconHeight + scaledSpacing

		// 错误状态：不显示背景，根据错误类型显示不同内容
		if (isErrorState) {
			const isImageLoadError =
				text === (t ? t("image.loadError", "图片加载失败") : "图片加载失败")

			if (isImageLoadError || !hasGenerateImageRequest) {
				// 图片加载失败或没有 generateImageRequest：只显示错误文本，不显示重试按钮
				const errorText = new Konva.Text({
					text: text,
					fontSize: LAYOUT.TEXT_FONT_SIZE,
					fontFamily: LAYOUT.TEXT_FONT_FAMILY,
					fill: COLORS.ERROR_TEXT,
					width: textWidth,
					align: "center",
					x: (width - textWidth * inverseScale.x) / 2,
					y: textContainerY,
					scaleX: inverseScale.x,
					scaleY: inverseScale.y,
					listening: false,
				})
				contentGroup.add(errorText)
			} else {
				// 图像生成失败且有 generateImageRequest：显示错误消息 + 重试按钮（居中对齐）
				const retryText = t ? t("image.errorRetry", "点击重试") : "点击重试"
				const tempErrorTextNode = new Konva.Text({
					text: text,
					fontSize: LAYOUT.TEXT_FONT_SIZE,
					fontFamily: LAYOUT.TEXT_FONT_FAMILY,
					listening: false,
				})
				const tempRetryNode = new Konva.Text({
					text: `, ${retryText}`,
					fontSize: LAYOUT.TEXT_FONT_SIZE,
					fontFamily: LAYOUT.TEXT_FONT_FAMILY,
					listening: false,
				})
				const totalTextWidth =
					(tempErrorTextNode.width() + tempRetryNode.width()) * inverseScale.x
				const startX = (width - totalTextWidth) / 2

				// 创建错误消息文本
				const errorText = new Konva.Text({
					text: text,
					fontSize: LAYOUT.TEXT_FONT_SIZE,
					fontFamily: LAYOUT.TEXT_FONT_FAMILY,
					fill: COLORS.ERROR_TEXT,
					x: startX,
					y: textContainerY,
					scaleX: inverseScale.x,
					scaleY: inverseScale.y,
					listening: false,
				})
				contentGroup.add(errorText)

				// 计算重试按钮的位置（紧跟错误消息后面）
				const errorTextWidth = errorText.width() * inverseScale.x
				const retryButtonX = startX + errorTextWidth

				// 创建可点击的重试按钮文本（包含逗号和空格）
				const retryButton = new Konva.Text({
					text: `, ${retryText}`,
					fontSize: LAYOUT.TEXT_FONT_SIZE,
					fontFamily: LAYOUT.TEXT_FONT_FAMILY,
					fill: COLORS.ERROR_RETRY_TEXT,
					x: 0,
					y: 0,
					scaleX: inverseScale.x,
					scaleY: inverseScale.y,
					listening: true,
					name: "decorator-error-retry-button",
				})

				// 创建重试按钮的容器 group
				const retryButtonGroup = new Konva.Group({
					x: retryButtonX,
					y: textContainerY,
					listening: true,
					name: "decorator-error-retry-button-group",
				})

				retryButtonGroup.add(retryButton)

				// 添加 hover 效果（只有在选择工具下才生效）
				retryButton.on("mouseenter", () => {
					// 检查当前工具是否为选择工具
					if (canvas) {
						const currentTool = canvas.toolManager.getActiveTool()
						const isSelectionTool =
							currentTool && canvas.toolManager.getSelectionTool() === currentTool
						if (!isSelectionTool) {
							return
						}
					}
					retryButton.opacity(COLORS.ERROR_RETRY_HOVER_OPACITY)
					if (canvas) {
						canvas.cursorManager.setTemporary("pointer")
					}
					group.getLayer()?.batchDraw()
				})

				retryButton.on("mouseleave", () => {
					// 检查当前工具是否为选择工具
					if (canvas) {
						const currentTool = canvas.toolManager.getActiveTool()
						const isSelectionTool =
							currentTool && canvas.toolManager.getSelectionTool() === currentTool
						if (!isSelectionTool) {
							return
						}
					}
					retryButton.opacity(1)
					if (canvas) {
						canvas.cursorManager.restoreToolCursor()
					}
					group.getLayer()?.batchDraw()
				})

				// 添加点击事件（只有在选择工具下才能点击）
				const handleRetry = (e: Konva.KonvaEventObject<MouseEvent>) => {
					// 检查当前工具是否为选择工具
					if (canvas) {
						const currentTool = canvas.toolManager.getActiveTool()
						const isSelectionTool =
							currentTool && canvas.toolManager.getSelectionTool() === currentTool
						if (!isSelectionTool) {
							return
						}
					}
					e.cancelBubble = true
					if (e.evt) {
						e.evt.stopPropagation()
						e.evt.stopImmediatePropagation()
					}
					onRetry?.()
				}

				retryButton.on("mousedown", handleRetry)
				retryButton.on("click tap", handleRetry)

				// 将重试按钮组直接添加到主 group
				group.add(retryButtonGroup)
				retryButtonGroup.moveToTop()
			}
		} else if (withBackground) {
			// 非错误状态且需要背景
			const textContainerX = (width - scaledBgWidth) / 2
			const textBackground = new Konva.Rect({
				x: textContainerX,
				y: textContainerY,
				width: bgWidth,
				height: bgHeight,
				fill: COLORS.LOADING_BG,
				cornerRadius: IMAGE_CONFIG.CORNER_RADIUS,
				scaleX: inverseScale.x,
				scaleY: inverseScale.y,
				listening: false,
			})
			contentGroup.add(textBackground)

			const textNode = new Konva.Text({
				text,
				fontSize: LAYOUT.TEXT_FONT_SIZE,
				fontFamily: LAYOUT.TEXT_FONT_FAMILY,
				fill: textColor,
				x: textContainerX + LAYOUT.TEXT_PADDING_X * inverseScale.x,
				y: textContainerY + LAYOUT.TEXT_PADDING_Y * inverseScale.y,
				scaleX: inverseScale.x,
				scaleY: inverseScale.y,
				listening: false,
			})
			contentGroup.add(textNode)
		} else {
			// 非错误状态且不需要背景
			const textNode = new Konva.Text({
				text,
				fontSize: LAYOUT.TEXT_FONT_SIZE,
				fontFamily: LAYOUT.TEXT_FONT_FAMILY,
				fill: textColor,
				width: textWidth,
				align: "center",
				x: (width - textWidth * inverseScale.x) / 2,
				y: textContainerY,
				scaleX: inverseScale.x,
				scaleY: inverseScale.y,
				listening: false,
			})
			contentGroup.add(textNode)
		}

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
		// 获取新的反向缩放比例
		const inverseScale = RenderUtils.getInverseScale(parentGroup)

		// 重新计算布局参数
		const iconWidth = IMAGE_CONFIG.ICON_SIZE
		const iconHeight = IMAGE_CONFIG.ICON_SIZE
		const scaledIconWidth = iconWidth * inverseScale.x
		const scaledIconHeight = iconHeight * inverseScale.y
		const scaledSpacing = LAYOUT.ICON_TEXT_SPACING * inverseScale.y

		let iconNode: Konva.Image | undefined
		const textNodes: Konva.Text[] = []
		let textBackground: Konva.Rect | undefined
		let retryButtonGroup: Konva.Group | undefined
		let retryButton: Konva.Text | undefined

		// 收集 contentGroup 中的节点
		contentGroup.children?.forEach((child) => {
			if (child instanceof Konva.Image) {
				iconNode = child
			} else if (child instanceof Konva.Text) {
				textNodes.push(child)
			} else if (child instanceof Konva.Rect) {
				textBackground = child
			}
		})

		// 从主 group 中查找重试按钮组
		parentGroup.children?.forEach((child) => {
			if (
				child instanceof Konva.Group &&
				child.name() === "decorator-error-retry-button-group"
			) {
				retryButtonGroup = child
				const retryBtn = child.findOne(
					(node: Konva.Node) => node.name() === "decorator-error-retry-button",
				) as Konva.Text | undefined
				if (retryBtn) {
					retryButton = retryBtn
				}
			}
		})

		// 更新 contentGroup 中所有节点的缩放
		contentGroup.children?.forEach((child) => {
			if (child instanceof Konva.Node) {
				child.scaleX(inverseScale.x)
				child.scaleY(inverseScale.y)
			}
		})

		// 更新重试按钮组的缩放（如果存在）
		if (retryButtonGroup && retryButton) {
			retryButtonGroup.children?.forEach((child) => {
				if (child instanceof Konva.Node) {
					child.scaleX(inverseScale.x)
					child.scaleY(inverseScale.y)
				}
			})
		}

		// 重新计算布局
		if (iconNode && textNodes.length > 0) {
			// 如果有重试按钮（错误状态），需要特殊处理（无背景）
			if (retryButton && retryButtonGroup && textNodes.length === 1) {
				const errorText = textNodes[0]
				if (errorText) {
					const errorTextWidth = errorText.width()
					const retryWidth = retryButton.width()
					const textHeight = Math.max(errorText.height(), retryButton.height())

					const totalContentHeight = iconHeight + LAYOUT.ICON_TEXT_SPACING + textHeight
					const scaledTotalHeight = totalContentHeight * inverseScale.y

					// 重新计算 icon 位置
					const iconY = (height - scaledTotalHeight) / 2
					iconNode.x((width - scaledIconWidth) / 2)
					iconNode.y(iconY)

					// 重新计算文本位置（居中对齐）
					const textContainerY = iconY + scaledIconHeight + scaledSpacing
					const totalTextWidth = (errorTextWidth + retryWidth) * inverseScale.x
					const startX = (width - totalTextWidth) / 2

					// 错误消息文本位置
					errorText.x(startX)
					errorText.y(textContainerY)

					// 重试按钮组位置（紧跟错误消息后面）
					const errorTextScaledWidth = errorTextWidth * inverseScale.x
					retryButtonGroup.x(startX + errorTextScaledWidth)
					retryButtonGroup.y(textContainerY)
				}
			} else {
				// 普通单文本节点的情况
				const textNode = textNodes[0]
				let bgHeight = textNode.height()
				let bgWidth = textNode.width()

				if (textBackground) {
					bgWidth += LAYOUT.TEXT_PADDING_X * 2
					bgHeight += LAYOUT.TEXT_PADDING_Y * 2
				}

				const totalContentHeight = iconHeight + LAYOUT.ICON_TEXT_SPACING + bgHeight
				const scaledTotalHeight = totalContentHeight * inverseScale.y

				// 重新计算 icon 位置
				const iconY = (height - scaledTotalHeight) / 2
				iconNode.x((width - scaledIconWidth) / 2)
				iconNode.y(iconY)

				// 重新计算文本位置
				const textContainerY = iconY + scaledIconHeight + scaledSpacing

				if (textBackground) {
					const scaledBgWidth = bgWidth * inverseScale.x
					const textContainerX = (width - scaledBgWidth) / 2
					textBackground.x(textContainerX)
					textBackground.y(textContainerY)

					textNode.x(textContainerX + LAYOUT.TEXT_PADDING_X * inverseScale.x)
					textNode.y(textContainerY + LAYOUT.TEXT_PADDING_Y * inverseScale.y)
				} else {
					const textWidth = textNode.width()
					textNode.x((width - textWidth * inverseScale.x) / 2)
					textNode.y(textContainerY)
				}
			}
		}
	}
}
