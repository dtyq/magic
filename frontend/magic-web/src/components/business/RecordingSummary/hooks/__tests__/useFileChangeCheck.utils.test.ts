import { describe, expect, it } from "vitest"
import { decideNoteFileConflict } from "../useFileChangeCheck.utils"

describe("decideNoteFileConflict", () => {
	it("does not prompt when server content matches current content", () => {
		expect(
			decideNoteFileConflict({
				currentContent: "hello world\n",
				serverContent: "hello world",
			}),
		).toEqual({
			shouldPromptConflict: false,
			matchesCurrentContent: true,
			matchesLastSyncedContent: false,
		})
	})

	it("does not prompt when server content matches last synced content", () => {
		expect(
			decideNoteFileConflict({
				currentContent: "hello world plus local edits",
				serverContent: "hello world",
				lastSyncedContent: "hello world",
			}),
		).toEqual({
			shouldPromptConflict: false,
			matchesCurrentContent: false,
			matchesLastSyncedContent: true,
		})
	})

	it("prompts when server content differs from both current and last synced content", () => {
		expect(
			decideNoteFileConflict({
				currentContent: "local draft",
				serverContent: "remote change",
				lastSyncedContent: "last synced",
			}),
		).toEqual({
			shouldPromptConflict: true,
			matchesCurrentContent: false,
			matchesLastSyncedContent: false,
		})
	})
})
