import { Children, isValidElement } from "react"
import type { ReactNode } from "react"
import {
	HTML_CODE_BLOCK_PREVIEW_CANVAS_WIDTH,
	HTML_CODE_BLOCK_PREVIEW_WIDE_CANVAS_WIDTH_CANDIDATES,
} from "./constants"
import type { HtmlCodeBlockPreviewCodeBlockInfo } from "./types"

const HTML_CODE_BLOCK_LANGUAGE = "html"
const MARKDOWN_CODE_BLOCK_LANGUAGE = "markdown"
const HTML_PREVIEW_CANVAS_STYLE_WIDTH_PATTERN = /(?:min-|max-)?width\s*:\s*(\d{3,4})px\b/gi
const HTML_PREVIEW_CANVAS_ATTRIBUTE_WIDTH_PATTERN = /\bwidth\s*=\s*["']?(\d{3,4})["']?/gi
const FENCE_LINE_PATTERN = /^\s*```([\w-]*)\s*$/
const HTML_FENCE_LINE_PATTERN = /^\s*```html\s*$/i
const CLOSING_FENCE_LINE_PATTERN = /^\s*```\s*$/
// 把 Markdown 里的 HTML 代码块识别出来、标准化、回溯完整源码，并为预览布局提供基础数据。
function extractTextContent(children: ReactNode): string {
	if (typeof children === "string" || typeof children === "number") return String(children)

	if (Array.isArray(children)) return children.map((child) => extractTextContent(child)).join("")

	if (isValidElement(children))
		return extractTextContent((children.props as { children?: ReactNode }).children)

	return ""
}

export function extractHtmlFencedCodeBlocksFromMarkdown(markdown: string): string[] {
	const htmlCodeBlocks: string[] = []
	const lines = markdown.split(/\r?\n/)
	let currentFenceLanguage: string | null = null
	let currentBlockLines: string[] = []
	let nestedFenceLanguage: string | null = null
	let nestedBlockLines: string[] = []

	for (const line of lines) {
		const fenceMatch = line.match(FENCE_LINE_PATTERN)

		if (currentFenceLanguage === null) {
			if (fenceMatch) {
				currentFenceLanguage = fenceMatch[1]?.trim().toLowerCase() || ""
				currentBlockLines = []
			}
			continue
		}

		if (nestedFenceLanguage) {
			if (CLOSING_FENCE_LINE_PATTERN.test(line)) {
				const nestedBlockContent = nestedBlockLines.join("\n")
				const resolvedNestedHtmlCodeBlock = resolveFencedHtmlCodeBlock(
					nestedFenceLanguage,
					nestedBlockContent,
				)

				if (resolvedNestedHtmlCodeBlock) htmlCodeBlocks.push(resolvedNestedHtmlCodeBlock)

				nestedFenceLanguage = null
				nestedBlockLines = []
				continue
			}

			nestedBlockLines.push(line)
			continue
		}

		if (
			currentFenceLanguage === MARKDOWN_CODE_BLOCK_LANGUAGE &&
			HTML_FENCE_LINE_PATTERN.test(line)
		) {
			nestedFenceLanguage = HTML_CODE_BLOCK_LANGUAGE
			nestedBlockLines = []
			continue
		}

		if (!fenceMatch) {
			currentBlockLines.push(line)
			continue
		}

		const fencedBlockContent = currentBlockLines.join("\n")
		const resolvedHtmlCodeBlock = resolveFencedHtmlCodeBlock(
			currentFenceLanguage,
			fencedBlockContent,
		)

		if (resolvedHtmlCodeBlock) htmlCodeBlocks.push(resolvedHtmlCodeBlock)

		currentFenceLanguage = null
		currentBlockLines = []
	}

	return htmlCodeBlocks
}

export function normalizeMarkdownWrappedHtmlFencedCodeBlocks(markdown: string): string {
	const lines = markdown.split(/\r?\n/)
	const normalizedLines: string[] = []
	let currentFenceLanguage: string | null = null
	let currentFenceOpeningLine: string | null = null
	let currentBlockLines: string[] = []
	let isInsideNestedHtmlFence = false

	function flushCurrentBlock(isClosed: boolean) {
		if (currentFenceLanguage === null || !currentFenceOpeningLine) return

		if (currentFenceLanguage === MARKDOWN_CODE_BLOCK_LANGUAGE) {
			const nestedHtmlCode = resolveNestedHtmlFenceCode(currentBlockLines.join("\n"))

			if (nestedHtmlCode) {
				normalizedLines.push("```html", nestedHtmlCode, "```")
			} else {
				normalizedLines.push(
					currentFenceOpeningLine,
					...currentBlockLines,
					...(isClosed ? ["```"] : []),
				)
			}
		} else {
			normalizedLines.push(
				currentFenceOpeningLine,
				...currentBlockLines,
				...(isClosed ? ["```"] : []),
			)
		}

		currentFenceLanguage = null
		currentFenceOpeningLine = null
		currentBlockLines = []
		isInsideNestedHtmlFence = false
	}

	for (const line of lines) {
		const fenceMatch = line.match(FENCE_LINE_PATTERN)

		if (currentFenceLanguage === null) {
			if (fenceMatch) {
				currentFenceLanguage = fenceMatch[1]?.trim().toLowerCase() || ""
				currentFenceOpeningLine = line
				currentBlockLines = []
				continue
			}

			normalizedLines.push(line)
			continue
		}

		if (currentFenceLanguage === MARKDOWN_CODE_BLOCK_LANGUAGE && isInsideNestedHtmlFence) {
			currentBlockLines.push(line)
			if (CLOSING_FENCE_LINE_PATTERN.test(line)) isInsideNestedHtmlFence = false
			continue
		}

		if (
			currentFenceLanguage === MARKDOWN_CODE_BLOCK_LANGUAGE &&
			HTML_FENCE_LINE_PATTERN.test(line)
		) {
			isInsideNestedHtmlFence = true
			currentBlockLines.push(line)
			continue
		}

		if (fenceMatch) {
			flushCurrentBlock(true)
			continue
		}

		currentBlockLines.push(line)
	}

	if (currentFenceLanguage !== null) flushCurrentBlock(false)

	return normalizedLines.join("\n")
}

