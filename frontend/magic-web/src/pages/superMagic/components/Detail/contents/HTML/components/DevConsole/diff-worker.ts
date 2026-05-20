/**
 * Web Worker for computing line+char level diff between raw and processed HTML.
 * Uses the `diff` (jsdiff) library — Myers O(ND) algorithm.
 *
 * Input message:  { rawText: string; processedText: string }
 * Output message: { diffMap: Array<[lineIndex, LineDiffInfo]> }
 */

import { diffLines, diffChars, type Change } from "diff"

interface CharSegment {
	text: string
	type: "equal" | "added" | "removed"
}

type LineDiffType = "added" | "modified"

interface LineDiffInfo {
	type: LineDiffType
	charDiff?: CharSegment[]
}

function changesToCharSegments(changes: Change[]): CharSegment[] {
	return changes
		.filter((c) => !c.removed) // for display we show "equal" and "added" segments
		.map((c) => ({
			text: c.value,
			type: c.added ? ("added" as const) : ("equal" as const),
		}))
}

function computeDiff(rawText: string, processedText: string): Array<[number, LineDiffInfo]> {
	const lineChanges = diffLines(rawText, processedText)
	const result: Array<[number, LineDiffInfo]> = []

	let procLineIdx = 0
	let prevRemovedValue: string | null = null

	for (const change of lineChanges) {
		if (change.removed) {
			// Save removed text for potential char-level diff with next "added" block
			prevRemovedValue = (prevRemovedValue ?? "") + change.value
			continue
		}

		if (change.added) {
			const addedLines = change.value.split("\n")
			// Last element after split is "" if value ends with \n
			const lineCount = change.value.endsWith("\n")
				? addedLines.length - 1
				: addedLines.length

			if (prevRemovedValue != null) {
				// Modified block: compute char-level diff between removed and added
				const charChanges = diffChars(prevRemovedValue, change.value)
				const segments = changesToCharSegments(charChanges)

				// Distribute segments across lines
				let segIdx = 0
				let segOffset = 0
				for (let i = 0; i < lineCount; i++) {
					const lineSegs: CharSegment[] = []
					const targetLine = addedLines[i]
					let consumed = 0
					while (consumed < targetLine.length && segIdx < segments.length) {
						const seg = segments[segIdx]
						const remaining = seg.text.length - segOffset
						const need = targetLine.length - consumed
						if (remaining <= need) {
							lineSegs.push({
								text: seg.text.slice(segOffset, segOffset + remaining),
								type: seg.type,
							})
							consumed += remaining
							segIdx++
							segOffset = 0
						} else {
							lineSegs.push({
								text: seg.text.slice(segOffset, segOffset + need),
								type: seg.type,
							})
							segOffset += need
							consumed += need
						}
					}
					// Skip past the \n separator in segments
					if (segIdx < segments.length) {
						const seg = segments[segIdx]
						const ch = seg.text[segOffset]
						if (ch === "\n") {
							segOffset++
							if (segOffset >= seg.text.length) {
								segIdx++
								segOffset = 0
							}
						}
					}
					result.push([
						procLineIdx + i,
						{
							type: "modified",
							charDiff:
								lineSegs.length > 0
									? lineSegs
									: [{ text: targetLine, type: "added" }],
						},
					])
				}
				prevRemovedValue = null
			} else {
				// Purely added lines
				for (let i = 0; i < lineCount; i++) {
					result.push([procLineIdx + i, { type: "added" }])
				}
			}
			procLineIdx += lineCount
		} else {
			// Equal block — just advance line counter
			prevRemovedValue = null
			const eqLines = change.value.split("\n")
			const lineCount = change.value.endsWith("\n") ? eqLines.length - 1 : eqLines.length
			procLineIdx += lineCount
		}
	}

	return result
}

self.addEventListener("message", (e: MessageEvent<{ rawText: string; processedText: string }>) => {
	const { rawText, processedText } = e.data
	const diffMap = computeDiff(rawText, processedText)
	self.postMessage({ diffMap })
})
