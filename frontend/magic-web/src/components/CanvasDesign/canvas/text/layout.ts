import type { RichTextParagraph, TextStyle } from "../types"
import {
	cloneRichTextParagraphs,
	DEFAULT_TEXT_LETTER_SPACING,
	DEFAULT_TEXT_LINE_HEIGHT,
	getRichTextListMarker,
	getResolvedTextDefaultStyle,
	mergeTextStyle,
	normalizeRichTextParagraphs,
	toFontStyle,
	toFontWeight,
	toTextDecoration,
} from "./richText"

interface CharacterMeasurement {
	text: string
	rect: DOMRect
	style: TextStyle
	styleKey: string
	backgroundColor?: string
	isListMarker?: boolean
}

export interface RichTextRenderChunk {
	text: string
	x: number
	y: number
	width: number
	height: number
	style: TextStyle
	backgroundColor?: string
	isListMarker?: boolean
}

export interface RichTextLayoutResult {
	width: number
	height: number
	chunks: RichTextRenderChunk[]
	content: RichTextParagraph[]
}

const MEASUREMENT_ROOT_ID = "canvas-rich-text-measurement-root"

function getMeasurementHost(): HTMLDivElement {
	let host = document.getElementById(MEASUREMENT_ROOT_ID) as HTMLDivElement | null
	if (host) {
		return host
	}

	host = document.createElement("div")
	host.id = MEASUREMENT_ROOT_ID
	host.style.position = "fixed"
	host.style.left = "-100000px"
	host.style.top = "0"
	host.style.visibility = "hidden"
	host.style.pointerEvents = "none"
	host.style.zIndex = "-1"
	host.style.whiteSpace = "normal"
	document.body.appendChild(host)
	return host
}

function applySharedTextStyle(element: HTMLElement, style: TextStyle): void {
	element.style.fontSize = `${style.fontSize ?? 16}px`
	element.style.fontFamily = style.fontFamily || "sans-serif"
	element.style.color = style.color || "#0a0a0a"
	element.style.fontWeight = `${toFontWeight(style) ?? 400}`
	element.style.fontStyle = toFontStyle(style) || "normal"
	element.style.textDecoration = toTextDecoration(style)
	element.style.letterSpacing = `${style.letterSpacing ?? DEFAULT_TEXT_LETTER_SPACING}px`
	if (style.backgroundColor) {
		element.style.backgroundColor = style.backgroundColor
	}
}

function buildMeasurementTree(
	content: RichTextParagraph[],
	defaultStyle?: TextStyle,
): { root: HTMLDivElement; characters: CharacterMeasurement[] } {
	const root = document.createElement("div")
	root.style.display = "inline-block"
	root.style.width = "max-content"
	root.style.maxWidth = "none"
	root.style.minWidth = "1px"
	root.style.margin = "0"
	root.style.padding = "0"
	root.style.background = "transparent"
	root.style.whiteSpace = "pre-wrap"
	root.style.wordBreak = "break-word"
	root.style.overflowWrap = "anywhere"
	root.style.boxSizing = "border-box"

	const characters: CharacterMeasurement[] = []
	let orderedListIndex = 0

	content.forEach((paragraph, paragraphIndex) => {
		const paragraphElement = document.createElement("div")
		paragraphElement.style.margin = "0"
		paragraphElement.style.padding = "0"
		// Keep the paragraph strut independent from text defaultStyle; leaf spans own their font size.
		paragraphElement.style.fontSize = "16px"
		paragraphElement.style.whiteSpace = "pre-wrap"
		paragraphElement.style.wordBreak = "break-word"
		paragraphElement.style.overflowWrap = "anywhere"
		paragraphElement.style.textAlign = paragraph.style?.textAlign || "left"
		paragraphElement.style.lineHeight = `${
			paragraph.style?.lineHeight ?? DEFAULT_TEXT_LINE_HEIGHT
		}`
		if (paragraph.style?.paragraphSpacing && paragraphIndex < content.length - 1) {
			paragraphElement.style.marginBottom = `${paragraph.style.paragraphSpacing}px`
		}

		const listMarkerIndex =
			paragraph.style?.listType === "ordered" ? orderedListIndex++ : paragraphIndex
		const listMarker = getRichTextListMarker(paragraph.style?.listType, listMarkerIndex)
		if (listMarker) {
			const markerStyle = mergeTextStyle(defaultStyle, paragraph.children?.[0]?.style)
			const markerStyleKey = JSON.stringify(markerStyle)
			Array.from(listMarker).forEach((char) => {
				const span = document.createElement("span")
				span.textContent = char
				applySharedTextStyle(span, markerStyle)
				span.style.display = "inline"
				paragraphElement.appendChild(span)
				characters.push({
					text: char,
					rect: new DOMRect(),
					style: markerStyle,
					styleKey: markerStyleKey,
					backgroundColor: markerStyle.backgroundColor,
					isListMarker: true,
				})
			})
		}

		const children = paragraph.children || []
		if (children.length === 0) {
			const placeholder = document.createElement("span")
			placeholder.textContent = "\u200b"
			applySharedTextStyle(placeholder, mergeTextStyle(defaultStyle))
			placeholder.dataset.placeholder = "true"
			paragraphElement.appendChild(placeholder)
			root.appendChild(paragraphElement)
			return
		}

		children.forEach((node) => {
			const mergedStyle = mergeTextStyle(defaultStyle, node.style)
			const styleKey = JSON.stringify(mergedStyle)
			const text = node.text ?? ""
			const chars = text.length > 0 ? Array.from(text) : ["\u200b"]

			chars.forEach((char) => {
				const span = document.createElement("span")
				span.textContent = char
				applySharedTextStyle(span, mergedStyle)
				span.style.display = "inline"
				if (char === "\u200b") {
					span.dataset.placeholder = "true"
				}
				paragraphElement.appendChild(span)
				characters.push({
					text: char,
					rect: new DOMRect(),
					style: mergedStyle,
					styleKey,
					backgroundColor: mergedStyle.backgroundColor,
				})
			})
		})

		root.appendChild(paragraphElement)
	})

	return { root, characters }
}

