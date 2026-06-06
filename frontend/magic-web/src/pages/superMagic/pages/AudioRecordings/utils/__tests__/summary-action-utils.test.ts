import { describe, expect, it } from "vitest"
import {
	canClickSummaryButton,
	canSubmitSummary,
	getSummaryButtonVariant,
	resolveSummaryModelId,
	shouldPollSummaryProgress,
	shouldShowSummaryButton,
} from "../summary-action-utils"

describe("summary-action-utils", () => {
	it("shows generate button for merging completed", () => {
		expect(shouldShowSummaryButton("merging", "completed")).toBe(true)
		expect(getSummaryButtonVariant("merging", "completed")).toBe("generate")
		expect(canClickSummaryButton("merging", "completed", false)).toBe(true)
	})

	it("shows retry button for summarizing failed", () => {
		expect(shouldShowSummaryButton("summarizing", "failed")).toBe(true)
		expect(getSummaryButtonVariant("summarizing", "failed")).toBe("retry")
		expect(canClickSummaryButton("summarizing", "failed", false)).toBe(true)
	})

	it("hides button while summarizing in progress", () => {
		expect(shouldShowSummaryButton("summarizing", "in_progress")).toBe(false)
		expect(canClickSummaryButton("summarizing", "in_progress", false)).toBe(false)
	})

	it("disables button while submitting", () => {
		expect(canClickSummaryButton("merging", "completed", true)).toBe(false)
	})

	it("validates submit params per audio source", () => {
		expect(
			canSubmitSummary({
				task_key: "session-Android-1",
				topic_id: "topic-1",
				audio_source: "recorded",
			}),
		).toBe(true)

		expect(
			canSubmitSummary({
				task_key: "session-Android-1",
				topic_id: "topic-1",
				audio_source: "imported",
				audio_file_id: "file-1",
			}),
		).toBe(true)

		expect(
			canSubmitSummary({
				task_key: "session-Android-1",
				topic_id: "topic-1",
				audio_source: "imported",
			}),
		).toBe(false)
	})

	it("resolves model_id from item extra before API auto model", () => {
		expect(resolveSummaryModelId("item-model", "auto-model-from-api")).toBe("item-model")
		expect(resolveSummaryModelId(undefined, "auto-model-from-api")).toBe("auto-model-from-api")
		expect(resolveSummaryModelId(undefined, undefined)).toBeUndefined()
	})

	it("registers polling only for summarizing in progress with task_key", () => {
		expect(shouldPollSummaryProgress("summarizing", "in_progress", "task-1")).toBe(true)
		expect(shouldPollSummaryProgress("merging", "completed", "task-1")).toBe(false)
		expect(shouldPollSummaryProgress("summarizing", "in_progress", undefined)).toBe(false)
	})
})