function normalizeDoctypeHtmlCode(code: string): string | undefined {
	const normalizedCode = code.trimStart()

	if (!/^<!doctype html/i.test(normalizedCode)) return undefined

	return normalizedCode.trimEnd()
}

function resolveNestedHtmlFenceCode(code: string): string | undefined {
	const lines = code.split(/\r?\n/)
	let nestedBlockLines: string[] | null = null

	for (const line of lines) {
		if (!nestedBlockLines) {
			if (HTML_FENCE_LINE_PATTERN.test(line)) nestedBlockLines = []
			continue
		}

		if (CLOSING_FENCE_LINE_PATTERN.test(line))
			return normalizeDoctypeHtmlCode(nestedBlockLines.join("\n"))

		nestedBlockLines.push(line)
	}

	return undefined
}

function resolveFencedHtmlCodeBlock(language: string, blockContent: string): string | undefined {
	if (language === HTML_CODE_BLOCK_LANGUAGE || !language) {
		return normalizeDoctypeHtmlCode(blockContent)
	}

	if (language === MARKDOWN_CODE_BLOCK_LANGUAGE) {
		return normalizeDoctypeHtmlCode(blockContent) ?? resolveNestedHtmlFenceCode(blockContent)
	}

	return undefined
}

export function resolveHtmlPreviewCanvasWidth(code: string): number {
	const matchedWidths = [
		...collectMatchedWidths(code, HTML_PREVIEW_CANVAS_STYLE_WIDTH_PATTERN),
		...collectMatchedWidths(code, HTML_PREVIEW_CANVAS_ATTRIBUTE_WIDTH_PATTERN),
	]
	const widestMatchedWidth = Math.max(HTML_CODE_BLOCK_PREVIEW_CANVAS_WIDTH, ...matchedWidths)

	return (
		HTML_CODE_BLOCK_PREVIEW_WIDE_CANVAS_WIDTH_CANDIDATES.find(
			(candidateWidth) => widestMatchedWidth <= candidateWidth,
		) ??
		HTML_CODE_BLOCK_PREVIEW_WIDE_CANVAS_WIDTH_CANDIDATES[
			HTML_CODE_BLOCK_PREVIEW_WIDE_CANVAS_WIDTH_CANDIDATES.length - 1
		]
	)
}

