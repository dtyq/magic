import { describe, expect, it } from "vitest"
import { resolveMediaEditorSubmissionVisibility } from "../mediaEditorSubmissionVisibility"

function resolve(
	options: Partial<Parameters<typeof resolveMediaEditorSubmissionVisibility>[0]> = {},
) {
	return resolveMediaEditorSubmissionVisibility({
		hasActiveSubmission: false,
		hasDismissedSubmission: false,
		isGenerating: false,
		isTimedOut: false,
		isRetryEditing: false,
		...options,
	})
}

describe("resolveMediaEditorSubmissionVisibility", () => {
	it("keeps the editor visible while idle", () => {
		expect(resolve()).toBe(false)
	})

	it.each(["preparing", "validating", "submitting"] as const)(
		"hides the editor during the %s phase",
		() => {
			expect(resolve({ hasActiveSubmission: true })).toBe(true)
		},
	)

	it("keeps the editor hidden after generation starts", () => {
		expect(resolve({ hasDismissedSubmission: true, isGenerating: true })).toBe(true)
		expect(resolve({ hasDismissedSubmission: true })).toBe(true)
	})

	it("reveals the editor for timeout recovery", () => {
		expect(
			resolve({
				hasDismissedSubmission: true,
				isTimedOut: true,
			}),
		).toBe(false)
	})

	it("reveals the editor when the user starts retry editing", () => {
		expect(
			resolve({
				hasDismissedSubmission: true,
				isRetryEditing: true,
			}),
		).toBe(false)
	})

	it("keeps an active retry submission hidden", () => {
		expect(resolve({ hasActiveSubmission: true, isRetryEditing: true })).toBe(true)
		expect(resolve({ isGenerating: true, isTimedOut: true })).toBe(true)
	})
})
