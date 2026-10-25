import { describe, expect, it, vi } from "vitest"
import type { UploadFileResponse } from "../../../../public/magic-types"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import type { Canvas } from "../../../core/Canvas"
import {
	appendReferenceImageInfos,
	removeReferenceImageInfosByPath,
	replaceReferenceImageInfos,
} from "../referenceImageInfos"

function file(path: string): UploadFileResponse {
	return { path, src: `https://example.test/${encodeURIComponent(path)}` } as UploadFileResponse
}

function createCanvas() {
	const loadResource = vi.fn()
	const canvas = {
		magicConfigManager: {
			config: {
				methods: {
					resolveResourceReference: createTestResourceReferenceResolver({
						currentCanvasWorkspacePath: "/画布A",
					}),
				},
			},
		},
		imageResourceManager: { loadResource },
	} as unknown as Canvas
	return { canvas, loadResource }
}

describe("referenceImageInfos", () => {
	it("dedupes current-canvas aliases by resource identity", () => {
		const { canvas, loadResource } = createCanvas()
		const existing = [file("./images/a.png")]

		const next = appendReferenceImageInfos(canvas, existing, [
			file("/画布A/images/a.png"),
			file("/images/a.png"),
		])

		expect(next.map((info) => info.path)).toEqual(["./images/a.png", "/images/a.png"])
		expect(loadResource).toHaveBeenCalledTimes(1)
		expect(loadResource).toHaveBeenCalledWith("/images/a.png")
	})

	it("dedupes replacement input and removes all aliases of the target resource", () => {
		const { canvas } = createCanvas()
		const replaced = replaceReferenceImageInfos(canvas, [
			file("./images/a.png"),
			file("/画布A/images/a.png"),
			file("/images/a.png"),
		])

		expect(replaced).toHaveLength(2)
		expect(removeReferenceImageInfosByPath(canvas, replaced, "/画布A/images/a.png")).toEqual([
			expect.objectContaining({ path: "/images/a.png" }),
		])
	})
})
