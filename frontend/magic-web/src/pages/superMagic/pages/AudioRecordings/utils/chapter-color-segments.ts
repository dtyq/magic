import type { RecordingTopicSection } from "../types/recording-detail"

/** Flat time-range segment used to paint the chapter color line on the waveform. */
export interface FlatColorSegment {
	start: number
	end: number
	color: string
	name: string
}

/**
 * Derives waveform chapter color bands from parsed topics markdown sections.
 * Uses each topic's related-dialogue time ranges to infer start/end boundaries.
 * Adjacent bands are snapped together and the first band starts at 0 so the
 * colored line spans the waveform edge-to-edge without exposed gray gaps.
 */
export function buildColorSegmentsFromTopics(topics: RecordingTopicSection[]): FlatColorSegment[] {
	const segments = topics
		.map((topic) => {
			if (topic.items.length === 0) return null

			const start = Math.min(...topic.items.map((item) => item.time))
			const end = Math.max(...topic.items.map((item) => item.timeEnd ?? item.time))
			if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null

			return { start, end, color: topic.color, name: topic.name }
		})
		.filter((segment): segment is FlatColorSegment => segment != null)
		.slice()
		.sort((a, b) => a.start - b.start)

	// Anchor the first band to 0 and butt each band against the previous one.
	// Without this, the leading silence and gaps between chapters leave gray
	// stretches where no topic color overlays the base waveform line.
	for (let index = 0; index < segments.length; index++) {
		if (index === 0) {
			segments[index].start = 0
		} else {
			segments[index].start = segments[index - 1].end
		}
	}

	return segments
}
