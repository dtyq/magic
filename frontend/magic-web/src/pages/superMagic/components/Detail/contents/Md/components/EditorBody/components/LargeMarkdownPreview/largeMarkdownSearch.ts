import type { VirtualMarkdownChunk } from "../../largeMarkdown"
import { MAX_REGEX_QUERY_LENGTH, isPotentiallyUnsafeRegex, tryCreateRegex } from "@/utils/safeRegex"

export interface MarkdownSearchResult {
	id: string
	chunkIndex: number
	start: number
	end: number
	preview: string
}

export interface MarkdownSearchRequest {
	content: string
	chunks: VirtualMarkdownChunk[]
	query: string
	caseSensitive: boolean
	useRegex?: boolean
}

const MAX_SEARCH_RESULTS = 1000
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function advanceByCodePoint(content: string, index: number): number {
	const first = content.charCodeAt(index)
	const second = content.charCodeAt(index + 1)
	return first >= 0xd800 && first <= 0xdbff && second >= 0xdc00 && second <= 0xdfff
		? index + 2
		: index + 1
}

function getChunkIndex(chunks: VirtualMarkdownChunk[], start: number, end: number): number {
	// A match that crosses a chunk boundary is navigated from the chunk containing its start.
	// This keeps navigation deterministic while the highlight plugin can decorate both sides.
	const index = chunks.findIndex((chunk) => start < chunk.end && end > chunk.start)
	return index === -1 ? 0 : index
}

export function searchMarkdown({
	content,
	chunks,
	query,
	caseSensitive,
	useRegex = false,
}: MarkdownSearchRequest): MarkdownSearchResult[] {
	if (!query) return []
	const matcher = tryCreateRegex(
		useRegex ? query : escapeRegExp(query),
		caseSensitive ? "gu" : "giu",
		useRegex,
	)
	if (!matcher) return []
	const results: MarkdownSearchResult[] = []
	let match: RegExpExecArray | null

	let iterations = 0
	while (iterations < MAX_SEARCH_RESULTS && (match = matcher.exec(content)) !== null) {
		iterations += 1
		const start = match.index
		const end = start + match[0].length
		const previewStart = Math.max(0, start - 24)
		const previewEnd = Math.min(content.length, end + 24)
		results.push({
			id: `markdown-search-result-${results.length}`,
			chunkIndex: getChunkIndex(chunks, start, end),
			start,
			end,
			preview: content.slice(previewStart, previewEnd),
		})

		// RegExp.exec does not advance lastIndex for zero-length global matches. Advance by one
		// Unicode code point to guarantee progress without splitting surrogate pairs.
		if (match[0].length === 0) {
			const nextIndex = advanceByCodePoint(content, matcher.lastIndex)
			matcher.lastIndex = nextIndex > matcher.lastIndex ? nextIndex : matcher.lastIndex + 1
		}
	}

	return results
}

export { MAX_REGEX_QUERY_LENGTH, MAX_SEARCH_RESULTS, isPotentiallyUnsafeRegex }
