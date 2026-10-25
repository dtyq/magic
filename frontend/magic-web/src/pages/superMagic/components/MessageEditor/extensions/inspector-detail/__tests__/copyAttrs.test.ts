import { describe, expect, expectTypeOf, it } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { sanitizeCopiedInspectorDetailAttrs } from "../copyAttrs"

const localScreenshotMention = {
	type: MentionItemType.UPLOAD_FILE,
	data: {
		file_id: "storage-1",
		file_name: "hero.png",
		file_path: "storage-1",
		file_extension: "png",
		is_html_screenshot: true,
		storage_id: "storage-1",
	},
}

const projectScreenshotMention = {
	type: MentionItemType.PROJECT_FILE,
	data: {
		file_id: "file-1",
		file_name: "hero.png",
		file_path: "/hero.png",
		file_extension: "png",
	},
}

describe("sanitizeCopiedInspectorDetailAttrs", () => {
	it("clears the live screenshot captureId when copying into the editor", () => {
		const copied = sanitizeCopiedInspectorDetailAttrs({
			selector: "#hero",
			textContent: "Hero",
			captureId: "element:#hero:1",
		})

		expect(copied.captureId).toBeNull()
		expect(copied.selector).toBe("#hero")
		expect(copied.textContent).toBe("Hero")
	})

	it("drops a local IndexedDB screenshot mention", () => {
		const copied = sanitizeCopiedInspectorDetailAttrs({
			selector: "#hero",
			screenshotMention: localScreenshotMention,
			captureId: "element:#hero:1",
		})

		expect(copied.captureId).toBeNull()
		expect(copied.screenshotMention).toBeNull()
	})

	it("keeps an uploaded project screenshot mention", () => {
		const copied = sanitizeCopiedInspectorDetailAttrs({
			selector: "#hero",
			screenshotMention: projectScreenshotMention,
			captureId: "element:#hero:1",
		})

		expect(copied.captureId).toBeNull()
		expect(copied.screenshotMention).toEqual(projectScreenshotMention)
	})

	it("accepts a required string captureId and returns a nullable one", () => {
		const attrs: { selector: string; captureId: string } = {
			selector: "#hero",
			captureId: "element:#hero:1",
		}

		const copied = sanitizeCopiedInspectorDetailAttrs(attrs)

		expect(copied.captureId).toBeNull()
		expectTypeOf(copied.captureId).toEqualTypeOf<string | null | undefined>()
	})
})
