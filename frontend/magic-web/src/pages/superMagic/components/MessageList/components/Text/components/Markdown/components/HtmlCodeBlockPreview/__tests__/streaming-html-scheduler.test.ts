import { describe, expect, it } from "vitest"
import {
	resolveStreamingHtmlCommitPolicy,
	shouldCommitStreamingHtml,
} from "../streaming-html-scheduler"

describe("streaming html commit scheduler", () => {
	it("uses larger thresholds for larger documents", () => {
		expect(resolveStreamingHtmlCommitPolicy(1024)).toEqual({
			minInterval: 120,
			minDelta: 256,
			maxWait: 480,
		})
		expect(resolveStreamingHtmlCommitPolicy(60 * 1024)).toEqual({
			minInterval: 320,
			minDelta: 2048,
			maxWait: 900,
		})
	})

	it("does not starve small changes and allows structural boundaries", () => {
		expect(
			shouldCommitStreamingHtml({
				now: 120,
				firstPendingAt: 0,
				lastCommittedAt: 0,
				committedLength: 100,
				safeContent: "x".repeat(120),
			}),
		).toBe(false)
		expect(
			shouldCommitStreamingHtml({
				now: 480,
				firstPendingAt: 0,
				lastCommittedAt: 0,
				committedLength: 100,
				safeContent: "x".repeat(120),
			}),
		).toBe(true)
		expect(
			shouldCommitStreamingHtml({
				now: 120,
				firstPendingAt: 0,
				lastCommittedAt: 0,
				committedLength: 100,
				safeContent: "x".repeat(100) + "</head>",
			}),
		).toBe(true)
	})
})
