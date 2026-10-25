import PptxGenJS from "pptxgenjs"
import { describe, expect, it, vi } from "vitest"
import { drawMedia } from "../src/drawer/drawMedia"
import type { PPTMediaNode } from "../src/ir/node"
import { bytesMediaSourceDescriptor } from "../src/media/source-descriptor"

describe("drawMedia v5 mapping", () => {
	it("maps embedded video descriptors, cover, and autoplay", async () => {
		const { slide, addMedia } = createSlideSpy()
		const source = bytesMediaSourceDescriptor({
			data: new Uint8Array([1, 2, 3]).buffer,
			contentType: "video/mp4",
		})
		const coverSource = bytesMediaSourceDescriptor({
			data: new Uint8Array([4, 5, 6]).buffer,
			contentType: "image/png",
		})
		const node: PPTMediaNode = {
			type: "media",
			x: 1,
			y: 2,
			w: 8,
			h: 4.5,
			zOrder: 1,
			mediaType: "video",
			source,
			coverSource,
			autoplay: true,
		}

		await drawMedia(slide, node)

		expect(addMedia).toHaveBeenCalledWith({
			x: 1,
			y: 2,
			w: 8,
			h: 4.5,
			type: "video",
			source,
			coverSource,
			autoplay: true,
		})
	})

	it("preserves explicit autoplay for embedded audio", async () => {
		const { slide, addMedia } = createSlideSpy()
		const source = bytesMediaSourceDescriptor({
			data: new Uint8Array([1, 2, 3]).buffer,
			contentType: "audio/mpeg",
		})
		const node: PPTMediaNode = {
			type: "media",
			x: 0,
			y: 0,
			w: 2,
			h: 2,
			zOrder: 1,
			mediaType: "audio",
			source,
			autoplay: false,
		}

		await drawMedia(slide, node)

		expect(addMedia).toHaveBeenCalledWith({
			x: 0,
			y: 0,
			w: 2,
			h: 2,
			type: "audio",
			source,
			autoplay: false,
		})
	})

	it("maps online media to link-only props and omits autoplay", async () => {
		const { slide, addMedia } = createSlideSpy()
		const node: PPTMediaNode = {
			type: "media",
			x: 3,
			y: 1,
			w: 6,
			h: 4,
			zOrder: 1,
			mediaType: "online",
			link: "https://www.youtube.com/embed/example",
			autoplay: true,
		}

		await drawMedia(slide, node)

		expect(addMedia).toHaveBeenCalledWith({
			x: 3,
			y: 1,
			w: 6,
			h: 4,
			type: "online",
			link: "https://www.youtube.com/embed/example",
		})
	})
})

function createSlideSpy() {
	const slide = new PptxGenJS().addSlide()
	const addMedia = vi.spyOn(slide, "addMedia").mockReturnValue(slide)
	return { slide, addMedia }
}