function normalizeRenderedHtmlCode(renderCode: string): string {
	return renderCode
		.replace(/<cursor\/>\s*$/i, "")
		.replace(/\s*\.\.\.\s*$/, "")
		.trimEnd()
}

function collectMatchedWidths(code: string, pattern: RegExp): number[] {
	return Array.from(code.matchAll(pattern))
		.map((match) => Number(match[1]))
		.filter((width) => Number.isFinite(width) && width >= HTML_CODE_BLOCK_PREVIEW_CANVAS_WIDTH)
}

export function resolveFullHtmlCodeBlock(
	renderCode: string,
	fullCodeBlocks: string[],
): string | undefined {
	if (fullCodeBlocks.length === 1) return fullCodeBlocks[0]

	const normalizedRenderCode = normalizeRenderedHtmlCode(renderCode)
	if (!normalizedRenderCode) return undefined

	const exactMatchedCode = fullCodeBlocks.find((fullCode) => fullCode === normalizedRenderCode)
	if (exactMatchedCode) return exactMatchedCode

	const prefixMatchedBlocks = fullCodeBlocks.filter((fullCode) =>
		fullCode.startsWith(normalizedRenderCode),
	)

	if (prefixMatchedBlocks.length > 0) {
		return prefixMatchedBlocks.sort((left, right) => right.length - left.length)[0]
	}

	return undefined
}

export function extractCodeBlockInfo(
	children: ReactNode,
): HtmlCodeBlockPreviewCodeBlockInfo | null {
	const childNodes = Children.toArray(children)
	const codeNode = childNodes.find((child) => isValidElement(child) && child.type === "code")

	if (!isValidElement(codeNode)) return null

	return {
		className:
			typeof (codeNode.props as { className?: unknown }).className === "string"
				? ((codeNode.props as { className?: string }).className ?? undefined)
				: undefined,
		code: extractTextContent((codeNode.props as { children?: ReactNode }).children),
	}
}

export function isHtmlCodeLanguage(className?: string): boolean {
	return isCodeLanguage(className, HTML_CODE_BLOCK_LANGUAGE)
}

export function isMarkdownCodeLanguage(className?: string): boolean {
	return isCodeLanguage(className, MARKDOWN_CODE_BLOCK_LANGUAGE)
}

export function resolveHtmlPreviewCode(
	codeBlockInfo: HtmlCodeBlockPreviewCodeBlockInfo | null,
): string | undefined {
	if (!codeBlockInfo) return undefined

	if (isHtmlCodeLanguage(codeBlockInfo.className) || !codeBlockInfo.className) {
		return normalizeDoctypeHtmlCode(codeBlockInfo.code)
	}

	if (isMarkdownCodeLanguage(codeBlockInfo.className)) {
		return (
			normalizeDoctypeHtmlCode(codeBlockInfo.code) ??
			resolveNestedHtmlFenceCode(codeBlockInfo.code)
		)
	}

	return undefined
}

function isCodeLanguage(className: string | undefined, language: string): boolean {
	if (!className) return false

	const tokens = className
		.split(/\s+/)
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean)

	return tokens.some(
		(token) =>
			token === language || token === `lang-${language}` || token === `language-${language}`,
	)
}
