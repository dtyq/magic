import {
	Editor,
	Element as SlateElement,
	type BaseEditor,
	type BaseRange,
	Range,
	Text,
	Transforms,
} from "slate"
import type { RichTextParagraph, TextStyle } from "../types"
import type { CanvasSlateParagraph, CanvasSlateText } from "./richText"
import { DEFAULT_TEXT_ALIGN, mergeTextStyle, normalizeTextStyle } from "./richText"

export type TextAlignValue = NonNullable<RichTextParagraph["style"]>["textAlign"]
export type TextListTypeValue = NonNullable<RichTextParagraph["style"]>["listType"]

export interface TextEditorFormattingState {
	active: boolean
	elementId: string | null
	canEdit: boolean
	isCollapsed: boolean
	fontFamily: string | null
	fontSize: number | null
	fontWeight: number | string | null
	color: string | null
	letterSpacing: number | null
	italic: boolean | null
	underline: boolean | null
	strikethrough: boolean | null
	textAlign: TextAlignValue | null
	lineHeight: number | null
	listType: TextListTypeValue | null
}

export function createInactiveTextEditorFormattingState(): TextEditorFormattingState {
	return {
		active: false,
		elementId: null,
		canEdit: false,
		isCollapsed: true,
		fontFamily: null,
		fontSize: null,
		fontWeight: null,
		color: null,
		letterSpacing: null,
		italic: null,
		underline: null,
		strikethrough: null,
		textAlign: null,
		lineHeight: null,
		listType: null,
	}
}

export function getTextEditorFormattingState(options: {
	editor: BaseEditor | null
	defaultStyle?: TextStyle
	elementId?: string | null
}): TextEditorFormattingState {
	const { editor, defaultStyle, elementId = null } = options
	if (!editor?.selection) {
		return {
			...createInactiveTextEditorFormattingState(),
			active: Boolean(elementId),
			elementId,
		}
	}

	const selection = editor.selection
	const isCollapsed = Range.isCollapsed(selection)
	const textStyles = isCollapsed
		? [getCollapsedSelectionTextStyle(editor, defaultStyle)]
		: getExpandedSelectionTextStyles(editor, defaultStyle)
	const paragraphEntries = getParagraphEntries(editor, selection)
	const paragraphs = paragraphEntries.map(([node]) => node as CanvasSlateParagraph)

	return {
		active: true,
		elementId,
		canEdit: true,
		isCollapsed,
		fontFamily: getUniformValue(textStyles.map((style) => style.fontFamily ?? null)),
		fontSize: getUniformValue(textStyles.map((style) => style.fontSize ?? null)),
		fontWeight: getUniformValue(
			textStyles.map((style) => normalizeFontWeight(style.fontWeight)),
		),
		color: getUniformValue(textStyles.map((style) => style.color ?? null)),
		letterSpacing: getUniformValue(textStyles.map((style) => style.letterSpacing ?? null)),
		italic: getUniformValue(textStyles.map((style) => style.italic ?? false)),
		underline: getUniformValue(textStyles.map((style) => style.underline ?? false)),
		strikethrough: getUniformValue(textStyles.map((style) => style.strikethrough ?? false)),
		textAlign: getUniformValue(
			paragraphs.map((paragraph) => paragraph.align ?? DEFAULT_TEXT_ALIGN),
		),
		lineHeight: getUniformValue(paragraphs.map((paragraph) => paragraph.lineHeight ?? null)),
		listType: getUniformValue(paragraphs.map((paragraph) => paragraph.listType ?? null)),
	}
}

export function applySelectionTextStyle(
	editor: BaseEditor | null,
	patch: Partial<TextStyle>,
): boolean {
	if (!editor?.selection) {
		return false
	}

	if (Range.isCollapsed(editor.selection)) {
		const marks = getSelectionMarksStyle(editor)
		Editor.addMark(editor, "style", normalizeTextStyle(applyTextStylePatch(marks, patch)) || {})
		return true
	}

	const selection = editor.selection
	Editor.withoutNormalizing(editor, () => {
		splitSelectionTextBoundaries(editor, selection)
		const normalizedSelection = editor.selection ?? selection
		const entries = Array.from(
			Editor.nodes(editor, {
				at: normalizedSelection,
				match: (node) => Text.isText(node),
			}),
		).filter(([, path]) => {
			const nodeRange = Editor.range(editor, path)
			const intersection = Range.intersection(nodeRange, normalizedSelection)
			return Boolean(intersection && !Range.isCollapsed(intersection))
		})

		entries.forEach(([node, path]) => {
			const textNode = node as CanvasSlateText
			const nextStyle = normalizeTextStyle(applyTextStylePatch(textNode.style, patch))
			Transforms.setNodes(editor, { style: nextStyle } as Partial<CanvasSlateText>, {
				at: path,
			})
		})
	})

	return true
}

