import MarkdownIt from "markdown-it"
import { getLanguage } from "@/pages/superMagic/utils/handleFIle"
import { fileExtFromPath } from "@/pages/superMagic/components/MessageList/utils/attachmentByFilePath"
import { decodePartialJsonString } from "../../preview/streamingJsonStringField"

export type WriteFileContentBlockType =
	| "heading"
	| "paragraph"
	| "list"
	| "blockquote"
	| "table"
	| "code"
	| "plain"

export type WriteFileContentBlockRenderMode = "markdown" | "code" | "plain"

export interface WriteFileContentSource {
	filePath: string
	content: string
}

export interface MarkdownBlockDraft {
	type: WriteFileContentBlockType
	content: string
	language?: string
}

export interface WriteFileContentBlock {
	id: string
	type: WriteFileContentBlockType
	content: string
	hash: string
	isStable: boolean
	isOversized: boolean
	renderMode: WriteFileContentBlockRenderMode
}

export interface CreateStableBlocksOptions {
	loading?: boolean
	maxBlockBytes?: number
	maxBlockLines?: number
}

export const WRITE_FILE_OVERSIZED_BLOCK_BYTES = 50 * 1024
export const WRITE_FILE_OVERSIZED_BLOCK_LINES = 3000
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdx"])

const OVERSIZED_CHUNK_BYTES = 16 * 1024
const OVERSIZED_CHUNK_LINES = 300

const markdownBlockParser = new MarkdownIt({
	html: false,
	linkify: false,
	typographer: false,
})

interface MarkdownItBlockToken {
	type: string
	map: [number, number] | null
	info: string
	content: string
}

interface MarkdownSourceRange {
	type: "table" | "code"
	startLine: number
	endLine: number
	content?: string
	language?: string
}

function extractClosedJsonStringField(args: string, key: string): string {
	const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
	const match = args.match(pattern)
	return match ? decodePartialJsonString(match[1]) : ""
}

function extractPartialJsonStringField(args: string, key: string): string {
	const keyIndex = args.indexOf(`"${key}"`)
	if (keyIndex === -1) return ""

	const colonIndex = args.indexOf(":", keyIndex + key.length + 2)
	if (colonIndex === -1) return ""

	const quoteIndex = args.indexOf('"', colonIndex + 1)
	if (quoteIndex === -1) return ""

	return decodePartialJsonString(args.slice(quoteIndex + 1))
}

export function parseWriteFileContentSource(
	args: string,
	detailData?: Record<string, unknown>,
): WriteFileContentSource {
	if (typeof detailData?.content === "string") {
		return {
			filePath: String(detailData.file_path ?? detailData.path ?? ""),
			content: detailData.content,
		}
	}

	const rawArgs = args || (typeof detailData?.arguments === "string" ? detailData.arguments : "")
	if (!rawArgs) return { filePath: "", content: "" }

	try {
		const parsed = JSON.parse(rawArgs) as Record<string, unknown>
		return {
			filePath: String(parsed.file_path ?? parsed.path ?? ""),
			content: typeof parsed.content === "string" ? parsed.content : "",
		}
	} catch {
		// Partial JSON during streaming is expected.
	}

	return {
		filePath:
			extractClosedJsonStringField(rawArgs, "file_path") ||
			extractClosedJsonStringField(rawArgs, "path"),
		content: extractPartialJsonStringField(rawArgs, "content"),
	}
}

// WriteFile must continue to render through XMarkdown, but the written content is not always markdown.
// If raw html/css/js/json source is passed through directly, XMarkdown will still parse it with markdown rules,
// which can split a single source file into mixed paragraph / heading / code block nodes.
// That is what causes the visual break where one part looks like plain text and a later part looks like a code block.
// Normalize non-markdown files into a fenced code block first so XMarkdown treats the whole payload as one code block.
export function normalizeWriteFileMarkdownInput(source: WriteFileContentSource): string {
	const { content, filePath } = source
	if (!content) return ""

	const fileExtension = fileExtFromPath(filePath || "")
	if (MARKDOWN_EXTENSIONS.has(fileExtension)) return content

	const language = getLanguage(filePath || "")
	const normalizedContent = content.endsWith("\n") ? content : `${content}\n`
	return `\`\`\`${language}\n${normalizedContent}\`\`\``
}

