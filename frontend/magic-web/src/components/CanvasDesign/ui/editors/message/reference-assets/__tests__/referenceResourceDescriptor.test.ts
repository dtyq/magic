import { describe, expect, it } from "vitest"
import type { ResolveCanvasResourceReference } from "../../../../../public/resource-reference"
import {
	createReferenceResourceDescriptor,
	resolveReferenceResourceAssetType,
} from "../referenceResourceDescriptor"

const resolveResourceReference: ResolveCanvasResourceReference = (input) => {
	const path = "path" in input ? input.path : "url" in input ? input.url : ""
	if (path.startsWith("asset://")) {
		return {
			status: "resolved",
			resourceKind: "opaque-asset",
			rawReference: path,
			storagePath: path,
			identity: `opaque-asset:${path}`,
			candidates: [],
			legacyRecovered: false,
			resolutionSource: "opaque-asset",
		}
	}
	return {
		status: "resolved",
		resourceKind: "workspace-file",
		rawReference: path,
		workspacePath: path,
		storagePath: path,
		identity: `workspace-file:${path}`,
		candidates: [path],
		legacyRecovered: false,
		resolutionSource: "strict-path",
	}
}

describe("referenceResourceDescriptor", () => {
	it("keeps opaque URI identity and display data separate from file semantics", () => {
		expect(
			createReferenceResourceDescriptor({
				path: "asset://virtual-human-asset-id",
				assetType: "video",
				resolveResourceReference,
			}),
		).toEqual({
			path: "asset://virtual-human-asset-id",
			identity: "opaque-asset:asset://virtual-human-asset-id",
			resourceKind: "opaque-asset",
			fileName: "asset://virtual-human-asset-id",
			src: "asset://virtual-human-asset-id",
			assetType: "video",
		})
	})

	it("prefers explicit and matching metadata before path inference", () => {
		const inferFromPath = () => "image" as const

		expect(
			resolveReferenceResourceAssetType({
				path: "asset://resource",
				explicitAssetType: "audio",
				metadataCandidates: [{ path: "asset://resource", assetType: "video" }],
				inferFromPath,
				resolveResourceReference,
			}),
		).toBe("audio")
		expect(
			resolveReferenceResourceAssetType({
				path: "asset://resource",
				metadataCandidates: [{ path: "asset://resource", assetType: "video" }],
				inferFromPath,
				resolveResourceReference,
			}),
		).toBe("video")
	})

	it("silently leaves an untyped opaque URI unresolved", () => {
		expect(
			resolveReferenceResourceAssetType({
				path: "asset://resource.png",
				inferFromPath: () => "image",
				resolveResourceReference,
			}),
		).toBeUndefined()
	})
})
