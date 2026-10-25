import { describe, expect, it, vi } from "vitest"
import { getTemporaryDownloadUrl } from "../api"
import {
	buildImageUrlMapEntries,
	processMarkdownImages,
	resolveSingleImageUrl,
} from "../image-url-resolver"

vi.mock("../api", () => ({
	getTemporaryDownloadUrl: vi.fn(async () => [
		{ file_id: "file-1", url: "https://magic-sandbox.volces.com/image.webp" },
	]),
}))

describe("buildImageUrlMapEntries", () => {
	it("uses a display-size thumbnail for markdown image size metadata", () => {
		const imageUrlMap = buildImageUrlMapEntries(
			[
				{
					file_id: "file-1",
					url: "https://example.tos-cn-beijing.volces.com/image.jpg",
				},
			],
			new Map([["file-1", new Set(["./image.jpg =48x32"])]]),
		)

		expect(imageUrlMap.get("./image.jpg =48x32")).toMatchObject({
			url: "https://example.tos-cn-beijing.volces.com/image.jpg?x-tos-process=image%2Fresize%2Cw_96%2Ch_64%2Fformat%2Cwebp%2Fquality%2CQ_85",
			width: 48,
			height: 32,
		})
	})

	it("keeps download URLs unchanged when no display size is available", () => {
		const imageUrlMap = buildImageUrlMapEntries(
			[
				{
					file_id: "file-1",
					url: "https://example.tos-cn-beijing.volces.com/image.jpg",
				},
			],
			new Map([["file-1", new Set(["./image.jpg"])]]),
		)

		expect(imageUrlMap.get("./image.jpg")?.url).toBe(
			"https://example.tos-cn-beijing.volces.com/image.jpg",
		)
	})

	it("passes display dimensions to the sandbox image processing endpoint", async () => {
		const url = await resolveSingleImageUrl("./image.jpg =48x32", [
			{
				file_id: "file-1",
				file_name: "image.jpg",
				relative_file_path: "./image.jpg",
			},
		])

		expect(url).toBe("https://magic-sandbox.volces.com/image.webp")
		expect(vi.mocked(getTemporaryDownloadUrl)).toHaveBeenLastCalledWith({
			file_ids: ["file-1"],
			options: {
				xMagicImageProcess: {
					resize: { w: 96, h: 64 },
					quality: 85,
					format: "webp",
				},
			},
		})
	})

	it("uses WebP and the largest requested display size for batch markdown images", async () => {
		await processMarkdownImages(
			"![small](./small.jpg =32x32) ![large](./large.jpg =100x48)",
			[
				{
					file_id: "file-small",
					file_name: "small.jpg",
					relative_file_path: "./small.jpg",
				},
				{
					file_id: "file-large",
					file_name: "large.jpg",
					relative_file_path: "./large.jpg",
				},
			],
			undefined,
			"thumbnail",
		)

		expect(vi.mocked(getTemporaryDownloadUrl)).toHaveBeenLastCalledWith({
			file_ids: ["file-small", "file-large"],
			options: {
				xMagicImageProcess: {
					resize: { w: 200, h: 96 },
					quality: 85,
					format: "webp",
				},
			},
		})
	})

	it("keeps the export batch on original URLs even with thumbnail metadata", async () => {
		await processMarkdownImages("![small](./small.jpg =32x32)", [
			{
				file_id: "file-small",
				file_name: "small.jpg",
				relative_file_path: "./small.jpg",
			},
		])
		expect(getTemporaryDownloadUrl).toHaveBeenLastCalledWith({ file_ids: ["file-small"] })
		const original = "https://example.tos-cn-beijing.volces.com/image.jpg"
		expect(
			buildImageUrlMapEntries(
				[{ file_id: "file-small", url: original }],
				new Map([["file-small", new Set(["./small.jpg =32x32"])]]),
				"original",
			).get("./small.jpg =32x32")?.url,
		).toBe(original)
	})
})
