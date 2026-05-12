import type { Descendant, Element as SlateElement } from "slate"
import type { RichTextParagraph, RichTextNode, TextStyle } from "../types"

export const DEFAULT_TEXT_FONT_SIZE = 32
export const DEFAULT_TEXT_FONT_FAMILY = "sans-serif"
export const DEFAULT_TEXT_COLOR = "#0a0a0a"
export const DEFAULT_TEXT_ALIGN = "left"
// 字距/行距为 undefined 时表示工具栏的“自动”，渲染层再回退到这里的默认值。
export const DEFAULT_TEXT_LINE_HEIGHT = 1.5
export const DEFAULT_TEXT_LETTER_SPACING = 0
export const DEFAULT_TEXT_FONT_WEIGHT = 400

export interface CanvasSlateText {
	text: string
	style?: TextStyle
}

export interface CanvasSlateParagraph extends SlateElement {
	type: "paragraph"
	align?: "left" | "center" | "right"
	lineHeight?: number
	paragraphSpacing?: number
	listType?: NonNullable<RichTextParagraph["style"]>["listType"]
	children: CanvasSlateText[]
}

export type CanvasSlateDescendant = CanvasSlateParagraph | CanvasSlateText

export function getDefaultTextStyle(): Required<
	Pick<TextStyle, "fontSize" | "fontFamily" | "color" | "fontWeight">
> {
	return {
		fontSize: DEFAULT_TEXT_FONT_SIZE,
		fontFamily: DEFAULT_TEXT_FONT_FAMILY,
		color: DEFAULT_TEXT_COLOR,
		fontWeight: DEFAULT_TEXT_FONT_WEIGHT,
	}
}

export function getDefaultParagraphStyle(): Required<
	Pick<NonNullable<RichTextParagraph["style"]>, "textAlign" | "lineHeight">
> {
	return {
		textAlign: DEFAULT_TEXT_ALIGN,
		lineHeight: DEFAULT_TEXT_LINE_HEIGHT,
	}
}

export function normalizeTextStyle(style?: TextStyle): TextStyle | undefined {
	if (!style) {
		return undefined
	}

	const normalized: TextStyle = {}
	if (style.fontSize !== undefined) normalized.fontSize = style.fontSize
	if (style.fontWeight !== undefined) normalized.fontWeight = style.fontWeight
	if (style.color !== undefined) normalized.color = style.color
	if (style.fontFamily !== undefined) normalized.fontFamily = style.fontFamily
	if (style.bold !== undefined) normalized.bold = style.bold
	if (style.italic !== undefined) normalized.italic = style.italic
	if (style.underline !== undefined) normalized.underline = style.underline
	if (style.strikethrough !== undefined) normalized.strikethrough = style.strikethrough
	if (style.backgroundColor !== undefined) normalized.backgroundColor = style.backgroundColor
	if (style.letterSpacing !== undefined) normalized.letterSpacing = style.letterSpacing

	return Object.keys(normalized).length > 0 ? normalized : undefined
}

export function getResolvedTextDefaultStyle(defaultStyle?: TextStyle): TextStyle {
	return mergeTextStyle(getDefaultTextStyle(), normalizeTextDefaultStyleForStorage(defaultStyle))
}

export function compactTextDefaultStyle(defaultStyle?: TextStyle): TextStyle | undefined {
	const normalizedStyle = normalizeTextDefaultStyleForStorage(defaultStyle)
	if (!normalizedStyle) {
		return undefined
	}

	const defaults = getDefaultTextStyle()
	const compactedStyle: TextStyle = {}

	if (normalizedStyle.fontSize !== undefined && normalizedStyle.fontSize !== defaults.fontSize) {
		compactedStyle.fontSize = normalizedStyle.fontSize
	}
	if (
		normalizedStyle.fontFamily !== undefined &&
		normalizedStyle.fontFamily !== defaults.fontFamily
	) {
		compactedStyle.fontFamily = normalizedStyle.fontFamily
	}
	if (normalizedStyle.color !== undefined && normalizedStyle.color !== defaults.color) {
		compactedStyle.color = normalizedStyle.color
	}
	if (
		normalizedStyle.fontWeight !== undefined &&
		normalizedStyle.fontWeight !== defaults.fontWeight
	) {
		compactedStyle.fontWeight = normalizedStyle.fontWeight
	}
	if (normalizedStyle.bold !== undefined) compactedStyle.bold = normalizedStyle.bold
	if (normalizedStyle.italic !== undefined) compactedStyle.italic = normalizedStyle.italic
	if (normalizedStyle.underline !== undefined) {
		compactedStyle.underline = normalizedStyle.underline
	}
	if (normalizedStyle.strikethrough !== undefined) {
		compactedStyle.strikethrough = normalizedStyle.strikethrough
	}
	if (normalizedStyle.backgroundColor !== undefined) {
		compactedStyle.backgroundColor = normalizedStyle.backgroundColor
	}
	if (normalizedStyle.letterSpacing !== undefined) {
		compactedStyle.letterSpacing = normalizedStyle.letterSpacing
	}

	return normalizeTextStyle(compactedStyle)
}

