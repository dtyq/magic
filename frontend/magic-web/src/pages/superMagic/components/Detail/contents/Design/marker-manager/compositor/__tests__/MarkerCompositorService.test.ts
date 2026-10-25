import { describe, expect, it, vi } from "vitest"
import { resolveMarkerImageSourceUrl } from "../MarkerCompositorService"

describe("resolveMarkerImageSourceUrl", () => {
	it("resolves asset images through the asset detail API", async () => {
		const getFileInfo = vi.fn()
		const getAssetResourceInfo = vi.fn(async () => ({
			assetId: "reference.png",
			mediaType: "image" as const,
			fileUrl: "https://assets.test/reference-image",
			fileName: "reference.png",
		}))

		await expect(
			resolveMarkerImageSourceUrl(" asset://reference.png ", {
				getFileInfo,
				getAssetResourceInfo,
			}),
		).resolves.toBe("https://assets.test/reference-image")
		expect(getAssetResourceInfo).toHaveBeenCalledWith("reference.png")
		expect(getFileInfo).not.toHaveBeenCalled()
	})

	it("rejects a non-image asset instead of composing it as an image", async () => {
		const getFileInfo = vi.fn()
		const getAssetResourceInfo = vi.fn(async () => ({
			assetId: "video-1",
			mediaType: "video" as const,
			fileUrl: "https://assets.test/video-1",
		}))

		await expect(
			resolveMarkerImageSourceUrl("asset://video-1", {
				getFileInfo,
				getAssetResourceInfo,
			}),
		).rejects.toThrow("素材库资源不是可用图片")
		expect(getFileInfo).not.toHaveBeenCalled()
	})

	it("rejects malformed asset references before workspace lookup", async () => {
		const getFileInfo = vi.fn()

		await expect(
			resolveMarkerImageSourceUrl("asset://image-1/child.png", { getFileInfo }),
		).rejects.toThrow("无效的素材库资源路径")
		expect(getFileInfo).not.toHaveBeenCalled()
	})

	it("keeps workspace images on the existing file resolver", async () => {
		const getFileInfo = vi.fn(async () => ({ src: "https://files.test/image.png" }))
		const getAssetResourceInfo = vi.fn()

		await expect(
			resolveMarkerImageSourceUrl("./images/image.png", {
				getFileInfo,
				getAssetResourceInfo,
			}),
		).resolves.toBe("https://files.test/image.png")
		expect(getFileInfo).toHaveBeenCalledWith("./images/image.png", {
			useImageProcess: true,
		})
		expect(getAssetResourceInfo).not.toHaveBeenCalled()
	})
})
