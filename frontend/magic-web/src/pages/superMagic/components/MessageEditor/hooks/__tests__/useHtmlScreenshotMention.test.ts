import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import {
	resetHtmlScreenshotTargetStore,
	setHtmlScreenshotMention,
} from "../../services/HtmlScreenshotTargetStore"
import { useHtmlScreenshotMention } from "../useHtmlScreenshotMention"

describe("useHtmlScreenshotMention", () => {
	afterEach(() => {
		resetHtmlScreenshotTargetStore()
	})

	it("rebuilds a local mention from captureId when the store is empty", () => {
		const { result } = renderHook(() => useHtmlScreenshotMention("element:#hero:1", null))

		expect(result.current?.data).toMatchObject({
			storage_id: "element:#hero:1",
			file_id: "element:#hero:1",
			is_html_screenshot: true,
		})
	})

	it("prefers an uploaded mention over the capture id", () => {
		const uploaded = {
			type: MentionItemType.PROJECT_FILE,
			data: { file_id: "file-1", file_name: "hero.png" },
		}
		setHtmlScreenshotMention("element:#hero:1", {
			type: MentionItemType.UPLOAD_FILE,
			data: { storage_id: "element:#hero:1", is_html_screenshot: true },
		})

		const { result } = renderHook(() => useHtmlScreenshotMention("element:#hero:1", uploaded))

		expect(result.current).toEqual(uploaded)
	})
})
