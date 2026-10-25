import { describe, expect, it } from "vitest"
import { getOptimizedImageUrl } from "../image-optimization"

describe("getOptimizedImageUrl", () => {
	it("replaces a larger simple thumbnail pipeline idempotently", () => {
		const source =
			"https://example.tos-cn-beijing.volces.com/image.jpg?x-tos-process=image/resize,w_512/format,jpeg#photo"
		const options = { variant: "thumbnail" as const, width: 48 }
		const optimized = getOptimizedImageUrl(source, options)
		expect(new URL(optimized).searchParams.get("x-tos-process")).toBe(
			"image/resize,w_96/format,webp/quality,Q_85",
		)
		expect(getOptimizedImageUrl(optimized, options)).toBe(optimized)
		expect(new URL(optimized).hash).toBe("#photo")
	})
	it.each([
		"https://unknown.example/tos-cn/image.png",
		"https://unknown.example/image.png?host=static-legacy.dingtalk.com",
		"https://static-legacy.dingtalk.com/image.png?Signature=signed",
		"https://bucket.oss-cn-hangzhou.aliyuncs.com/image.png?x-oss-signature=signed",
	])("preserves unknown hosts and signed URLs: %s", (url) => {
		expect(getOptimizedImageUrl(url, { variant: "thumbnail", width: 32 })).toBe(url)
	})
	it("creates a 2x WebP thumbnail for public TOS images while preserving query parameters", () => {
		const url = getOptimizedImageUrl(
			"https://example.tos-cn-beijing.volces.com/avatar.png?tenant=magic#preview",
			{
				variant: "thumbnail",
				width: 32,
				dpr: 2,
			},
		)

		expect(url).toBe(
			"https://example.tos-cn-beijing.volces.com/avatar.png?tenant=magic&x-tos-process=image%2Fresize%2Cw_64%2Fformat%2Cwebp%2Fquality%2CQ_85#preview",
		)
	})

	it("creates a 2x WebP thumbnail for public OSS images", () => {
		const url = getOptimizedImageUrl(
			"https://example.oss-cn-hangzhou.aliyuncs.com/avatar.jpg",
			{
				variant: "thumbnail",
				width: 48,
				dpr: 2,
			},
		)

		expect(url).toBe(
			"https://example.oss-cn-hangzhou.aliyuncs.com/avatar.jpg?x-oss-process=image%2Fresize%2Cw_96%2Fformat%2Cwebp%2Fquality%2CQ_85",
		)
	})

	it("keeps an image aspect ratio when only one dimension is provided", () => {
		const url = getOptimizedImageUrl("https://example.tos-cn-beijing.volces.com/document.png", {
			variant: "thumbnail",
			width: 100,
		})

		expect(url).toBe(
			"https://example.tos-cn-beijing.volces.com/document.png?x-tos-process=image%2Fresize%2Cw_200%2Fformat%2Cwebp%2Fquality%2CQ_85",
		)
	})

	it("adds the existing DingTalk size suffix before the query string", () => {
		const url = getOptimizedImageUrl(
			"https://static-legacy.dingtalk.com/avatar.jpg?token=public",
			{
				variant: "thumbnail",
				width: 32,
				height: 32,
				dpr: 2,
			},
		)

		expect(url).toBe("https://static-legacy.dingtalk.com/avatar.jpg@64w_64h?token=public")
	})

	it.each([
		[
			"https://static-legacy.dingtalk.com/media/avatar_hcHsuveMxYhAA_1290_1290.jpg",
			"https://static-legacy.dingtalk.com/media/avatar_hcHsuveMxYhAA_1290_1290.jpg@64w_64h",
		],
		[
			"https://static-legacy.dingtalk.com/media/avatar@1290w_1290h.png?tenant=magic#avatar",
			"https://static-legacy.dingtalk.com/media/avatar.png@64w_64h?tenant=magic#avatar",
		],
	])(
		"replaces existing DingTalk dimensions without changing the resource suffix",
		(source, expected) => {
			expect(
				getOptimizedImageUrl(source, { variant: "thumbnail", width: 32, height: 32 }),
			).toBe(expected)
		},
	)

	it("is idempotent for DingTalk thumbnails", () => {
		const url = "https://static-legacy.dingtalk.com/media/avatar_hcHsuveMxYhAA_1290_1290.jpg"
		const optimized = getOptimizedImageUrl(url, {
			variant: "thumbnail",
			width: 32,
			height: 32,
		})
		expect(
			getOptimizedImageUrl(optimized, { variant: "thumbnail", width: 32, height: 32 }),
		).toBe(optimized)
	})

	it("does not mutate signed or original URLs", () => {
		const signedUrl =
			"https://example.tos-cn-beijing.volces.com/private.png?X-Tos-Signature=secret"

		expect(
			getOptimizedImageUrl(signedUrl, {
				variant: "thumbnail",
				width: 32,
			}),
		).toBe(signedUrl)
		expect(
			getOptimizedImageUrl("https://example.tos-cn-beijing.volces.com/original.png", {
				variant: "original",
				width: 32,
			}),
		).toBe("https://example.tos-cn-beijing.volces.com/original.png")
	})

	it("can resize while preserving the source format", () => {
		const url = getOptimizedImageUrl("https://example.tos-cn-beijing.volces.com/document.png", {
			variant: "preview",
			width: 320,
			format: "original",
		})

		expect(url).toBe(
			"https://example.tos-cn-beijing.volces.com/document.png?x-tos-process=image%2Fresize%2Cw_640%2Fquality%2CQ_85",
		)
	})

	it("caps oversized thumbnail dimensions before building provider parameters", () => {
		const url = getOptimizedImageUrl("https://example.tos-cn-beijing.volces.com/document.png", {
			variant: "thumbnail",
			width: 2000,
			dpr: 2,
		})

		expect(url).toContain("resize%2Cw_2048")
		expect(url).not.toContain("w_4000")
	})

	it("falls back to the original URL when provider parameters are invalid", () => {
		const original = "https://example.tos-cn-beijing.volces.com/document.png"

		expect(
			getOptimizedImageUrl(original, {
				variant: "thumbnail",
				width: 32,
				quality: 101,
			}),
		).toBe(original)
	})
})