export function mergeTextDefaultStylePatch(
	currentDefaultStyle: TextStyle | undefined,
	patch: Partial<TextStyle>,
): TextStyle | undefined {
	return compactTextDefaultStyle({
		...getResolvedTextDefaultStyle(currentDefaultStyle),
		...normalizeTextDefaultStyleForStorage(patch),
	})
}

export function mergeTextStyle(defaultStyle?: TextStyle, nodeStyle?: TextStyle): TextStyle {
	return {
		...normalizeTextStyle(defaultStyle),
		...normalizeTextStyle(nodeStyle),
	}
}

export function createRichTextParagraph(text = "", style?: TextStyle): RichTextParagraph {
	const paragraphStyle = getDefaultParagraphStyle()
	return {
		children: [
			{
				type: "text",
				text,
				style: normalizeTextStyle(style),
			},
		],
		style: {
			textAlign: paragraphStyle.textAlign,
		},
	}
}

export function normalizeRichTextParagraphs(
	content?: RichTextParagraph[],
	defaultStyle?: TextStyle,
): RichTextParagraph[] {
	if (!content || content.length === 0) {
		return [createRichTextParagraph("", defaultStyle)]
	}

	return content.map((paragraph) => {
		const children = (paragraph.children || []).map((node) => ({
			type: "text" as const,
			text: node.text ?? "",
			style: normalizeTextStyle(node.style),
		}))

		return {
			children: children.length > 0 ? children : [{ type: "text" as const, text: "" }],
			style: {
				textAlign: paragraph.style?.textAlign || DEFAULT_TEXT_ALIGN,
				lineHeight: paragraph.style?.lineHeight,
				paragraphSpacing: paragraph.style?.paragraphSpacing,
				listType: paragraph.style?.listType,
			},
		}
	})
}

export function richTextParagraphsToSlateValue(
	content?: RichTextParagraph[],
	defaultStyle?: TextStyle,
): Descendant[] {
	return normalizeRichTextParagraphs(content, defaultStyle).map((paragraph) => ({
		type: "paragraph",
		align: paragraph.style?.textAlign || DEFAULT_TEXT_ALIGN,
		lineHeight: paragraph.style?.lineHeight,
		paragraphSpacing: paragraph.style?.paragraphSpacing,
		listType: paragraph.style?.listType,
		children: paragraph.children?.map((node) => ({
			text: node.text ?? "",
			style: normalizeTextStyle(node.style),
		})) || [{ text: "", style: normalizeTextStyle(defaultStyle) }],
	}))
}

export function slateValueToRichTextParagraphs(value: Descendant[]): RichTextParagraph[] {
	if (!value.length) {
		return [createRichTextParagraph("")]
	}

	const paragraphs: RichTextParagraph[] = []

	value.forEach((node) => {
		if (!("type" in node) || node.type !== "paragraph") {
			return
		}

		const paragraph = node as CanvasSlateParagraph
		const children: RichTextNode[] = paragraph.children.map((child) => ({
			type: "text",
			text: child.text ?? "",
			style: normalizeTextStyle(child.style),
		}))

		paragraphs.push({
			children: children.length > 0 ? children : [{ type: "text", text: "" }],
			style: {
				textAlign: paragraph.align || DEFAULT_TEXT_ALIGN,
				lineHeight: paragraph.lineHeight,
				paragraphSpacing: paragraph.paragraphSpacing,
				listType: paragraph.listType,
			},
		})
	})

	return paragraphs.length > 0 ? paragraphs : [createRichTextParagraph("")]
}

export function isRichTextContentEmpty(content?: RichTextParagraph[]): boolean {
	return extractPlainTextFromRichText(content).trim().length === 0
}