function approxEqual(left: number, right: number, tolerance = 0.5): boolean {
	return Math.abs(left - right) <= tolerance
}

export function measureRichTextLayout(
	content?: RichTextParagraph[],
	defaultStyle?: TextStyle,
): RichTextLayoutResult {
	const resolvedDefaultStyle = getResolvedTextDefaultStyle(defaultStyle)

	if (typeof document === "undefined") {
		return {
			width: 0,
			height: 0,
			chunks: [],
			content: cloneRichTextParagraphs(content),
		}
	}

	const normalizedContent = normalizeRichTextParagraphs(content, resolvedDefaultStyle)
	const host = getMeasurementHost()
	const { root, characters } = buildMeasurementTree(normalizedContent, resolvedDefaultStyle)

	host.appendChild(root)

	const rootRect = root.getBoundingClientRect()
	const spanElements = Array.from(root.querySelectorAll("span"))

	spanElements.forEach((span, index) => {
		characters[index].rect = span.getBoundingClientRect()
	})

	const chunks: RichTextRenderChunk[] = []
	let currentChunk: RichTextRenderChunk | null = null
	let lastRectRight = 0

	characters.forEach((character) => {
		if (character.text === "\u200b") {
			currentChunk = null
			lastRectRight = 0
			return
		}

		const x = character.rect.left - rootRect.left
		const y = character.rect.top - rootRect.top
		const width = character.rect.width
		const height = character.rect.height

		const shouldMerge =
			currentChunk &&
			currentChunk.text.length > 0 &&
			currentChunk.backgroundColor === character.backgroundColor &&
			currentChunk.isListMarker === character.isListMarker &&
			JSON.stringify(currentChunk.style) === character.styleKey &&
			approxEqual(currentChunk.y, y) &&
			approxEqual(lastRectRight, character.rect.left)

		if (shouldMerge && currentChunk) {
			currentChunk.text += character.text
			currentChunk.width = character.rect.right - rootRect.left - currentChunk.x
			currentChunk.height = Math.max(currentChunk.height, height)
			lastRectRight = character.rect.right
			return
		}

		currentChunk = {
			text: character.text,
			x,
			y,
			width,
			height,
			style: character.style,
			backgroundColor: character.backgroundColor,
			isListMarker: character.isListMarker,
		}
		chunks.push(currentChunk)
		lastRectRight = character.rect.right
	})

	root.remove()

	return {
		width: Math.ceil(rootRect.width),
		height: Math.ceil(rootRect.height),
		chunks,
		content: normalizedContent,
	}
}
