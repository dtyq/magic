import { describe, expect, it } from "vitest"
import { parseMixedClipboard } from "../mixedClipboard"

describe("mixedClipboard", () => {
	it("removes a Finder display name read through the Clipboard API", () => {
		const file = new File(["content"], "截屏2026-09-09 20.59.48.png", {
			type: "image/png",
		})
		const content = parseMixedClipboard("截屏2026-09-09 20.59.48", "", [file], {
			textFromClipboardApi: true,
		})

		expect(content).toEqual({
			ordered: true,
			parts: [{ type: "file", file, originalText: "" }],
		})
	})

	it("preserves an event-provided body that matches the file display name", () => {
		const file = new File(["content"], "report.png", { type: "image/png" })

		expect(parseMixedClipboard("report", "", [file])).toEqual({
			ordered: false,
			parts: [
				{ type: "text", text: "report" },
				{ type: "text", text: "\n" },
				{ type: "file", file, originalText: "" },
			],
		})
	})

	it("matches multiple Clipboard API file labels as a multiset", () => {
		const first = new File(["first"], "image.png", { type: "image/png" })
		const second = new File(["second"], "image.jpg", { type: "image/jpeg" })

		expect(
			parseMixedClipboard("image\nimage", "", [first, second], {
				textFromClipboardApi: true,
			}),
		).toEqual({
			ordered: true,
			parts: [
				{ type: "file", file: first, originalText: "" },
				{ type: "text", text: "\n" },
				{ type: "file", file: second, originalText: "" },
			],
		})
	})

	it("preserves real mixed body text read through the Clipboard API", () => {
		const file = new File(["content"], "report.png", { type: "image/png" })

		expect(
			parseMixedClipboard("请处理\nreport", "", [file], {
				textFromClipboardApi: true,
			}).ordered,
		).toBe(false)
		expect(
			parseMixedClipboard("请处理\nreport", "", [file], {
				textFromClipboardApi: true,
			}).parts,
		).toEqual([
			{ type: "text", text: "请处理\nreport" },
			{ type: "text", text: "\n" },
			{ type: "file", file, originalText: "" },
		])
	})
})
