import { afterEach, describe, expect, it, vi } from "vitest"
import { materializeLegacyPptImageNodes } from "../src/materialize/legacy-images"
import type { PPTImageNode } from "../src/ir/node"
import { bytesMediaSourceDescriptor } from "../src/media/source-descriptor"

const originalCreateImageBitmap = globalThis.createImageBitmap
const originalOffscreenCanvas = globalThis.OffscreenCanvas

afterEach(() => {
	if (originalCreateImageBitmap) globalThis.createImageBitmap = originalCreateImageBitmap
	else Reflect.deleteProperty(globalThis, "createImageBitmap")
	if (originalOffscreenCanvas) globalThis.OffscreenCanvas = originalOffscreenCanvas
	else Reflect.deleteProperty(globalThis, "OffscreenCanvas")
})

function imageNode(source: PPTImageNode["source"]): PPTImageNode {
	return { type: "image", x: 0, y: 0, w: 1, h: 1, zOrder: 0, source }
}

describe("legacy image materialization", () => {
	it("converts WebP payloads to real PNG bytes", async () => {
		const drawImage = vi.fn()
		class TestOffscreenCanvas {
			width: number
			height: number

			constructor(width: number, height: number) {
				this.width = width
				this.height = height
			}

			getContext() {
				return { drawImage }
			}

			async convertToBlob() {
				return new Blob(
					[new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
					{ type: "image/png" },
				)
			}
		}
		Object.defineProperty(globalThis, "OffscreenCanvas", {
			configurable: true,
			value: TestOffscreenCanvas,
		})
		Object.defineProperty(globalThis, "createImageBitmap", {
			configurable: true,
			value: vi.fn(async () => ({ width: 2, height: 1, close: vi.fn() })),
		})

		const node = imageNode(
			bytesMediaSourceDescriptor({
				data: new TextEncoder().encode("RIFFxxxxWEBP").buffer,
				contentType: "image/png",
				extn: "png",
			}),
		)
		await materializeLegacyPptImageNodes([node])

		expect(node.source.contentType).toBe("image/png")
		expect(node.source.extn).toBe("png")
		expect(node.source.kind).toBe("bytes")
		expect(drawImage).toHaveBeenCalledOnce()
	})
})
