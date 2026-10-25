import { describe, expect, it } from "vitest"

import type { PluginFileAsset } from "../types"
import {
	hydratePluginFileAssetSources,
	registerPluginSourceElementByKey,
	resolvePluginSourceElementId,
} from "../pluginSourceElements"
import { createTestResourceReferenceResolver } from "../../../../../public/__tests__/testResourceReferenceResolver"

describe("pluginSourceElements", () => {
	it("hydrates resolved assets by returned asset keys instead of input index", () => {
		const sourceElementByAssetKey = new Map<string, string>()
		registerPluginSourceElementByKey(sourceElementByAssetKey, "images/a.png", "element-a")
		registerPluginSourceElementByKey(sourceElementByAssetKey, "images/b.png", "element-b")

		const resolvedAssets: PluginFileAsset[] = [
			{
				id: "images/b.png",
				path: "images/b.png",
				url: "https://example.com/signed-b.png",
				src: "https://example.com/signed-b.png",
				fileName: "b.png",
				type: "image",
			},
		]

		const [asset] = hydratePluginFileAssetSources(sourceElementByAssetKey, resolvedAssets)

		expect(asset.sourceElementId).toBe("element-b")
		expect(resolvePluginSourceElementId(sourceElementByAssetKey, [asset.url])).toBe("element-b")
	})

	it("does not collide current-canvas aliases across resolver contexts", () => {
		const sourceElementByAssetKey = new Map<string, string>()
		const canvasAResolver = createTestResourceReferenceResolver({
			currentCanvasWorkspacePath: "/画布A",
		})
		const canvasBResolver = createTestResourceReferenceResolver({
			currentCanvasWorkspacePath: "/画布B",
		})

		registerPluginSourceElementByKey(
			sourceElementByAssetKey,
			"./images/x.png",
			"element-a",
			canvasAResolver,
		)
		registerPluginSourceElementByKey(
			sourceElementByAssetKey,
			"./images/x.png",
			"element-b",
			canvasBResolver,
		)

		expect(
			resolvePluginSourceElementId(
				sourceElementByAssetKey,
				["/画布A/images/x.png"],
				canvasAResolver,
			),
		).toBe("element-a")
		expect(
			resolvePluginSourceElementId(
				sourceElementByAssetKey,
				["/画布B/images/x.png"],
				canvasBResolver,
			),
		).toBe("element-b")
	})
})