export function applySelectionParagraphStyle(
	editor: BaseEditor | null,
	patch: Partial<
		Pick<CanvasSlateParagraph, "align" | "lineHeight" | "paragraphSpacing" | "listType">
	>,
): boolean {
	if (!editor?.selection) {
		return false
	}

	const paragraphs = getParagraphEntries(editor, editor.selection)
	if (!paragraphs.length) {
		return false
	}

	Editor.withoutNormalizing(editor, () => {
		paragraphs.forEach(([, path]) => {
			Transforms.setNodes(editor, patch as Partial<CanvasSlateParagraph>, { at: path })
		})
	})

	return true
}

function getCollapsedSelectionTextStyle(editor: BaseEditor, defaultStyle?: TextStyle): TextStyle {
	const leafStyle = getLeafStyleAtSelection(editor)
	const marksStyle = getSelectionMarksStyle(editor)
	return mergeTextStyle(mergeTextStyle(defaultStyle, leafStyle), marksStyle)
}

function getExpandedSelectionTextStyles(editor: BaseEditor, defaultStyle?: TextStyle): TextStyle[] {
	const selection = editor.selection
	if (!selection) {
		return [mergeTextStyle(defaultStyle)]
	}

	const textEntries = Array.from(
		Editor.nodes(editor, {
			at: selection,
			match: (node) => Text.isText(node),
		}),
	).filter(([, path]) => {
		const nodeRange = Editor.range(editor, path)
		const intersection = Range.intersection(nodeRange, selection)
		return Boolean(intersection && !Range.isCollapsed(intersection))
	})
	if (!textEntries.length) {
		return [mergeTextStyle(defaultStyle)]
	}

	return textEntries.map(([node]) => {
		const textNode = node as CanvasSlateText
		return mergeTextStyle(defaultStyle, textNode.style)
	})
}

function getLeafStyleAtSelection(editor: BaseEditor): TextStyle | undefined {
	const selection = editor.selection
	if (!selection) {
		return undefined
	}

	try {
		const [leaf] = Editor.leaf(editor, selection.anchor)
		return (leaf as CanvasSlateText).style
	} catch {
		return undefined
	}
}

function getSelectionMarksStyle(editor: BaseEditor): TextStyle | undefined {
	const marks = Editor.marks(editor) as { style?: TextStyle } | null
	return marks?.style
}

function splitSelectionTextBoundaries(editor: BaseEditor, selection: BaseRange): void {
	const [start, end] = Range.edges(selection)
	Transforms.splitNodes(editor, {
		at: end,
		match: (node) => Text.isText(node),
	})
	Transforms.splitNodes(editor, {
		at: start,
		match: (node) => Text.isText(node),
	})
}

function getParagraphEntries(editor: BaseEditor, selection: BaseRange) {
	return Array.from(
		Editor.nodes(editor, {
			at: selection,
			match: (node) =>
				SlateElement.isElement(node) && (node as CanvasSlateParagraph).type === "paragraph",
		}),
	)
}

function applyTextStylePatch(
	currentStyle: TextStyle | undefined,
	patch: Partial<TextStyle>,
): TextStyle {
	return {
		...(currentStyle || {}),
		...patch,
	}
}

function getUniformValue<T>(values: T[]): T | null {
	if (!values.length) {
		return null
	}

	const [firstValue, ...restValues] = values
	return restValues.every((value) => areValuesEqual(value, firstValue)) ? firstValue : null
}

function areValuesEqual(left: unknown, right: unknown): boolean {
	return normalizeComparableValue(left) === normalizeComparableValue(right)
}

function normalizeComparableValue(value: unknown): string {
	if (typeof value === "number") {
		return `${value}`
	}
	if (typeof value === "boolean") {
		return value ? "true" : "false"
	}
	if (value === null || value === undefined) {
		return "null"
	}
	return String(value)
}

function normalizeFontWeight(value: TextStyle["fontWeight"]): number | string | null {
	if (value === undefined) {
		return null
	}
	if (typeof value === "number") {
		return value
	}
	const parsedValue = Number.parseInt(value, 10)
	return Number.isNaN(parsedValue) ? value : parsedValue
}
