import { describe, expect, it } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import {
	applyTaskHomeRecordingEditorContext,
	shouldShowMobileHomeRecordStart,
} from "../shouldShowMobileHomeRecordStart"

const editorContext = {
	selectedTopic: null,
	selectedProject: null,
	topicMode: TopicMode.RecordSummary,
	deferProjectCreationUntilSend: true,
	showModeToggle: true,
	allowRecordingMode: false,
} as SceneEditorContext

describe("shouldShowMobileHomeRecordStart", () => {
	it("uses the shared recording expert on the task homepage", () => {
		expect(
			shouldShowMobileHomeRecordStart({
				deferProjectCreationUntilSend: true,
				showModeToggle: true,
				isRecordSummaryEditor: true,
			}),
		).toBe(true)
	})

	it("keeps the text composer on chat home and non-recording employees", () => {
		expect(
			shouldShowMobileHomeRecordStart({
				deferProjectCreationUntilSend: true,
				showModeToggle: false,
				isRecordSummaryEditor: true,
			}),
		).toBe(false)
		expect(
			shouldShowMobileHomeRecordStart({
				deferProjectCreationUntilSend: true,
				showModeToggle: true,
				isRecordSummaryEditor: false,
			}),
		).toBe(false)
	})

	it("forces a new record-summary project and keeps the recording switch on the task homepage", () => {
		expect(applyTaskHomeRecordingEditorContext(editorContext, true)).toMatchObject({
			allowRecordingMode: true,
			allowSelectRecordingProject: false,
			recordingNewProjectTopicMode: TopicMode.RecordSummary,
		})
	})

	it("leaves other editors unchanged", () => {
		expect(applyTaskHomeRecordingEditorContext(editorContext, false)).toBe(editorContext)
	})

	it("leaves project and topic pages on their existing editors", () => {
		expect(
			shouldShowMobileHomeRecordStart({
				deferProjectCreationUntilSend: false,
				showModeToggle: true,
				isRecordSummaryEditor: true,
			}),
		).toBe(false)
	})
})
