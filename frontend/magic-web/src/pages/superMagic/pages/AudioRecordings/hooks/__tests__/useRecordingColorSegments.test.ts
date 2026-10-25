import { describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/react"
import { useRecordingColorSegments } from "../useRecordingColorSegments"

describe("useRecordingColorSegments", () => {
	it("returns undefined when summary is not ready", () => {
		const { result } = renderHook(() => useRecordingColorSegments(false, "## Topics\n"))
		expect(result.current).toBeUndefined()
	})

	it("returns undefined when topics markdown is missing", () => {
		const { result } = renderHook(() => useRecordingColorSegments(true, undefined))
		expect(result.current).toBeUndefined()
	})

	it("maps topics markdown into waveform color segments when ready", () => {
		const topicsMarkdown = `
## Topics

### 📌 demo_topic | Demo Topic | #a8d5f7

#### Key Points
Summary body.

#### Related Dialogue
- \`00:10-00:20\` Speaker-1: Discussed the plan
`

		const { result } = renderHook(() => useRecordingColorSegments(true, topicsMarkdown))

		expect(result.current).toEqual([
			{ start: 0, end: 20, color: "#0d6efd", name: "Demo Topic" },
		])
	})
})
