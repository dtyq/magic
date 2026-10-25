import { describe, expect, it } from "vitest"
import {
	buildReferenceAssetInputs,
	resolveReferenceAssetType,
	resolveVideoReferenceAssetInfo,
} from "../model-config/video-editor-config.model"

describe("opaque reference asset types", () => {
	it("uses explicit or metadata types for opaque URIs and never infers from their suffix", () => {
		expect(
			resolveReferenceAssetType("asset://resource.png", {
				explicitAssetType: "video",
			}),
		).toBe("video")
		expect(
			resolveReferenceAssetType("asset://resource", {
				metadataCandidates: [{ path: "asset://resource", assetType: "audio" }],
			}),
		).toBe("audio")
		expect(resolveReferenceAssetType("asset://resource.png")).toBeUndefined()
	})

	it("keeps ordinary extension inference as the final fallback", () => {
		expect(resolveReferenceAssetType("./images/reference.png")).toBe("image")
		expect(resolveReferenceAssetType("./videos/reference.mp4")).toBe("video")
		expect(resolveReferenceAssetType("./audios/reference.mp3")).toBe("audio")
	})

	it("submits typed opaque URIs unchanged in the correct input bucket", () => {
		expect(
			buildReferenceAssetInputs(
				[
					{
						path: "asset://video-id",
						src: "asset://video-id",
						fileName: "asset://video-id",
						assetType: "video",
					},
				],
				{ supported_fields: ["reference_videos"] },
			),
		).toEqual({ reference_videos: [{ uri: "asset://video-id" }] })
	})

	it("builds a typed opaque asset from linked metadata and filters an untyped URI", () => {
		expect(
			resolveVideoReferenceAssetInfo({
				path: "asset://linked-video",
				metadataCandidates: [{ path: "asset://linked-video", assetType: "video" }],
			}),
		).toMatchObject({
			path: "asset://linked-video",
			assetType: "video",
		})
		expect(resolveVideoReferenceAssetInfo({ path: "asset://unknown" })).toBeUndefined()
	})
})
