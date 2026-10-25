import type { RecordingTranscriptSegment } from "../types/recording-detail"
import { parseRecordingTimeToSeconds } from "./time"

// Accept both the current plain header and legacy bold headers emitted by audio HTML bundles.
const TIMED_LINE_REGEX =
	/^\s*(?:-\s*|\*(?!\*)\s*)?(?:\*\*)?\[?(\d{1,3}:\d{2}(?::\d{2})?)\]?\s*(?:[-–—]\s*\[?(\d{1,3}:\d{2}(?::\d{2})?)\]?)?\s*(?:(Speaker-[\w-]+|[^:：]{1,30})[:：](?:\*\*)?)?\s*(.*)$/u

/** Parses completed transcript markdown into seekable timeline segments for the detail workbench. */
export function parseTranscriptMarkdown(markdown: string): RecordingTranscriptSegment[] {
	const segments: RecordingTranscriptSegment[] = []
	const lines = markdown.split(/\r?\n/)

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed) continue

		const match = trimmed.match(TIMED_LINE_REGEX)
		if (!match) {
			appendTranscriptContinuation(segments, trimmed)
			continue
		}

		const [, startText, endText, rawSpeaker, text] = match
		const start = parseRecordingTimeToSeconds(startText)
		const end = endText ? parseRecordingTimeToSeconds(endText) : undefined
		const speaker = rawSpeaker?.trim()

		segments.push({
			id: `${segments.length}-${start}`,
			start,
			end,
			speaker,
			text: text.trim(),
		})
	}

	return segments.map((segment, index) => ({
		...segment,
		end: segment.end ?? segments[index + 1]?.start,
	}))
}

/** Appends multiline transcript body text to the latest timed segment. */
function appendTranscriptContinuation(segments: RecordingTranscriptSegment[], text: string) {
	const current = segments[segments.length - 1]
	if (!current) return

	current.text = [current.text, text].filter(Boolean).join("\n")
}
