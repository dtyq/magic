import Konva from "konva"
import type { TextElement as TextElementData, RichTextParagraph } from "../../types"
import { ElementTypeEnum } from "../../types"
import { BaseElement } from "../BaseElement"
import type { Canvas } from "../../Canvas"
import { extractTextFromRichTextParagraphs } from "../../utils/utils"

/**
 * 文本元素类
 */
export class TextElement extends BaseElement<TextElementData> {
	constructor(data: TextElementData, canvas: Canvas) {
		super(data, canvas)
	}

	/**
	 * 获取文本默认配置
	 */
	static getDefaultConfig() {
		return {
			fontSize: 80,
			fontFamily: "Arial, sans-serif",
			color: "#000000",
			textAlign: "left",
		}
	}

	/**
	 * 获取渲染名称（用于显示的默认名称）
	 * 文本元素的渲染名称是从内容中提取的文本
	 */
	public getRenderName(): string {
		const text = extractTextFromRichTextParagraphs(this.data.content)
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
		const defaultConfig = this.getDefaultConfig()
		return {
			id,
			type: ElementTypeEnum.Text,
			x,
			y,
			width,
			height,
			zIndex,
			content: [
				{
					children: [
						{
							type: "text",
							text,
						},
					],
					style: {
						textAlign: defaultConfig.textAlign as
							| "left"
							| "center"
							| "right"
							| "justify",
						lineHeight: 1.5,
					},
				},
			],
			defaultStyle: {
				fontSize: defaultConfig.fontSize,
				fontFamily: defaultConfig.fontFamily,
				color: defaultConfig.color,
			},
		}
	}

	render(): Konva.Text | null {
		// 将富文本内容转换为纯文本
		const textContent = this.convertRichTextToPlainText(this.data.content || [])

		// 获取默认样式
		const defaultStyle = this.data.defaultStyle || {}

		const text = new Konva.Text({
			text: textContent,
			width: this.data.width,
			height: this.data.height,
			fontSize: defaultStyle.fontSize,
			fontFamily: defaultStyle.fontFamily,
			fontStyle: this.getFontStyle(defaultStyle),
			fill: defaultStyle.color,
			align: this.getTextAlign(this.data.content?.[0]),
			lineHeight: this.data.content?.[0]?.style?.lineHeight,
			textDecoration: this.getTextDecoration(defaultStyle),
			letterSpacing: defaultStyle.letterSpacing ?? 0,
		})

		this.finalizeNode(text)
		this.setupDoubleClick(text)
		return text
	}

	update(newData: TextElementData): boolean {
		this.data = newData

		// 文本元素不需要重新渲染，所有属性都可以通过 setAttrs 更新
		if (this.node instanceof Konva.Text) {
			const textContent = this.convertRichTextToPlainText(newData.content || [])
			const defaultStyle = newData.defaultStyle || {}

			// 更新基础属性（位置、可见性、透明度、zIndex、锁定状态）
			this.updateBaseProps(this.node, newData)

			// 更新文本特定属性
			this.node.setAttrs({
				text: textContent,
				width: newData.width,
				height: newData.height,
				fontSize: defaultStyle.fontSize,
				fontFamily: defaultStyle.fontFamily,
				fontStyle: this.getFontStyle(defaultStyle),
				fill: defaultStyle.color,
				align: this.getTextAlign(newData.content?.[0]),
				lineHeight: newData.content?.[0]?.style?.lineHeight,
				textDecoration: this.getTextDecoration(defaultStyle),
				letterSpacing: defaultStyle.letterSpacing ?? 0,
			})
		}

		return false
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
				},
			})
		})
	}

	/**
	 * 将富文本内容转换为纯文本
	 */
	private convertRichTextToPlainText(paragraphs: RichTextParagraph[]): string {
		return paragraphs
			.map((paragraph) => {
				return paragraph.children
					?.map((node) => {
						if (node.type === "text") {
							return node.text
						}
						return ""
					})
					.join("")
			})
			.join("\n")
	}

	/**
	 * 获取字体样式
	 */
	private getFontStyle(style: TextElementData["defaultStyle"]): string {
		const styles: string[] = []

		if (style?.italic) {
			styles.push("italic")
		}

		if (style?.bold) {
			styles.push("bold")
		}

		// 支持 fontWeight
		if (style?.fontWeight && !style.bold) {
			const weight =
				typeof style.fontWeight === "number"
					? style.fontWeight
					: Number.parseInt(style.fontWeight, 10)
			if (!Number.isNaN(weight) && weight >= 600) {
				styles.push("bold")
			}
		}

		return styles.join(" ") || "normal"
	}

	/**
	 * 获取文本对齐方式
	 */
	private getTextAlign(paragraph?: RichTextParagraph): "left" | "center" | "right" | "justify" {
		return paragraph?.style?.textAlign || "left"
	}

	/**
	 * 获取文本装饰
	 */
	private getTextDecoration(style: TextElementData["defaultStyle"]): string {
		const decorations: string[] = []

		if (style?.underline) {
			decorations.push("underline")
		}

		if (style?.strikethrough) {
			decorations.push("line-through")
		}

		return decorations.join(" ") || ""
	}
}
