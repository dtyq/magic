import Konva from "konva"
import type {
	RichTextParagraph,
	TextElement as TextElementData,
	LayerElement,
	TextStyle,
} from "../../types"
import { ElementTypeEnum } from "../../types"
import { BaseElement } from "../BaseElement"
import type { Canvas } from "../../Canvas"
import { measureRichTextLayout } from "../../text/layout"
import {
	cloneRichTextParagraphs,
	compactTextDefaultStyle,
	createRichTextParagraph,
	DEFAULT_TEXT_LETTER_SPACING,
	extractPlainTextFromRichText,
	getDefaultTextStyle,
	getResolvedTextDefaultStyle,
	normalizeRichTextParagraphs,
	toKonvaFontStyle,
} from "../../text/richText"
import {
	resolveTypographyScaleFromBaselineBox,
	scaleRichTextContent,
	scaleTextStyle,
} from "../../text/scaleTypography"
import { getTextDecorationRects, type TextDecorationRect } from "../../text/textDecorationGeometry"
import type { TransformContext } from "../BaseElement"
import { DECORATOR_COLORS, DECORATOR_CONFIG } from "../decorators/DecoratorConfig"

const TEXT_CONTENT_BOUNDS_NAME = "text-content-bounds"

interface TextTransformBaseline {
	layoutWidth: number
	layoutHeight: number
	content: RichTextParagraph[]
	defaultStyle: TextStyle | undefined
}

interface ResolvedTextRenderChunk {
	text: string
	x: number
	y: number
	width: number
	height: number
	fontSize: number
	lineHeight: number
	fontFamily: string
	konvaFontStyle: string
	fillColor: string
	letterSpacing: number
	backgroundColor?: string
	decorationRects: TextDecorationRect[]
}

interface TextRenderPlan {
	width: number
	height: number
	chunks: ResolvedTextRenderChunk[]
}

/**
 * 文本元素类
 */
export class TextElement extends BaseElement<TextElementData> {
	private textTransformBaseline: TextTransformBaseline | null = null

	constructor(data: TextElementData, canvas: Canvas) {
		super(data, canvas)
	}

	protected override setupCustomBoundingRect(node: Konva.Node): void {
		if (!(node instanceof Konva.Group)) {
			return
		}

		const originalGetClientRect = node.getClientRect.bind(node)
		node.getClientRect = (config?: Parameters<Konva.Node["getClientRect"]>[0]) => {
			const contentBounds = this.getContentBoundsNode(node)
			if (contentBounds) {
				const rect = contentBounds.getClientRect(config)
				if (rect.width > 0 && rect.height > 0) {
					return rect
				}
			}

			return originalGetClientRect(config)
		}
	}

	/**
	 * 获取文本默认配置
	 */
	static getDefaultConfig() {
		return {
			...getDefaultTextStyle(),
			textAlign: "left",
		}
	}

	/**
	 * 获取渲染名称（用于显示的默认名称）
	 * 文本元素的渲染名称是从内容中提取的文本
	 */
	public getRenderName(): string {
		const text = extractPlainTextFromRichText(this.data.content)
		return text || this.getText("text.defaultName", "文本")
	}

	/**
	 * 创建文本元素数据
	 */
	static createElementData(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number | undefined,
		zIndex: number = 0,
		text: string = "",
	): TextElementData {
		return {
			id,
			type: ElementTypeEnum.Text,
			x,
			y,
			width,
			height,
			scaleX: 1,
			scaleY: 1,
			zIndex,
			content: [createRichTextParagraph(text)],
		}
	}

	render(): Konva.Group | null {
		const layout = this.measureLayout(this.data)
		const renderPlan = this.createRenderPlan(layout, {
			width: layout.width,
			height: layout.height,
		})
		const group = new Konva.Group({
			width: renderPlan.width,
			height: renderPlan.height,
		})

		this.syncLayoutNodes(group, renderPlan)

		this.finalizeNode(group)
		this.setupDoubleClick(group)
		return group
	}

	update(newData: TextElementData): boolean {
		const layout = this.measureLayout(newData)
		newData.width = layout.width
		newData.height = layout.height
		this.data = newData

		if (this.node instanceof Konva.Group) {
			const renderPlan = this.createRenderPlan(layout, {
				width: layout.width,
				height: layout.height,
			})
			this.updateBaseProps(this.node, newData)
			this.syncLayoutNodes(this.node, renderPlan)
			this.node.getLayer()?.batchDraw()
		}

		return false
	}

