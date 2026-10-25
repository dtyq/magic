import { describe, expect, it } from "vitest"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import {
	collectImageEditorExistingClipboardResourceKeys,
	collectVideoEditorExistingClipboardResourceKeys,
} from "../collectMediaEditorExistingClipboardResourceKeys"

const resolveResourceReference = createTestResourceReferenceResolver({
	currentCanvasWorkspacePath: "/画布A",
})

describe("collectMediaEditorExistingClipboardResourceKeys", () => {
	it("includes image editor paths, resolver identities, and mention file ids", () => {
		expect(
			collectImageEditorExistingClipboardResourceKeys({
				referencePaths: ["./images/cat.png"],
				referenceFileInfos: [{ path: "./images/cat.png" }],
				mentionBindings: [
					{
						path: "./images/cat.png",
						fileId: "file-cat",
						sourceFileId: "source-cat",
					},
				],
				resolveResourceReference,
			}),
		).toEqual(["./images/cat.png", "workspace:/画布A/images/cat.png", "file-cat", "source-cat"])
	})

	it("includes video editor frame slots and asset file ids", () => {
		expect(
			collectVideoEditorExistingClipboardResourceKeys({
				referencePaths: ["./clips/ref.mp4"],
				referenceAssetInfos: [
					{
						path: "./clips/ref.mp4",
						file_id: "file-ref",
						source_file_id: "source-ref",
					},
				],
				framePaths: ["./frames/start.png", "", "./frames/end.png"],
				mentionBindings: [
					{
						path: "./clips/ref.mp4",
						fileId: "file-ref",
					},
				],
				resolveResourceReference,
			}),
		).toEqual([
			"./clips/ref.mp4",
			"workspace:/画布A/clips/ref.mp4",
			"./frames/start.png",
			"./frames/end.png",
			"workspace:/画布A/frames/start.png",
			"workspace:/画布A/frames/end.png",
			"file-ref",
			"source-ref",
		])
	})
})
