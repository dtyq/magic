import { describe, expect, it } from "vitest"
import { isCanvasAttachmentMediaType } from "../attachment-media"

describe("isCanvasAttachmentMediaType", () => {
	it.each(["image", "video", "audio"])("accepts Canvas media type %s", (mediaType) => {
		expect(isCanvasAttachmentMediaType(mediaType)).toBe(true)
	})

	it.each(["text", "document", "", null, undefined, 1])(
		"rejects unsupported value %s",
		(mediaType) => {
			expect(isCanvasAttachmentMediaType(mediaType)).toBe(false)
		},
	)
})