	public override shouldKeepRatio(): boolean {
		return this.data.interactionConfig?.aspectRatioLocked ?? true
	}

	public override async renderToCanvas(
		ctx: CanvasRenderingContext2D,
		offsetX: number,
		offsetY: number,
		options?: { shouldDrawBorder?: boolean; width?: number; height?: number },
	): Promise<boolean> {
		try {
			const layout = this.measureLayout(this.data)
			const renderPlan = this.createRenderPlan(layout, {
				width: options?.width,
				height: options?.height,
			})
			if (renderPlan.width <= 0 || renderPlan.height <= 0 || renderPlan.chunks.length === 0) {
				return false
			}

			ctx.save()
			const exportGroup = new Konva.Group({
				width: renderPlan.width,
				height: renderPlan.height,
			})
			this.syncLayoutNodes(exportGroup, renderPlan)
			const renderedCanvas = exportGroup.toCanvas({
				pixelRatio: 1,
				width: Math.max(Math.ceil(renderPlan.width), 1),
				height: Math.max(Math.ceil(renderPlan.height), 1),
			})
			ctx.drawImage(renderedCanvas, offsetX, offsetY, renderPlan.width, renderPlan.height)
			ctx.restore()

			if (options?.shouldDrawBorder) {
				ctx.save()
				ctx.strokeStyle = DECORATOR_COLORS.BORDER_DEFAULT
				ctx.lineWidth = DECORATOR_CONFIG.BORDER_WIDTH
				ctx.strokeRect(offsetX, offsetY, renderPlan.width, renderPlan.height)
				ctx.restore()
			}

			return true
		} catch {
			return false
		}
	}

	public override applyTransform(
		updates: Partial<LayerElement>,
		context: TransformContext,
	): Partial<LayerElement> {
		if (!context.isScaling) {
			this.textTransformBaseline = null
			return {
				x: updates.x,
				y: updates.y,
				scaleX: 1,
				scaleY: 1,
			}
		}

		if (!this.textTransformBaseline) {
			const layout = this.measureLayout(this.data)
			this.textTransformBaseline = {
				layoutWidth: Math.max(layout.width, 1),
				layoutHeight: Math.max(layout.height, 1),
				content: cloneRichTextParagraphs(this.data.content),
				defaultStyle: this.data.defaultStyle
					? ({ ...this.data.defaultStyle } as TextStyle)
					: undefined,
			}
		}

		const base = this.textTransformBaseline
		const groupWidth = updates.width ?? this.data.width ?? base.layoutWidth
		const groupHeight = updates.height ?? this.data.height ?? base.layoutHeight
		const targetWidth = Math.max(groupWidth * (updates.scaleX ?? 1), 1)
		const targetHeight = Math.max(groupHeight * (updates.scaleY ?? 1), 1)

		const typographyScale = resolveTypographyScaleFromBaselineBox({
			baselineWidth: base.layoutWidth,
			baselineHeight: base.layoutHeight,
			targetWidth,
			targetHeight,
		})

		const baselineResolvedDefault = getResolvedTextDefaultStyle(base.defaultStyle)
		const scaledResolvedDefault =
			scaleTextStyle(baselineResolvedDefault, typographyScale) ?? baselineResolvedDefault
		const scaledContent = scaleRichTextContent(base.content, typographyScale)
		const layout = this.measureLayout({
			...this.data,
			content: scaledContent,
			defaultStyle: scaledResolvedDefault,
			scaleX: 1,
			scaleY: 1,
		})

		return {
			x: updates.x,
			y: updates.y,
			content: scaledContent,
			defaultStyle: compactTextDefaultStyle(scaledResolvedDefault),
			width: layout.width,
			height: layout.height,
			scaleX: 1,
			scaleY: 1,
		}
	}

	/**
	 * 设置元素的双击事件监听
	 */
	private setupDoubleClick(node: Konva.Node): void {
		node.on("dblclick", (e) => {
			e.cancelBubble = true
			this.canvas.eventEmitter.emit({
				type: "element:dblclick",
				data: {
					elementId: this.data.id,
					elementType: this.data.type,
					clientX: e.evt?.clientX,
					clientY: e.evt?.clientY,
				},
			})
		})
	}

	private createContentBoundsNode(width: number, height: number): Konva.Rect {
		return new Konva.Rect({
			x: 0,
			y: 0,
			width,
			height,
			fill: "#000000",
			opacity: 0,
			listening: false,
			name: TEXT_CONTENT_BOUNDS_NAME,
		})
	}

