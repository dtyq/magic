// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { bytesMediaSourceDescriptor } from "../src/media/source-descriptor"
import type { PPTNode } from "../src/ir/node"
import { serializePptNodes } from "../src/ir/serialize"

describe("media descriptor serialization", () => {
	it("preserves image/media descriptors and strips DOM-only references", () => {
		const imageSource = bytesMediaSourceDescriptor({
			data: new Uint8Array([1, 2, 3]).buffer,
			contentType: "image/png",
			key: "image-source",
		})
		const coverSource = bytesMediaSourceDescriptor({
			data: new Uint8Array([4, 5, 6]).buffer,
			contentType: "image/jpeg",
			key: "cover-source",
		})
		const nodes: PPTNode[] = [
			{
				type: "image",
				x: 0,
				y: 0,
				w: 1,
				h: 1,
				zOrder: 0,
				source: imageSource,
				sizing: "stretch",
				captureElement: document.createElement("div"),
			},
			{
				type: "media",
				x: 0,
				y: 0,
				w: 1,
				h: 1,
				zOrder: 1,
				mediaType: "video",
				source: imageSource,
				coverSource,
				coverCaptureElement: document.createElement("video"),
			},
		]

		const serialized = serializePptNodes(nodes)

		expect(serialized[0]).toMatchObject({ source: imageSource })
		expect(serialized[0]).not.toHaveProperty("captureElement")
		expect(serialized[1]).toMatchObject({ source: imageSource, coverSource })
		expect(serialized[1]).not.toHaveProperty("coverCaptureElement")
	})
})
