import { describe, expect, it } from "vitest"
import { getEditorPanelMode } from "@/opensource/components/business/RecordingSummary/internal/editorPanel/getEditorPanelMode"

describe("getEditorPanelMode", () => {
	it("returns recording when the current topic is being recorded", () => {
		expect(
			getEditorPanelMode({
				isRecording: true,
				isPaused: false,
				isCurrentRecording: true,
				isOtherTabRecording: false,
				isMediaRecorderNotSupported: false,
			}),
		).toBe("recording")
	})

	it("returns blocked when recording exists outside the current topic", () => {
		expect(
			getEditorPanelMode({
				isRecording: true,
				isPaused: false,
				isCurrentRecording: false,
				isOtherTabRecording: false,
				isMediaRecorderNotSupported: false,
			}),
		).toBe("blocked")
	})

	it("returns idle when there is no active recording conflict", () => {
		expect(
			getEditorPanelMode({
				isRecording: false,
				isPaused: false,
				isCurrentRecording: false,
				isOtherTabRecording: false,
				isMediaRecorderNotSupported: false,
			}),
		).toBe("idle")
	})
})