	private getContentBoundsNode(group: Konva.Group): Konva.Rect | undefined {
		const node = group.children.find((child) => child.name() === TEXT_CONTENT_BOUNDS_NAME)
		return node instanceof Konva.Rect ? node : undefined
	}

	private syncLayoutNodes(group: Konva.Group, renderPlan: TextRenderPlan): void {
		group.destroyChildren()
		group.add(this.createContentBoundsNode(renderPlan.width, renderPlan.height))
		this.createHitNode(group, renderPlan.width, renderPlan.height)

		renderPlan.chunks.forEach((chunk) => {
			if (chunk.backgroundColor) {
				group.add(
					new Konva.Rect({
						x: chunk.x,
						y: chunk.y,
						width: chunk.width,
						height: chunk.height,
						fill: chunk.backgroundColor,
						listening: false,
					}),
				)
			}

			group.add(
				new Konva.Text({
					x: chunk.x,
					y: chunk.y,
					text: chunk.text,
					fontSize: chunk.fontSize,
					// Konva 的默认单行文字度量会比 DOM 编辑态更“紧”，这里把 DOM 测得的 chunk 高度折算成 lineHeight，尽量让渲染态与编辑态的文字落点保持一致。
					lineHeight: chunk.lineHeight,
					fontFamily: chunk.fontFamily,
					fontStyle: chunk.konvaFontStyle,
					fill: chunk.fillColor,
					letterSpacing: chunk.letterSpacing,
				} as Konva.TextConfig),
			)

			chunk.decorationRects.forEach((rect) => {
				group.add(
					new Konva.Rect({
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
						fill: rect.color,
						listening: false,
					}),
				)
			})
		})
	}

	private createRenderPlan(
		layout: ReturnType<TextElement["measureLayout"]>,
		options?: { width?: number; height?: number },
	): TextRenderPlan {
		const scaleX = this.data.scaleX ?? 1
		const scaleY = this.data.scaleY ?? 1
		const baseWidth = Math.max(layout.width, 1)
		const baseHeight = Math.max(layout.height, 1)
		const renderWidth = options?.width ?? baseWidth * scaleX
		const renderHeight = options?.height ?? baseHeight * scaleY
		const resolvedDefaultStyle = getResolvedTextDefaultStyle(this.data.defaultStyle)
		const defaultTextStyle = getDefaultTextStyle()
		const scaleRatioX = renderWidth / baseWidth
		const scaleRatioY = renderHeight / baseHeight

		return {
			width: renderWidth,
			height: renderHeight,
			chunks: layout.chunks.map((chunk) => {
				const fontSize =
					chunk.style.fontSize ??
					resolvedDefaultStyle.fontSize ??
					defaultTextStyle.fontSize

				return {
					text: chunk.text,
					x: chunk.x * scaleRatioX,
					y: chunk.y * scaleRatioY,
					width: chunk.width * scaleRatioX,
					height: chunk.height * scaleRatioY,
					fontSize: fontSize * scaleRatioY,
					lineHeight: fontSize > 0 ? chunk.height / fontSize : 1,
					fontFamily:
						chunk.style.fontFamily ?? resolvedDefaultStyle.fontFamily ?? "sans-serif",
					konvaFontStyle: toKonvaFontStyle(chunk.style),
					fillColor:
						chunk.style.color ?? resolvedDefaultStyle.color ?? defaultTextStyle.color,
					letterSpacing:
						(chunk.style.letterSpacing ?? DEFAULT_TEXT_LETTER_SPACING) * scaleRatioX,
					backgroundColor: chunk.backgroundColor,
					decorationRects: chunk.isListMarker
						? []
						: getTextDecorationRects({
								x: chunk.x * scaleRatioX,
								y: chunk.y * scaleRatioY,
								width: chunk.width * scaleRatioX,
								height: chunk.height * scaleRatioY,
								fontSize: fontSize * scaleRatioY,
								color:
									chunk.style.color ??
									resolvedDefaultStyle.color ??
									defaultTextStyle.color,
								underline: chunk.style.underline,
								strikethrough: chunk.style.strikethrough,
							}),
				}
			}),
		}
	}

	private measureLayout(data: TextElementData) {
		const normalizedData: TextElementData = {
			...data,
			content: normalizeRichTextParagraphs(data.content, data.defaultStyle),
		}
		return measureRichTextLayout(normalizedData.content, normalizedData.defaultStyle)
	}
}
