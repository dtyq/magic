import { describe, expect, it } from "vitest"
import {
	hasMessageClipboardData,
	readMessageClipboardContent,
	readMessageClipboardAssets,
} from "../clipboard/CanvasMessageClipboard"

function createClipboardEvent(values: Record<string, string>, types: string[]): ClipboardEvent {
	return {
		clipboardData: {
			types,
			getData: (type: string) => values[type] || "",
		},
	} as unknown as ClipboardEvent
}

function encodeMetadata(metadata: unknown): string {
	return btoa(encodeURIComponent(JSON.stringify(metadata)))
}

describe("CanvasMessageClipboard", () => {
	it("reads project-file mentions from custom MIME metadata", () => {
		const event = createClipboardEvent(
			{
				"text/x-magic-message-mentions": JSON.stringify([
					{
						attrs: {
							type: "project_file",
							data: {
								file_id: "file-1",
								project_id: "project-1",
								file_path: "/CanvasA/images/cat.png",
								file_name: "cat.png",
							},
						},
					},
				]),
			},
			["text/x-magic-message-mentions"],
		)

		expect(hasMessageClipboardData(event)).toBe(true)
		expect(readMessageClipboardAssets(event)).toMatchObject({
			recognized: true,
			assets: [
				expect.objectContaining({
					type: "image",
					origin: "message-reference",
					sourceFileId: "file-1",
					sourceProjectId: "project-1",
					projectPath: "/CanvasA/images/cat.png",
				}),
			],
		})
	})

	it("reads rich-text mentions from HTML metadata and filters unsupported mentions", () => {
		const event = createClipboardEvent(
			{
				"text/html": `<div data-magic-clipboard="${encodeMetadata({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "mention",
								attrs: {
									type: "project_file",
									data: {
										file_id: "file-2",
										file_path: "/CanvasA/videos/demo.mp4",
										file_name: "demo.mp4",
									},
								},
							},
							{
								type: "mention",
								attrs: {
									type: "folder",
									data: { directory_id: "dir-1", directory_name: "CanvasA" },
								},
							},
						],
					}),
				})}"></div>`,
			},
			["text/html"],
		)

		expect(readMessageClipboardAssets(event).assets).toHaveLength(1)
		expect(readMessageClipboardAssets(event).assets[0]).toMatchObject({
			type: "video",
			sourceFileId: "file-2",
		})
	})

	it("does not claim ordinary HTML", () => {
		const event = createClipboardEvent({ "text/html": "<p>Hello</p>" }, ["text/html"])
		expect(hasMessageClipboardData(event)).toBe(false)
		expect(readMessageClipboardAssets(event)).toEqual({ recognized: false, assets: [] })
	})

	it("does not recognize malformed private metadata", () => {
		const event = createClipboardEvent(
			{
				"text/html": `<div data-magic-clipboard="${encodeMetadata({
					richText: "{not-json",
				})}"></div>`,
				"text/x-magic-message-rich-text": "{not-json",
			},
			["text/html", "text/x-magic-message-rich-text"],
		)

		expect(hasMessageClipboardData(event)).toBe(false)
		expect(readMessageClipboardContent(event)).toEqual({ recognized: false, parts: [] })
	})

	it("falls back to a valid mentions MIME when HTML metadata is malformed", () => {
		const event = createClipboardEvent(
			{
				"text/html": `<div data-magic-clipboard="${encodeMetadata({
					richText: "{not-json",
				})}"></div>`,
				"text/x-magic-message-mentions": JSON.stringify([
					{
						attrs: {
							type: "project_file",
							data: {
								file_id: "fallback-image",
								file_path: "images/fallback.png",
								file_name: "fallback.png",
							},
						},
					},
				]),
			},
			["text/html", "text/x-magic-message-mentions"],
		)

		expect(readMessageClipboardAssets(event)).toMatchObject({
			recognized: true,
			assets: [expect.objectContaining({ sourceFileId: "fallback-image" })],
		})
	})

	it("does not claim a rich-text document with an unrenderable mention", () => {
		const event = createClipboardEvent(
			{
				"text/html": `<div data-magic-clipboard="${encodeMetadata({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [{ type: "mention", attrs: {} }],
							},
						],
					}),
				})}"></div>`,
			},
			["text/html"],
		)

		expect(readMessageClipboardContent(event)).toEqual({ recognized: false, parts: [] })
	})

	it("preserves rich-text order and falls back unsupported mentions to text", () => {
		const event = createClipboardEvent(
			{
				"text/html": `<div data-magic-clipboard="${encodeMetadata({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{ type: "text", text: "before " },
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "image-1",
												file_path: "images/cat.png",
												file_name: "cat.png",
											},
										},
									},
									{ type: "text", text: " after" },
								],
							},
							{
								type: "paragraph",
								content: [
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "text-1",
												file_path: "docs/readme.txt",
												file_name: "readme.txt",
											},
										},
									},
								],
							},
						],
					}),
				})}"></div>`,
			},
			["text/html"],
		)

		const result = readMessageClipboardContent(event)
		expect(result.recognized).toBe(true)
		expect(result.parts.map((part) => part.kind)).toEqual(["text", "asset", "text"])
		expect(result.parts[0]).toEqual({ kind: "text", text: "before " })
		expect(result.parts[1]).toMatchObject({
			kind: "asset",
			fallbackText: "@cat.png",
			asset: { fileName: "cat.png", type: "image" },
		})
		expect(result.parts[2]).toEqual({ kind: "text", text: " after\n@readme.txt" })
	})
})
