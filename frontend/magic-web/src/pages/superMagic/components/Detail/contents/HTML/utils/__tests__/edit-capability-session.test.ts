import { beforeEach, describe, expect, it } from "vitest"
import { readCachedHtmlEditButton, writeCachedHtmlEditButton } from "../edit-capability-session"

describe("edit-capability-session", () => {
	beforeEach(() => {
		sessionStorage.clear()
	})

	it("stores and reads the latest visibility by file id", () => {
		writeCachedHtmlEditButton("file-a", true)

		expect(readCachedHtmlEditButton("file-a")).toBe(true)
		expect(readCachedHtmlEditButton("file-b")).toBeUndefined()
	})

	it("ignores malformed snapshots", () => {
		sessionStorage.setItem("magic-html-edit-button:file-a", "not-json")

		expect(readCachedHtmlEditButton("file-a")).toBeUndefined()
	})

	it("removes expired snapshots", () => {
		sessionStorage.setItem(
			"magic-html-edit-button:file-a",
			JSON.stringify({ visible: true, savedAt: Date.now() - 31 * 60 * 1000 }),
		)

		expect(readCachedHtmlEditButton("file-a")).toBeUndefined()
		expect(sessionStorage.getItem("magic-html-edit-button:file-a")).toBeNull()
	})
})
