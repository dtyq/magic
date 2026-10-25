import { parseMarkdownFileLinkSyntaxAt } from "./markdownFileLinkSyntax"
import {
	classifyMarkdownFileHref,
	parseCanonicalWorkspaceHref,
	parseMarkdownFileHref,
	type MarkdownFileTarget,
} from "./markdownFileReference"

export {
	classifyMarkdownFileHref,
	createCanonicalWorkspaceHref,
	createReferencedProjectHref,
	createUserFileHref,
	normalizeUserRelativePath,
	isValidProjectReferenceId,
	getReferencedProjectMountBasePath,
	isMarkdownFileHrefCandidate,
	isReferencedProjectHrefCandidate,
	isWorkspaceHrefCandidate,
	normalizeWorkspacePathForComparison,
	normalizeWorkspaceRelativePath,
	parseCanonicalWorkspaceHref,
	parseMarkdownFileHref,
	parseReferencedProjectHref,
	type MarkdownFileTarget,
} from "./markdownFileReference"

export const FILE_PATH_MENTION_PREFIX = "[@file_path:"

export interface FilePathMentionMatch {
	path: string
	startIndex: number
	endIndex: number
	fullMatch: string
}

export interface WorkspaceMarkdownLinkMatch extends FilePathMentionMatch {
	label: string
	href: string
}

export interface WorkspaceFileReferenceMatch extends FilePathMentionMatch {
	source: "markdown" | "legacy"
	label?: string
	href?: string
}

export interface MarkdownFileLinkMatch extends FilePathMentionMatch {
	label: string
	href: string
	target: MarkdownFileTarget
}

export function escapeMarkdownLinkLabel(label: string): string {
	return label
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[\\[\]]/g, "\\$&")
}

export function escapeHtmlText(value: string): string {
	return value.replace(/[&<>"']/g, (char) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		}
		return entities[char]
	})
}

function parseMarkdownLinkSyntaxAt(content: string, startIndex: number) {
	const match = parseMarkdownFileLinkSyntaxAt(content, startIndex)
	return match && !match.image ? match : null
}

function parseWorkspaceMarkdownLinkAt(
	content: string,
	startIndex: number,
): WorkspaceMarkdownLinkMatch | null {
	const syntax = parseMarkdownLinkSyntaxAt(content, startIndex)
	if (!syntax) return null

	const path = parseCanonicalWorkspaceHref(syntax.href)
	return path ? { ...syntax, path } : null
}

function parseMarkdownFileLinkAt(
	content: string,
	startIndex: number,
): MarkdownFileLinkMatch | null {
	const syntax = parseMarkdownLinkSyntaxAt(content, startIndex)
	if (!syntax) return null

	const target = parseMarkdownFileHref(syntax.href)
	return target ? { ...syntax, path: target.relativePath, target } : null
}

function readFenceMarker(
	content: string,
	index: number,
): { marker: string; endIndex: number } | null {
	const lineStart = index === 0 || content[index - 1] === "\n"
	if (!lineStart) return null

	let cursor = index
	let leadingSpaces = 0
	while (content[cursor] === " " && leadingSpaces < 3) {
		cursor++
		leadingSpaces++
	}

	const markerChar = content[cursor]
	if (markerChar !== "`" && markerChar !== "~") return null

	let markerEnd = cursor
	while (content[markerEnd] === markerChar) markerEnd++
	if (markerEnd - cursor < 3) return null

	return { marker: content.slice(cursor, markerEnd), endIndex: markerEnd }
}

