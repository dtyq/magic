import { beforeEach, describe, expect, it } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import {
	clearHtmlScreenshotMentionMemory,
	forgetHtmlScreenshotByStorageId,
	getHtmlScreenshotMention,
	resetHtmlScreenshotTargetStore,
	setHtmlScreenshotMention,
	subscribeHtmlScreenshotTarget,
} from "../HtmlScreenshotTargetStore"

const mention = {
	type: MentionItemType.UPLOAD_FILE,
	data: {
		file_id: "storage-1",
		file_name: "hero.png",
		file_path: "storage-1",
		file_extension: "png",
		file_size: 3,
		is_html_screenshot: true,
		storage_id: "storage-1",
	},
}

describe("HtmlScreenshotTargetStore", () => {
	beforeEach(() => {
		resetHtmlScreenshotTargetStore()
	})

	it("notifies subscribers when a target mention is stored", () => {
		const seen: unknown[] = []
		const unsubscribe = subscribeHtmlScreenshotTarget("element:#hero:1", () => {
			seen.push(getHtmlScreenshotMention("element:#hero:1"))
		})

		setHtmlScreenshotMention("element:#hero:1", mention)

		expect(seen).toEqual([mention])
		unsubscribe()
	})

	it("does not restore a mention after the in-memory store is cleared", () => {
		setHtmlScreenshotMention("element:#hero:1", mention)
		clearHtmlScreenshotMentionMemory()

		expect(getHtmlScreenshotMention("element:#hero:1")).toBeUndefined()
	})

	it("forgets a target by storage id after upload cleanup", () => {
		setHtmlScreenshotMention("element:#hero:1", mention)
		forgetHtmlScreenshotByStorageId("storage-1")
		expect(getHtmlScreenshotMention("element:#hero:1")).toBeUndefined()
	})
})
