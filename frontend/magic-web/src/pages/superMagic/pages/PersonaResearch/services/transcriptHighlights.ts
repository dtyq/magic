export interface HighlightMark {
	text: string
	/** Hypothesis id the quote supports ("H1"), shown after the highlight. */
	tag?: string
}

export interface HighlightSegment {
	text: string
	mark?: { tag?: string }
}

/** Shorter fragments match too loosely in Chinese text to be worth highlighting. */
const MIN_FRAGMENT = 6

/**
 * Splits an answer into plain and highlighted segments for the quotes cited from it.
 * Quotes in reports are often trimmed with "……", so each side of an ellipsis is matched on its
 * own; surrounding quotation marks are ignored. Overlaps keep the earlier match.
 */
export function splitHighlights(text: string, marks: HighlightMark[]): HighlightSegment[] {
	const ranges: { start: number; end: number; tag?: string }[] = []
	for (const mark of marks) {
		for (const fragment of fragmentsOf(mark.text)) {
			const start = text.indexOf(fragment)
			if (start >= 0) ranges.push({ start, end: start + fragment.length, tag: mark.tag })
		}
	}
	ranges.sort((a, b) => a.start - b.start || b.end - a.end)

	const segments: HighlightSegment[] = []
	let cursor = 0
	for (const range of ranges) {
		if (range.start < cursor) continue
		if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start) })
		segments.push({ text: text.slice(range.start, range.end), mark: { tag: range.tag } })
		cursor = range.end
	}
	if (cursor < text.length || segments.length === 0) segments.push({ text: text.slice(cursor) })
	return segments
}

function fragmentsOf(quote: string): string[] {
	return quote
		.split(/……|…|\.\.\./)
		.map((part) =>
			part
				.trim()
				.replace(/^[“"「『]+|[”"」』]+$/g, "")
				.trim(),
		)
		.filter((part) => part.length >= MIN_FRAGMENT)
}