function splitLinesPreservingNewline(content: string): string[] {
	if (!content) return []

	const lines = content.match(/.*(?:\n|$)/g) ?? []
	if (lines[lines.length - 1] === "") {
		lines.pop()
	}
	return lines
}

function stripLineEnding(line: string) {
	return line.replace(/\r?\n$/, "")
}

function isBlankLine(line: string) {
	return line.trim() === ""
}

function isHeadingLine(line: string) {
	return /^\s{0,3}#{1,6}\s+/.test(line)
}

function isListLine(line: string) {
	return /^\s*(?:[-*+] |\d+[.)]\s+)/.test(line)
}

function isBlockquoteLine(line: string) {
	return /^\s*>/.test(line)
}

function joinBlock(lines: string[], start: number, end: number) {
	return lines
		.slice(start, end)
		.join("")
		.replace(/\r?\n$/, "")
}

function getTokenRange(token: MarkdownItBlockToken, lineCount: number) {
	if (!token.map) return undefined

	const [startLine, endLine] = token.map
	const normalizedStartLine = Math.max(0, Math.min(lineCount, startLine))
	const normalizedEndLine = Math.max(normalizedStartLine, Math.min(lineCount, endLine))

	if (normalizedEndLine <= normalizedStartLine) return undefined

	return {
		startLine: normalizedStartLine,
		endLine: normalizedEndLine,
	}
}

function getFenceLanguage(info: string) {
	return info.trim().split(/\s+/, 1)[0]
}

function collectTableRange(
	tokens: MarkdownItBlockToken[],
	startIndex: number,
	lineCount: number,
): MarkdownSourceRange | undefined {
	let nesting = 0
	let endIndex = startIndex
	let startLine = Number.POSITIVE_INFINITY
	let endLine = -1

	for (let index = startIndex; index < tokens.length; index += 1) {
		const token = tokens[index]
		const range = getTokenRange(token, lineCount)

		if (range) {
			startLine = Math.min(startLine, range.startLine)
			endLine = Math.max(endLine, range.endLine)
		}

		if (token.type === "table_open") {
			nesting += 1
		} else if (token.type === "table_close") {
			nesting -= 1
			if (nesting === 0) {
				endIndex = index
				break
			}
		}
	}

	const openingRange = getTokenRange(tokens[startIndex], lineCount)
	if (openingRange) {
		startLine = Math.min(startLine, openingRange.startLine)
		endLine = Math.max(endLine, openingRange.endLine)
	}

	if (!Number.isFinite(startLine) || endLine <= startLine || endIndex === startIndex) {
		return undefined
	}

	return {
		type: "table",
		startLine,
		endLine,
	}
}

function collectMarkdownSourceRanges(content: string, lineCount: number): MarkdownSourceRange[] {
	let tokens: MarkdownItBlockToken[] = []

	try {
		tokens = markdownBlockParser.parse(content, {}) as MarkdownItBlockToken[]
	} catch {
		return []
	}

	const ranges: MarkdownSourceRange[] = []

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index]

		if (token.type === "table_open") {
			const range = collectTableRange(tokens, index, lineCount)
			if (range) ranges.push(range)
			continue
		}

		if (token.type === "fence" || token.type === "code_block") {
			const range = getTokenRange(token, lineCount)
			if (!range) continue

			ranges.push({
				type: "code",
				startLine: range.startLine,
				endLine: range.endLine,
				content: token.content,
				language: token.type === "fence" ? getFenceLanguage(token.info) : undefined,
			})
		}
	}

	return ranges
		.sort((left, right) => {
			if (left.startLine !== right.startLine) return left.startLine - right.startLine
			if (left.type === right.type) return right.endLine - left.endLine
			return left.type === "table" ? -1 : 1
		})
		.reduce<MarkdownSourceRange[]>((merged, range) => {
			const previous = merged[merged.length - 1]
			if (previous && range.startLine < previous.endLine) return merged
			merged.push(range)
			return merged
		}, [])
}

function getMarkdownLineType(line: string): WriteFileContentBlockType {
	if (isHeadingLine(line)) return "heading"
	if (isListLine(line)) return "list"
	if (isBlockquoteLine(line)) return "blockquote"
	return "paragraph"
}

function appendMarkdownLineBlock(blocks: MarkdownBlockDraft[], line: string) {
	if (isBlankLine(line)) return

	blocks.push({
		type: getMarkdownLineType(line),
		content: stripLineEnding(line),
	})
}

