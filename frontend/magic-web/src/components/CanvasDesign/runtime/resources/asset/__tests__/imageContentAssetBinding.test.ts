import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum, type ImageElement } from "../../../document/types"
import { bindImageContentToAsset } from "../imageContentAssetBinding"

function createHarness(initialElement?: ImageElement) {
	let element = initialElement
	const update = vi.fn((_elementId: string, patch: Partial<ImageElement>) => {
		if (element) element = { ...element, ...patch }
	})
	const canvas = {
		elementManager: {
			getElementData: vi.fn(() => element),
			update,
		},
	} as unknown as Pick<Canvas, "elementManager">

	return {
		canvas,
		update,
		getElement: () => element,
	}
}

function image(): ImageElement {
	return {
		id: "image-1",
		type: ElementTypeEnum.Image,
		activeContentId: "content-2",
		mainContentId: "content-2",
		contents: [
			{ contentId: "content-1", src: "./images/one.png" },
			{ contentId: "content-2", src: "./images/two.png" },
		],
	}
}

describe("bindImageContentToAsset", () => {
	it("binds the exact Content captured when the save dialog opened", () => {
		const harness = createHarness(image())

		expect(
			bindImageContentToAsset(harness.canvas, {
				elementId: "image-1",
				contentId: "content-1",
				sourcePath: "./images/one.png",
				assetId: "960212772906762240",
			}),
		).toBe("bound")

		expect(harness.getElement()?.contents).toEqual([
			{
				contentId: "content-1",
				src: "./images/one.png",
				assetId: "960212772906762240",
			},
			{ contentId: "content-2", src: "./images/two.png" },
		])
		expect(harness.update).toHaveBeenCalledWith(
			"image-1",
			{ contents: harness.getElement()?.contents },
			{ mode: "data-only", historyPolicy: "exclude" },
		)
	})

	it("does not bind when the target no longer exists", () => {
		const missingElement = createHarness()
		expect(
			bindImageContentToAsset(missingElement.canvas, {
				elementId: "image-1",
				contentId: "content-1",
				sourcePath: "./images/one.png",
				assetId: "asset-1",
			}),
		).toBe("target-missing")

		const missingContent = createHarness(image())
		expect(
			bindImageContentToAsset(missingContent.canvas, {
				elementId: "image-1",
				contentId: "deleted-content",
				sourcePath: "./images/one.png",
				assetId: "asset-1",
			}),
		).toBe("target-missing")
		expect(missingContent.update).not.toHaveBeenCalled()
	})

	it("does not bind after the captured Content source changes", () => {
		const harness = createHarness(image())
		expect(
			bindImageContentToAsset(harness.canvas, {
				elementId: "image-1",
				contentId: "content-1",
				sourcePath: "./images/replaced.png",
				assetId: "asset-1",
			}),
		).toBe("source-changed")
		expect(harness.update).not.toHaveBeenCalled()
	})

	it("does not update an existing identical binding", () => {
		const element = image()
		element.contents[0] = { ...element.contents[0], assetId: "asset-1" }
		const harness = createHarness(element)

		expect(
			bindImageContentToAsset(harness.canvas, {
				elementId: "image-1",
				contentId: "content-1",
				sourcePath: "./images/one.png",
				assetId: "asset-1",
			}),
		).toBe("already-bound")
		expect(harness.update).not.toHaveBeenCalled()
	})

	it("does not replace a newer binding created while the request was in flight", () => {
		const element = image()
		element.contents[0] = { ...element.contents[0], assetId: "newer-asset" }
		const harness = createHarness(element)

		expect(
			bindImageContentToAsset(harness.canvas, {
				elementId: "image-1",
				contentId: "content-1",
				sourcePath: "./images/one.png",
				assetId: "late-response-asset",
			}),
		).toBe("asset-changed")
		expect(harness.update).not.toHaveBeenCalled()
	})
})