function extractMarkdownLinks<T extends FilePathMentionMatch>(
	content: string,
	parseLinkAt: (content: string, startIndex: number) => T | null,
): T[] {
	if (!content.includes("](")) return []

	const matches: T[] = []
	let index = 0
	let fenceMarker = ""

	while (index < content.length) {
		const fence = readFenceMarker(content, index)
		if (fence && (!fenceMarker || fence.marker[0] === fenceMarker[0])) {
			if (!fenceMarker) {
				fenceMarker = fence.marker
			} else if (fence.marker.length >= fenceMarker.length) {
				fenceMarker = ""
			}
			index = fence.endIndex
			continue
		}

		if (fenceMarker) {
			index++
			continue
		}

		if (content[index] === "`") {
			let runEnd = index
			while (content[runEnd] === "`") runEnd++
			const marker = content.slice(index, runEnd)
			const closeIndex = content.indexOf(marker, runEnd)
			index = closeIndex === -1 ? runEnd : closeIndex + marker.length
			continue
		}

		if (content[index] === "[") {
			const match = parseLinkAt(content, index)
			if (match) {
				matches.push(match)
				index = match.endIndex
				continue
			}
		}
		if (content[index] === "\\") {
			index += 2
			continue
		}

		index++
	}

	return matches
}

export function extractWorkspaceMarkdownLinks(content: string): WorkspaceMarkdownLinkMatch[] {
	return extractMarkdownLinks(content, parseWorkspaceMarkdownLinkAt)
}

export function extractMarkdownFileLinks(content: string): MarkdownFileLinkMatch[] {
	return extractMarkdownLinks(content, parseMarkdownFileLinkAt)
}

/** 无效但明确的文件链接也应保留为正文，不能触发长文本上传。 */
export function containsMarkdownFileReference(content: string): boolean {
	return (
		extractMarkdownLinks(content, (text, index) => {
			const syntax = parseMarkdownLinkSyntaxAt(text, index)
			if (!syntax) return null
			const result = classifyMarkdownFileHref(syntax.href)
			return result.target || result.explicitFileReference
				? { ...syntax, path: syntax.href }
				: null
		}).length > 0
	)
}

function parseQuotedFilePath(
	content: string,
	start: number,
	quote: '"' | "'",
): { path: string; endIndex: number } | null {
	let index = start
	let path = ""

	while (index < content.length) {
		const char = content[index]
		if (char === "\\") {
			if (index + 1 >= content.length) return null
			path += content[index + 1]
			index += 2
			continue
		}
		if (char === quote) {
			index++
			if (content[index] === "]") {
				return { path, endIndex: index + 1 }
			}
			return null
		}
		path += char
		index++
	}

	return null
}

function sliceUntilNextMentionOrClose(content: string, start: number): string {
	let end = content.length
	const mentionIndex = content.indexOf(FILE_PATH_MENTION_PREFIX, start)
	if (mentionIndex !== -1) {
		end = Math.min(end, mentionIndex)
	}

	const closeIndex = content.indexOf("]", start)
	if (closeIndex !== -1) {
		end = Math.min(end, closeIndex)
	}

	return content.slice(start, end)
}

function looksLikePathSegment(segment: string): boolean {
	const trimmed = segment.trim()
	if (!trimmed) return false
	if (trimmed.includes("/") || trimmed.includes(".")) return true
	if (trimmed.startsWith("[")) return true
	return false
}

function hasPathContinuationAfter(content: string, indexAfterClose: number): boolean {
	let index = indexAfterClose
	while (index < content.length && content[index] === " ") {
		index++
	}
	if (index >= content.length) return false
	if (content[index] === "\n" || content[index] === "\r") return false
	if (content.startsWith(FILE_PATH_MENTION_PREFIX, index)) return false

	return looksLikePathSegment(sliceUntilNextMentionOrClose(content, index))
}

function parseUnquotedFilePath(
	content: string,
	start: number,
): { path: string; endIndex: number } | null {
	let depth = 0
	let index = start

	while (index < content.length) {
		const char = content[index]
		if (char === "[") {
			depth++
		} else if (char === "]") {
			if (depth === 0) {
				// A bare closing bracket deterministically ends an unquoted mention.
				// Paths containing an unmatched `]` must use the quoted syntax instead.
				return { path: content.slice(start, index), endIndex: index + 1 }
			}

			depth--
			if (depth === 0) {
				if (hasPathContinuationAfter(content, index + 1)) {
					index++
					continue
				}
				return { path: content.slice(start, index), endIndex: index + 1 }
			}
		}
		index++
	}

	return null
}

