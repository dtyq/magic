import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BrandImageItem } from "../../types"
import { useBrandImagePreviewHydration } from "../useBrandImagePreviewHydration"
import { CARD_THUMBNAIL_IMAGE_PROCESS } from "../../../../constants/imageProcess"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: vi.fn(),
}))

function makeBrandImage(overrides: Partial<BrandImageItem> = {}): BrandImageItem {
	return {
		id: "brand-image-1",
		file: new File([], "brand.png", { type: "image/png" }),
		previewUrl: "",
		description: "brand asset",
		isImage: true,
		uploadedPath: "__drafts/brand-images/brand.png",
		...overrides,
	}
}

function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void
	let reject!: (reason?: unknown) => void

	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})

	return { promise, resolve, reject }
}

describe("useBrandImagePreviewHydration", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		Object.defineProperty(URL, "createObjectURL", {
			writable: true,
			value: vi.fn(() => "blob:brand-preview"),
		})
		Object.defineProperty(URL, "revokeObjectURL", {
			writable: true,
			value: vi.fn(),
		})
	})

	it("hydrates previewUrl for restored brand images", async () => {
		const { getFileContentById } = await import("@/pages/superMagic/utils/api")
		vi.mocked(getFileContentById).mockResolvedValue(new Blob(["image"], { type: "image/png" }))

		const onBrandImagesChange = vi.fn()
		const brandImages = [makeBrandImage()]
		const attachmentList = [
			{
				file_id: "file-1",
				is_directory: false,
				relative_file_path: "__drafts/brand-images/brand.png",
			},
		]

		renderHook(() =>
			useBrandImagePreviewHydration({
				attachmentList,
				brandImages,
				onBrandImagesChange,
			}),
		)

		await waitFor(() => {
			expect(getFileContentById).toHaveBeenCalledWith("file-1", {
				responseType: "blob",
				xMagicImageProcess: CARD_THUMBNAIL_IMAGE_PROCESS,
				access: undefined,
			})
			expect(onBrandImagesChange).toHaveBeenCalledWith([
				expect.objectContaining({
					id: "brand-image-1",
					previewUrl: "blob:brand-preview",
				}),
			])
		})
	})

	it("matches attachment paths with a leading slash", async () => {
		const { getFileContentById } = await import("@/pages/superMagic/utils/api")
		vi.mocked(getFileContentById).mockResolvedValue(new Blob(["image"], { type: "image/png" }))

		const onBrandImagesChange = vi.fn()
		const attachmentList = [
			{
				file_id: "file-2",
				is_directory: false,
				relative_file_path: "/__drafts/brand-images/brand.png",
			},
		]
		const brandImages = [makeBrandImage({ uploadedPath: "__drafts/brand-images/brand.png" })]

		renderHook(() =>
			useBrandImagePreviewHydration({
				attachmentList,
				brandImages,
				onBrandImagesChange,
			}),
		)

		await waitFor(() => {
			expect(getFileContentById).toHaveBeenCalledWith("file-2", {
				responseType: "blob",
				xMagicImageProcess: CARD_THUMBNAIL_IMAGE_PROCESS,
				access: undefined,
			})
			expect(onBrandImagesChange).toHaveBeenCalled()
		})
	})

	it("skips images that already have previewUrl", async () => {
		const { getFileContentById } = await import("@/pages/superMagic/utils/api")
		const onBrandImagesChange = vi.fn()
		const attachmentList = [
			{
				file_id: "file-1",
				is_directory: false,
				relative_file_path: "__drafts/brand-images/brand.png",
			},
		]
		const brandImages = [makeBrandImage({ previewUrl: "blob:existing-preview" })]

		renderHook(() =>
			useBrandImagePreviewHydration({
				attachmentList,
				brandImages,
				onBrandImagesChange,
			}),
		)

		await waitFor(() => {
			expect(getFileContentById).not.toHaveBeenCalled()
			expect(onBrandImagesChange).not.toHaveBeenCalled()
		})
	})

	it("exposes loading ids while preview hydration is in progress", async () => {
		const { getFileContentById } = await import("@/pages/superMagic/utils/api")
		const deferred = createDeferred<Blob>()
		vi.mocked(getFileContentById).mockReturnValue(deferred.promise)

		const onBrandImagesChange = vi.fn()
		const attachmentList = [
			{
				file_id: "file-1",
				is_directory: false,
				relative_file_path: "__drafts/brand-images/brand.png",
			},
		]
		const brandImages = [makeBrandImage()]
		const { result } = renderHook(() =>
			useBrandImagePreviewHydration({
				attachmentList,
				brandImages,
				onBrandImagesChange,
			}),
		)

		await waitFor(() => {
			expect(result.current.hydratingImageIds.has("brand-image-1")).toBe(true)
		})

		deferred.resolve(new Blob(["image"], { type: "image/png" }))

		await waitFor(() => {
			expect(result.current.hydratingImageIds.size).toBe(0)
			expect(onBrandImagesChange).toHaveBeenCalled()
		})
	})
})
