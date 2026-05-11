import { describe, expect, it } from "vitest"
import { shouldClearEditorAfterSend } from "@/pages/superMagic/services/messageSendEditorPolicy"

describe("messageSendEditorPolicy", () => {
	it("should keep editor content when send opts out of clearing", () => {
		expect(
			shouldClearEditorAfterSend({
				isFromQueue: false,
				shouldClearEditorAfterSend: false,
			}),
		).toBe(false)
	})

	it("should clear editor content for normal sends by default", () => {
		expect(
			shouldClearEditorAfterSend({
				isFromQueue: false,
			}),
		).toBe(true)
	})

	it("should not clear editor content for queued sends", () => {
		expect(
			shouldClearEditorAfterSend({
				isFromQueue: true,
			}),
		).toBe(false)
	})
})