export function parseFilePathMentionAt(
	content: string,
	fromIndex = 0,
): FilePathMentionMatch | null {
	const startIndex = content.indexOf(FILE_PATH_MENTION_PREFIX, fromIndex)
	if (startIndex === -1) return null

	const pathStart = startIndex + FILE_PATH_MENTION_PREFIX.length
	if (pathStart >= content.length) return null

	const firstChar = content[pathStart]
	const parsed =
		firstChar === '"' || firstChar === "'"
			? parseQuotedFilePath(content, pathStart + 1, firstChar)
			: parseUnquotedFilePath(content, pathStart)

	if (!parsed) return null

	const path = parsed.path.trim()
	if (!path) return null

	return {
		path,
		startIndex,
		endIndex: parsed.endIndex,
		fullMatch: content.slice(startIndex, parsed.endIndex),
	}
}

export function extractFilePathMentions(content: string): FilePathMentionMatch[] {
	if (!content.includes(FILE_PATH_MENTION_PREFIX)) return []

	const matches: FilePathMentionMatch[] = []
	let searchFrom = 0

	while (searchFrom < content.length) {
		const prefixIndex = content.indexOf(FILE_PATH_MENTION_PREFIX, searchFrom)
		if (prefixIndex === -1) break

		const match = parseFilePathMentionAt(content, prefixIndex)
		if (match) {
			matches.push(match)
			searchFrom = match.endIndex
			continue
		}

		searchFrom = prefixIndex + 1
	}

	return matches
}

export function extractWorkspaceFileReferences(content: string): WorkspaceFileReferenceMatch[] {
	const markdownMatches: WorkspaceFileReferenceMatch[] = extractWorkspaceMarkdownLinks(
		content,
	).map((match) => ({ ...match, source: "markdown" }))
	const legacyMatches: WorkspaceFileReferenceMatch[] = extractFilePathMentions(content).map(
		(match) => ({ ...match, source: "legacy" }),
	)

	return [...markdownMatches, ...legacyMatches].sort(
		(first, second) => first.startIndex - second.startIndex,
	)
}

export function replaceFilePathMentions(
	content: string,
	replacer: (path: string, match: FilePathMentionMatch) => string,
): string {
	const matches = extractFilePathMentions(content)
	if (matches.length === 0) return content

	let result = ""
	let lastIndex = 0

	for (const match of matches) {
		result += content.slice(lastIndex, match.startIndex)
		result += replacer(match.path, match)
		lastIndex = match.endIndex
	}

	result += content.slice(lastIndex)
	return result
}

export function replaceFilePathMentionsOutsideFencedCode(
	content: string,
	replacer: (path: string, match: FilePathMentionMatch) => string,
): string {
	const lines = content.split(/(\r?\n)/)
	let fenceCharacter: "`" | "~" | null = null
	let fenceLength = 0
	let outsideBuffer = ""
	let result = ""

	const flushOutsideBuffer = () => {
		if (!outsideBuffer) return
		result += replaceFilePathMentions(outsideBuffer, replacer)
		outsideBuffer = ""
	}

	for (const line of lines) {
		const fenceMatch = line.match(/^(?: {0,3})(`{3,}|~{3,})/)
		if (fenceMatch) {
			flushOutsideBuffer()
			const marker = fenceMatch[1]
			const markerCharacter = marker[0] as "`" | "~"
			if (!fenceCharacter) {
				fenceCharacter = markerCharacter
				fenceLength = marker.length
			} else if (markerCharacter === fenceCharacter && marker.length >= fenceLength) {
				fenceCharacter = null
				fenceLength = 0
			}
			result += line
			continue
		}

		if (fenceCharacter) {
			result += line
		} else {
			outsideBuffer += line
		}
	}

	flushOutsideBuffer()
	return result
}
