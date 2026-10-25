import { describe, expect, it } from "vitest"
import { preflightPptImage, type ImagePreflightPolicy } from "../src/media/image-preflight"
import type { MediaSourceDescriptor } from "../src/media/source-descriptor"

function opfsImage(size: number, contentType = "image/png"): MediaSourceDescriptor {
	return {
		kind: "opfs",
		key: "asset:image:fixture",
		contentType,
		extn: contentType === "image/png" ? "png" : "bin",
		sessionId: "session-image-preflight",
		path: "media/fixture",
		size,
	}
}

describe("preflightPptImage", () => {
	it("keeps a 1 GiB compatible original on the passthrough path without reading it", () => {
		const source = opfsImage(1024 * 1024 * 1024)

		expect(
			preflightPptImage({
				source,
				intrinsicSize: { width: 4096, height: 2160 },
			}),
		).toMatchObject({
			action: "passthrough",
			reason: "compatible-source",
			encodedBytes: 1024 * 1024 * 1024,
			pixelCount: 4096 * 2160,
		})
	})

	it("routes excessive decoded pixels to the explicit transform path", () => {
		const policy: ImagePreflightPolicy = {
			maxPixels: 100_000_000,
			oversizedAction: "transform",
		}

		expect(
			preflightPptImage(
				{
					source: opfsImage(20 * 1024 * 1024),
					intrinsicSize: { width: 40_000, height: 40_000 },
				},
				policy,
			),
		).toMatchObject({
			action: "transform",
			reason: "pixel-limit-exceeded",
			pixelCount: 1_600_000_000,
		})
	})

	it("can explicitly reject unsupported formats", () => {
		const result = preflightPptImage(
			{
				source: opfsImage(1024, "image/tiff"),
				intrinsicSize: { width: 1024, height: 768 },
			},
			{ unsupportedFormatAction: "reject" },
		)

		expect(result).toMatchObject({
			action: "reject",
			reason: "unsupported-content-type",
			contentType: "image/tiff",
		})
	})

	it("does not infer a pixel budget when dimensions are unknown", () => {
		const result = preflightPptImage(
			{ source: opfsImage(512 * 1024 * 1024) },
			{ maxPixels: 50_000_000, unknownDimensionsAction: "passthrough" },
		)

		expect(result).toMatchObject({
			action: "passthrough",
			reason: "dimensions-unknown",
		})
	})

	it("validates numeric budgets before evaluating a source", () => {
		expect(() => preflightPptImage({ source: opfsImage(1) }, { maxPixels: 0 })).toThrow(
			/maxPixels must be a positive safe integer/,
		)
	})
})
