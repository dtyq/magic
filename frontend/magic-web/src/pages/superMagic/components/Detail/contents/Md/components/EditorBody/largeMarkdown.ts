import { slugify } from "@/utils/slug"

// 200 KiB = 204,800 bytes. The threshold is inclusive, so a document whose UTF-8 size is
// exactly this already counts as large.
export const LARGE_MARKDOWN_THRESHOLD_BYTES = 200 * 1024

// The threshold is inclusive: a document whose UTF-8 size is exactly
// LARGE_MARKDOWN_THRESHOLD_BYTES already counts as large. Every comparison below is
// expressed against the exclusive limit so the O(1) fast paths stay valid and the
// boundary only has to be changed in one place.
const LARGE_MARKDOWN_EXCLUSIVE_LIMIT_BYTES = LARGE_MARKDOWN_THRESHOLD_BYTES - 1

const TARGET_CHUNK_SIZE = 48 * 1024
const MAX_CHUNK_SIZE = 96 * 1024

export interface VirtualMarkdownChunk {
	id: string
	start: number
	end: number
	prefix?: string
	suffix?: string
	headingSlugs: string[]
}

/**
 * Counts UTF-8 bytes without allocating another multi-megabyte buffer.
 * The early limit makes the normal small-document path stop scanning as soon as possible.
 */
export function exceedsUtf8ByteLimit(content: string, limit: number): boolean {
	let bytes = 0

	for (let index = 0; index < content.length; index += 1) {
		const code = content.charCodeAt(index)

		if (code <= 0x7f) {
			bytes += 1
		} else if (code <= 0x7ff) {
			bytes += 2
		} else if (code >= 0xd800 && code <= 0xdbff) {
			const next = content.charCodeAt(index + 1)
			if (next >= 0xdc00 && next <= 0xdfff) {
				bytes += 4
				index += 1
			} else {
				bytes += 3
			}
		} else {
			bytes += 3
		}

		if (bytes > limit) return true
	}

	return false
}

export function isLargeMarkdownContent(content: string): boolean {
	// ASCII-heavy generated documents can be classified in O(1). Only the ambiguous
	// multi-byte range needs the exact UTF-8 scan.
	if (content.length > LARGE_MARKDOWN_EXCLUSIVE_LIMIT_BYTES) return true
	if (content.length * 3 <= LARGE_MARKDOWN_EXCLUSIVE_LIMIT_BYTES) return false
	return exceedsUtf8ByteLimit(content, LARGE_MARKDOWN_EXCLUSIVE_LIMIT_BYTES)
}

function normalizeHeadingText(value: string): string {
	return value
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/[*_~`]/g, "")
		.trim()
}

function safeSliceEnd(content: string, end: number): number {
	if (end <= 0 || end >= content.length) return end
	const previous = content.charCodeAt(end - 1)
	const current = content.charCodeAt(end)
	return previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff
		? end - 1
		: end
}

/**
 * Produces source ranges instead of copied chunk strings. Only visible ranges are sliced later,
 * which prevents the virtual preview from retaining a second full copy of a large document.
 */
export function splitMarkdownIntoVirtualChunks(
	content: string,
	targetChunkSize = TARGET_CHUNK_SIZE,
	maxChunkSize = MAX_CHUNK_SIZE,
): VirtualMarkdownChunk[] {
	if (!content) return []

	const chunks: VirtualMarkdownChunk[] = []
	let chunkStart = 0
	let chunkPrefix: string | undefined
	let headingSlugs: string[] = []
	let lineStart = 0
	let fenceMarker = ""
	let fenceInfo = ""
	const headingSlugCounts = new Map<string, number>()

	const pushChunk = (end: number, suffix?: string) => {
		if (end <= chunkStart && !chunkPrefix) return

		chunks.push({
			id: `markdown-chunk-${chunks.length}`,
			start: chunkStart,
			end,
			prefix: chunkPrefix,
			suffix,
			headingSlugs,
		})
		chunkStart = end
		chunkPrefix = undefined
		headingSlugs = []
	}

	while (lineStart < content.length) {
		const newlineIndex = content.indexOf("\n", lineStart)
		const lineEnd = newlineIndex === -1 ? content.length : newlineIndex + 1
		const lineWithoutBreakEnd = newlineIndex === -1 ? content.length : newlineIndex
		const linePreview = content.slice(lineStart, Math.min(lineWithoutBreakEnd, lineStart + 512))
		const wasInsideFence = Boolean(fenceMarker)
		const chunkLengthBeforeLine = lineStart - chunkStart + (chunkPrefix?.length ?? 0)
		const headingMatch = fenceMarker
			? null
			: linePreview.match(/^\s{0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/)

		// Starting a heading in a fresh chunk improves scroll targeting and avoids splitting sections mid-title.
		if (
			headingMatch &&
			(chunkLengthBeforeLine >= targetChunkSize / 2 || lineEnd - chunkStart >= maxChunkSize)
		) {
			pushChunk(lineStart)
		}

		if (headingMatch) {
			const baseSlug = slugify(normalizeHeadingText(headingMatch[2] ?? ""))
			if (baseSlug) {
				const duplicateIndex = headingSlugCounts.get(baseSlug) ?? 0
				headingSlugCounts.set(baseSlug, duplicateIndex + 1)
				headingSlugs.push(duplicateIndex === 0 ? baseSlug : `${baseSlug}-${duplicateIndex}`)
			}
		}

		if (!fenceMarker) {
			const openingFence = linePreview.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/)
			if (openingFence) {
				fenceMarker = openingFence[1] ?? ""
				fenceInfo = (openingFence[2] ?? "").trim()
			}
		} else {
			const closingFencePattern = new RegExp(
				`^\\s{0,3}${fenceMarker[0]}{${fenceMarker.length},}\\s*$`,
			)
			if (closingFencePattern.test(linePreview)) {
				fenceMarker = ""
				fenceInfo = ""
			}
		}

		const chunkLength = lineEnd - chunkStart + (chunkPrefix?.length ?? 0)
		if (fenceMarker && chunkLength >= maxChunkSize) {
			const syntheticFence = `\n${fenceMarker}\n`
			pushChunk(lineEnd, syntheticFence)
			chunkPrefix = `${fenceMarker}${fenceInfo}\n`
		} else if (wasInsideFence && !fenceMarker) {
			// A real closing fence must stay with its code content; treating it as a normal
			// oversized line would create one unclosed code chunk and one orphan closing fence.
			if (chunkLength >= targetChunkSize) pushChunk(lineEnd)
		} else if (!fenceMarker && /^\s*$/.test(linePreview) && chunkLength >= targetChunkSize) {
			pushChunk(lineEnd)
		} else if (!fenceMarker && chunkLength >= maxChunkSize) {
			// A single generated line can be several megabytes. Split it defensively even though
			// inline markdown spanning this boundary may render as plain text in adjacent chunks.
			if (lineStart > chunkStart) pushChunk(lineStart)

			while (lineEnd - chunkStart >= maxChunkSize) {
				const splitEnd = safeSliceEnd(content, chunkStart + maxChunkSize)
				pushChunk(splitEnd)
			}
		}

		lineStart = lineEnd
	}

	pushChunk(content.length, fenceMarker ? `\n${fenceMarker}\n` : undefined)
	return chunks
}

export function getVirtualMarkdownChunkContent(
	content: string,
	chunk: VirtualMarkdownChunk,
): string {
	return `${chunk.prefix ?? ""}${content.slice(chunk.start, chunk.end)}${chunk.suffix ?? ""}`
}
