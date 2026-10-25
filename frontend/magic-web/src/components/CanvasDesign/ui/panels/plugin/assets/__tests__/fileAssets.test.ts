import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../../../runtime/core/Canvas"
import { resolvePluginFileByPath, resolveProjectPluginFile } from "../fileAssets"

function createCanvas(options: {
	getFileInfo?: ReturnType<typeof vi.fn>
	getAssetResource?: ReturnType<typeof vi.fn>
}): Canvas {
	return {
		assetResourceManager: {
			getResource: options.getAssetResource ?? vi.fn(),
		},
		magicConfigManager: {
			config: {
				methods: {
					getFileInfo: options.getFileInfo,
				},
			},
		},
	} as unknown as Canvas
}

describe("plugin file asset resolution", () => {
	it("resolves an asset path through the Canvas asset manager", async () => {
		const getFileInfo = vi.fn()
		const getAssetResource = vi.fn(async () => ({
			assetId: "image-1",
			mediaType: "image" as const,
			fileUrl: "https://assets.test/image-1",
			fileName: "portrait.png",
		}))
		const canvas = createCanvas({ getFileInfo, getAssetResource })

		await expect(
			resolvePluginFileByPath(canvas, " asset://image-1 ", {
				type: "image",
				skipImageDimensions: true,
			}),
		).resolves.toEqual({
			id: "asset://image-1",
			path: "asset://image-1",
			url: "https://assets.test/image-1",
			src: "https://assets.test/image-1",
			fileName: "portrait.png",
			type: "image",
			width: undefined,
			height: undefined,
		})
		expect(getAssetResource).toHaveBeenCalledWith("image-1")
		expect(getFileInfo).not.toHaveBeenCalled()
	})

	it("rejects a picker type that disagrees with asset metadata", async () => {
		const getFileInfo = vi.fn()
		const canvas = createCanvas({
			getFileInfo,
			getAssetResource: vi.fn(async () => ({
				assetId: "video-1",
				mediaType: "video" as const,
				fileUrl: "https://assets.test/video-1",
			})),
		})

		await expect(
			resolvePluginFileByPath(canvas, "asset://video-1", { type: "image" }),
		).rejects.toThrow("Asset media type does not match the plugin picker type")
		expect(getFileInfo).not.toHaveBeenCalled()
	})

	it("uses explicit panel metadata but still verifies it against asset detail", async () => {
		const getFileInfo = vi.fn()
		const canvas = createCanvas({
			getFileInfo,
			getAssetResource: vi.fn(async () => ({
				assetId: "audio-1",
				mediaType: "audio" as const,
				fileUrl: "https://assets.test/audio-1",
				fileName: "voice.mp3",
			})),
		})

		await expect(
			resolveProjectPluginFile(canvas, {
				type: "project_file",
				data: {
					file_id: "asset-audio-1",
					file_name: "voice.mp3",
					file_path: "asset://audio-1",
					file_extension: "",
					media_type: "video",
				},
			}),
		).rejects.toThrow("Asset media type does not match the selected resource metadata")
		expect(getFileInfo).not.toHaveBeenCalled()
	})

	it("rejects malformed asset schemes before workspace lookup", async () => {
		const getFileInfo = vi.fn()
		const canvas = createCanvas({ getFileInfo })

		await expect(resolvePluginFileByPath(canvas, "asset://image-1/child.png")).rejects.toThrow(
			"Invalid asset resource path",
		)
		expect(getFileInfo).not.toHaveBeenCalled()
	})
})