export function extractPlainTextFromRichText(content?: RichTextParagraph[]): string {
	if (!content || content.length === 0) {
		return ""
	}

	return content
		.map((paragraph) => (paragraph.children || []).map((node) => node.text || "").join(""))
		.join("\n")
}

export function cloneRichTextParagraphs(content?: RichTextParagraph[]): RichTextParagraph[] {
	return normalizeRichTextParagraphs(content).map((paragraph) => ({
		children: (paragraph.children || []).map(
			(node): RichTextNode => ({
				type: "text",
				text: node.text,
				style: normalizeTextStyle(node.style),
			}),
		),
		style: paragraph.style ? { ...paragraph.style } : undefined,
	}))
}

export function removeRichTextInlineStyles(content?: RichTextParagraph[]): RichTextParagraph[] {
	return normalizeRichTextParagraphs(content).map((paragraph) => ({
		children: (paragraph.children || []).map(
			(node): RichTextNode => ({
				type: "text",
				text: node.text,
			}),
		),
		style: paragraph.style ? { ...paragraph.style } : undefined,
	}))
}

export function getRichTextListMarker(
	listType: NonNullable<RichTextParagraph["style"]>["listType"],
	index: number,
): string {
	if (listType === "bullet") {
		return "\u2022 "
	}
	if (listType === "ordered") {
		return `${index + 1}. `
	}
	return ""
}

export function setRichTextParagraphTextAlign(
	content: RichTextParagraph[] | undefined,
	textAlign: NonNullable<RichTextParagraph["style"]>["textAlign"],
): RichTextParagraph[] {
	return normalizeRichTextParagraphs(content).map((paragraph) => ({
		children: (paragraph.children || []).map(
			(node): RichTextNode => ({
				type: "text",
				text: node.text,
				style: normalizeTextStyle(node.style),
			}),
		),
		style: {
			...(paragraph.style || {}),
			textAlign,
		},
	}))
}

export function setRichTextParagraphStyle(
	content: RichTextParagraph[] | undefined,
	patch: Partial<NonNullable<RichTextParagraph["style"]>>,
): RichTextParagraph[] {
	return normalizeRichTextParagraphs(content).map((paragraph) => ({
		children: (paragraph.children || []).map(
			(node): RichTextNode => ({
				type: "text",
				text: node.text,
				style: normalizeTextStyle(node.style),
			}),
		),
		style: {
			...(paragraph.style || {}),
			...patch,
		},
	}))
}

export function toTextDecoration(style?: TextStyle): string {
	if (!style) {
		return ""
	}

	const decorations: string[] = []
	if (style.underline) {
		decorations.push("underline")
	}
	if (style.strikethrough) {
		decorations.push("line-through")
	}
	return decorations.join(" ")
}

export function toFontWeight(style?: TextStyle): string | number | undefined {
	if (!style) {
		return undefined
	}
	if (style.fontWeight !== undefined) {
		return style.fontWeight
	}
	return style.bold ? 700 : undefined
}

export function toFontStyle(style?: TextStyle): string | undefined {
	return style?.italic ? "italic" : undefined
}

function toNormalizedFontWeight(style?: TextStyle): 400 | 600 {
	const fontWeight = toFontWeight(style)
	if (fontWeight === undefined) {
		return 400
	}

	const numericWeight =
		typeof fontWeight === "number" ? fontWeight : Number.parseInt(fontWeight, 10)

	if (!Number.isNaN(numericWeight)) {
		return numericWeight >= 600 ? 600 : 400
	}

	return fontWeight === "bold" ? 600 : 400
}

export function toKonvaFontStyle(style?: TextStyle): string {
	const styles: string[] = []
	if (style?.italic) {
		styles.push("italic")
	}
	styles.push(String(toNormalizedFontWeight(style)))
	return styles.join(" ")
}

function normalizeTextDefaultStyleForStorage(style?: TextStyle): TextStyle | undefined {
	const normalizedStyle = normalizeTextStyle(style)
	if (!normalizedStyle) {
		return undefined
	}

	if (
		normalizedStyle.fontFamily === "Arial" ||
		normalizedStyle.fontFamily === "Arial, sans-serif"
	) {
		normalizedStyle.fontFamily = DEFAULT_TEXT_FONT_FAMILY
	}

	return normalizedStyle
}
