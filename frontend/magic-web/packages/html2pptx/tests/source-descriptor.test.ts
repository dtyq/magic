import { describe, expect, it } from "vitest"
import {
	MAX_INLINE_MEDIA_BYTES,
	bytesMediaSourceDescriptor,
	mediaSourceDescriptorFromBytes,
	normalizeMediaSourceDescriptor,
	withMediaSourceKey,
} from "../src/media/source-descriptor"

describe("streaming media source descriptors", () => {
	it("marks URL/path MIME guesses as inferred", async () => {
		await expect(
			normalizeMediaSourceDescriptor("https://cdn.example.test/signed?token=one"),
		).resolves.toMatchObject({
			kind: "url",
			contentType: "application/octet-stream",
			extn: "bin",
			metadataOrigin: "inferred",
		})

		await expect(
			normalizeMediaSourceDescriptor("https://cdn.example.test/video.webm"),
		).resolves.toMatchObject({
			contentType: "video/webm",
			extn: "webm",
			metadataOrigin: "inferred",
		})
	})

	it("lets callers distinguish explicit metadata from media guesses", async () => {
		await expect(
			normalizeMediaSourceDescriptor("https://cdn.example.test/cover", {
				contentType: "image/png",
				metadataOrigin: "inferred",
			}),
		).resolves.toMatchObject({
			contentType: "image/png",
			extn: "png",
			metadataOrigin: "inferred",
		})

		await expect(
			normalizeMediaSourceDescriptor("https://cdn.example.test/media", {
				contentType: "video/mp4",
			}),
		).resolves.toMatchObject({
			contentType: "video/mp4",
			extn: "mp4",
			metadataOrigin: "explicit",
		})
	})

	it("marks in-memory bytes as explicit metadata", () => {
		expect(
			bytesMediaSourceDescriptor({
				data: Uint8Array.of(1, 2, 3).buffer,
				contentType: "image/webp",
			}),
		).toMatchObject({ extn: "webp", metadataOrigin: "explicit" })
	})

	it("stages oversized caller bytes as a Blob descriptor", () => {
		const data = new ArrayBuffer(MAX_INLINE_MEDIA_BYTES + 1)
		const source = mediaSourceDescriptorFromBytes({
			data,
			contentType: "image/png",
			key: "large-image",
		})

		expect(source).toMatchObject({
			kind: "blob",
			size: data.byteLength,
			key: "large-image",
			contentType: "image/png",
			extn: "png",
		})
	})

	it("rejects an oversized percent-encoded data URL before decoding it", async () => {
		const payload = "a".repeat(MAX_INLINE_MEDIA_BYTES + 1)

		await expect(normalizeMediaSourceDescriptor(`data:image/png,${payload}`)).rejects.toThrow(
			/use a Blob, URL, or OPFS descriptor/,
		)
	})

	it("keeps the signed URL as transport while rebinding its stable business key", async () => {
		const source = await normalizeMediaSourceDescriptor(
			"https://cdn.example.test/hero.png?token=one",
		)
		const rebound = withMediaSourceKey(source, "asset:image:assets/hero.png")

		expect(rebound).toMatchObject({
			kind: "url",
			url: "https://cdn.example.test/hero.png?token=one",
			key: "asset:image:assets/hero.png",
		})
		expect(source.key).toBe("url:https://cdn.example.test/hero.png?token=one")
	})
})
