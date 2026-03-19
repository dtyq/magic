import { describe, it, expect, beforeEach } from "vitest"
import EditorModeSwitchService from "../EditorModeSwitchService"
import { RecordingSummaryEditorMode } from "../../hooks/useRecordingSummaryEditorMode"
import { platformKey } from "@/opensource/utils/storage"

const storageKey = platformKey("recording-summary-editor-mode")

describe("EditorModeSwitchService", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("stores and reads editor mode by user", () => {
		EditorModeSwitchService.saveDefaultEditorMode({
			userId: "user-a",
			topicId: "topic-1",
			editorMode: RecordingSummaryEditorMode.Editing,
		})

		expect(
			EditorModeSwitchService.getEditorMode({ userId: "user-a", topicId: "topic-1" }),
		).toBe(RecordingSummaryEditorMode.Editing)
		expect(
			EditorModeSwitchService.getEditorMode({ userId: "user-b", topicId: "topic-1" }),
		).toBe(RecordingSummaryEditorMode.Recording)
		expect(
			EditorModeSwitchService.hasDefaultEditorMode({ userId: "user-a", topicId: "topic-1" }),
		).toBe(true)
		expect(
			EditorModeSwitchService.hasDefaultEditorMode({ userId: "user-b", topicId: "topic-1" }),
		).toBe(false)
	})

	it("migrates legacy scattered keys and falls back to legacy bucket", () => {
		const legacyKey = `${storageKey}/legacy-topic`
		localStorage.setItem(legacyKey, RecordingSummaryEditorMode.Editing)

		const mode = EditorModeSwitchService.getEditorMode({
			userId: "user-a",
			topicId: "legacy-topic",
		})

		expect(mode).toBe(RecordingSummaryEditorMode.Editing)
		expect(localStorage.getItem(legacyKey)).toBeNull()

		const stored = localStorage.getItem(storageKey)
		expect(stored).toBeTruthy()

		const parsed = stored ? JSON.parse(stored) : null
		expect(parsed?.users?.legacy?.["legacy-topic"]).toBe(RecordingSummaryEditorMode.Editing)
	})
})