function appendCodeLineBlocks(blocks: MarkdownBlockDraft[], range: MarkdownSourceRange) {
	const codeLines = splitLinesPreservingNewline(range.content ?? "")
	if (codeLines.length === 0) return

	for (const line of codeLines) {
		blocks.push({
			type: "code",
			content: stripLineEnding(line),
			language: range.language,
		})
	}
}

export function splitMarkdownBlocks(content: string): MarkdownBlockDraft[] {
	const lines = splitLinesPreservingNewline(content)
	const ranges = collectMarkdownSourceRanges(content, lines.length)
	const blocks: MarkdownBlockDraft[] = []
	let index = 0
	let rangeIndex = 0

	while (index < lines.length) {
		const range = ranges[rangeIndex]

		if (range && index === range.startLine) {
			if (range.type === "table") {
				blocks.push({
					type: "table",
					content: joinBlock(lines, range.startLine, range.endLine),
				})
			} else {
				appendCodeLineBlocks(blocks, range)
			}

			index = range.endLine
			rangeIndex += 1
			continue
		}

		if (range && index > range.startLine) {
			index = Math.max(index, range.endLine)
			rangeIndex += 1
			continue
		}

		appendMarkdownLineBlock(blocks, lines[index])
		index += 1
	}

	return blocks
}

export function hashBlockContent(content: string): string {
	let hash = 5381
	for (let index = 0; index < content.length; index += 1) {
		hash = (hash * 33) ^ content.charCodeAt(index)
	}
	return (hash >>> 0).toString(36)
}

function countLines(content: string) {
	if (!content) return 0
	return content.split("\n").length
}

export function shouldDegradeBlock(
	content: string,
	options: Pick<CreateStableBlocksOptions, "maxBlockBytes" | "maxBlockLines"> = {},
) {
	const maxBlockBytes = options.maxBlockBytes ?? WRITE_FILE_OVERSIZED_BLOCK_BYTES
	const maxBlockLines = options.maxBlockLines ?? WRITE_FILE_OVERSIZED_BLOCK_LINES
	return content.length > maxBlockBytes || countLines(content) > maxBlockLines
}

export function splitOversizedBlock(block: MarkdownBlockDraft): MarkdownBlockDraft[] {
	const lines = splitLinesPreservingNewline(block.content)
	if (lines.length <= OVERSIZED_CHUNK_LINES && block.content.length <= OVERSIZED_CHUNK_BYTES) {
		return [{ type: "plain", content: block.content }]
	}

	const chunks: MarkdownBlockDraft[] = []
	let chunkLines: string[] = []
	let chunkLength = 0

	for (const line of lines) {
		const shouldFlush =
			chunkLines.length > 0 &&
			(chunkLines.length >= OVERSIZED_CHUNK_LINES ||
				chunkLength + line.length > OVERSIZED_CHUNK_BYTES)

		if (shouldFlush) {
			chunks.push({
				type: "plain",
				content: chunkLines.join("").replace(/\s+$/, ""),
			})
			chunkLines = []
			chunkLength = 0
		}

		chunkLines.push(line)
		chunkLength += line.length
	}

	if (chunkLines.length > 0) {
		chunks.push({ type: "plain", content: chunkLines.join("").replace(/\s+$/, "") })
	}

	return chunks
}

export function createStableBlocks(
	content: string,
	options: CreateStableBlocksOptions = {},
): WriteFileContentBlock[] {
	const drafts = splitMarkdownBlocks(content)
	const expandedDrafts = drafts.flatMap((block) => {
		if (!shouldDegradeBlock(block.content, options)) return [block]
		return splitOversizedBlock(block)
	})

	return expandedDrafts.map((block, index) => {
		const isLastBlock = index === expandedDrafts.length - 1
		const renderableContent = block.content
		const hash = hashBlockContent(renderableContent)
		const isOversized =
			block.type === "plain" && drafts.some((draft) => draft.content.includes(block.content))

		return {
			id: `${block.type}-${index}-${hash}`,
			type: block.type,
			content: renderableContent,
			hash,
			isStable: !options.loading || !isLastBlock,
			isOversized,
			renderMode: isOversized ? "plain" : block.type === "code" ? "code" : "markdown",
		}
	})
}
