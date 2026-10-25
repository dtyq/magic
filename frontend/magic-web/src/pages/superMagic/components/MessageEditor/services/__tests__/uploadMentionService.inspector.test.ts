import { beforeEach, describe, expect, it } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { INSPECTOR_DETAIL_TYPE } from "../../extensions/inspector-detail/const"
import { collectMentionItemsFromContent } from "../uploadMentionService"
import {
	resetHtmlScreenshotTargetStore,
	setHtmlScreenshotMention,
} from "../HtmlScreenshotTargetStore"

describe("uploadMentionService inspector-detail mentions", () => {
	beforeEach(() => {
		resetHtmlScreenshotTargetStore()
	})

	it("collects project file mentions stored inside inspector-detail attrs", () => {
		const fileMention = {
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: "file-1",
				file_name: "index.html",
				file_path: "/index.html",
				file_extension: "html",
			},
		}

		const items = collectMentionItemsFromContent({
			type: "doc",
			content: [
				{
					type: INSPECTOR_DETAIL_TYPE,
					attrs: {
						title: "Selected element",
						selector: "body > button.primary",
						tagName: "button",
						size: "120 x 40 px",
						computedStyles: "{}",
						styleCount: 0,
						textContent: "Submit",
						fileMention,
					},
				},
			],
		})

		expect(items).toEqual([{ type: "mention", attrs: fileMention }])
	})

	it("does not collect inspector-detail screenshots for upload", () => {
		const screenshotMention = {
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

		const items = collectMentionItemsFromContent({
			type: "doc",
			content: [
				{
					type: INSPECTOR_DETAIL_TYPE,
					attrs: {
						title: "Selected element",
						selector: "body > section.hero",
						tagName: "section",
						size: "300 x 120 px",
						computedStyles: "{}",
						styleCount: 0,
						textContent: "Hero",
						screenshotMention,
					},
				},
			],
		})

		expect(items).toEqual([])
	})

	it("does not collect pending canvas mentions as formal mention items", () => {
		const items = collectMentionItemsFromContent({
			type: "doc",
			content: [
				{
					type: "mention",
					attrs: {
						type: MentionItemType.PROJECT_FILE,
						data: {
							file_id: "pending-file",
							file_name: "pending.png",
							file_path: "/pending.png",
						},
						pending: true,
						pendingId: "canvas-selection:1",
					},
				},
			],
		})

		expect(items).toEqual([])
	})

	it("still collects a standalone screenshot mention for upload", () => {
		const screenshotMention = {
			type: MentionItemType.UPLOAD_FILE,
			data: {
				file_id: "storage-1",
				file_name: "region.png",
				file_path: "storage-1",
				file_extension: "png",
				is_html_screenshot: true,
				storage_id: "storage-1",
			},
		}

		const items = collectMentionItemsFromContent({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "mention", attrs: screenshotMention }],
				},
			],
		})

		expect(items).toEqual([{ type: "mention", attrs: screenshotMention }])
	})

	it("does not collect a stored element screenshot for upload", () => {
		setHtmlScreenshotMention("element:#hero:1", {
			type: MentionItemType.UPLOAD_FILE,
			data: {
				file_id: "storage-1",
				file_name: "hero.png",
				file_path: "storage-1",
				file_extension: "png",
				is_html_screenshot: true,
				storage_id: "storage-1",
			},
		})

		const items = collectMentionItemsFromContent({
			type: "doc",
			content: [
				{
					type: INSPECTOR_DETAIL_TYPE,
					attrs: {
						title: "Selected element",
						selector: "body > section.hero",
						captureId: "element:#hero:1",
					},
				},
			],
		})

		expect(items).toEqual([])
	})
})
