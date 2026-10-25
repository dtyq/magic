import { describe, expect, it } from "vitest"
import type { VideoInputModeConfig } from "../../../../../public/magic-types"
import {
	cloneModeDraftCache,
	mergeCurrentUiIntoModeDraftCache,
	projectQuickEditSourceIntoModeDraft,
	removeQuickEditSourceFromModeDraftCache,
	replaceQuickEditSourceInModeDraftCache,
} from "../draft/video-editor-config.draft"
import type {
	LinkedFrameBinding,
	VideoModeInputDraft,
	VideoReferenceAssetInfo,
} from "../video-editor-config.types"

function createBinding(path: string): LinkedFrameBinding {
	return {
		framePath: path,
		sourceConnectionId: "connection-image",
		sourcePath: path,
		sourceKind: "image",
		sourceFileName: "frame.png",
		frameRole: "start",
	}
}

describe("video mode draft linked frame bindings", () => {
	it("clones persisted bindings without sharing mutable references", () => {
		const binding = createBinding("./images/frame.png")
		const source: Partial<Record<"keyframe_guided", VideoModeInputDraft>> = {
			keyframe_guided: {
				frameImageInfos: [],
				referenceAssetInfos: [],
				linkedFrameBindings: [binding],
			},
		}

		const cloned = cloneModeDraftCache(source)

		expect(cloned.keyframe_guided?.linkedFrameBindings).toEqual([binding])
		expect(cloned.keyframe_guided?.linkedFrameBindings?.[0]).not.toBe(binding)
	})

	it("saves bindings with the current input mode draft", () => {
		const binding = createBinding("./images/frame.png")
		const merged = mergeCurrentUiIntoModeDraftCache(
			{},
			"keyframe_guided",
			"prompt",
			"frame",
			[{ path: binding.framePath, src: binding.framePath, fileName: binding.sourceFileName }],
			[],
			[binding],
		)

		expect(merged.keyframe_guided?.linkedFrameBindings).toEqual([binding])
		expect(merged.keyframe_guided?.linkedFrameBindings?.[0]).not.toBe(binding)
	})
})

describe("quick edit source projection across input modes", () => {
	const source: VideoReferenceAssetInfo = {
		path: "./videos/current.mp4",
		src: "./videos/current.mp4",
		fileName: "current.mp4",
		assetType: "video",
	}
	const videoModeConfig: VideoInputModeConfig = {
		supported_fields: ["reference_videos"],
		max_count: 2,
	}
	const emptyDraft: VideoModeInputDraft = {
		prompt: "",
		activeInputTab: "frame",
		frameImageInfos: [],
		linkedFrameBindings: [],
		referenceAssetInfos: [],
	}

	it("carries the quick-edit source into another reference-video mode without dropping the target prompt", () => {
		const result = projectQuickEditSourceIntoModeDraft({
			draft: { ...emptyDraft, prompt: "target prompt" },
			source,
			inputMode: "video_edit",
			modeConfig: videoModeConfig,
		})

		expect(result.applied).toBe(true)
		expect(result.draft.prompt).toBe("target prompt @current.mp4")
		expect(result.draft.activeInputTab).toBe("reference")
		expect(result.draft.referenceAssetInfos).toEqual([source])
	})

	it("restores the source after switching from the seeded mode to an empty target draft", () => {
		const sourceModeCache = mergeCurrentUiIntoModeDraftCache(
			{},
			"omni_reference",
			"@current.mp4",
			"reference",
			[],
			[source],
			[],
		)
		const targetDraft = sourceModeCache.video_edit ?? emptyDraft
		const result = projectQuickEditSourceIntoModeDraft({
			draft: targetDraft,
			source,
			inputMode: "video_edit",
			modeConfig: videoModeConfig,
		})

		expect(result.applied).toBe(true)
		expect(result.draft.prompt).toBe("@current.mp4")
		expect(result.draft.referenceAssetInfos).toEqual([source])
	})

	it("deduplicates the source by canvas resource identity", () => {
		const result = projectQuickEditSourceIntoModeDraft({
			draft: {
				...emptyDraft,
				prompt: "@current.mp4",
				referenceAssetInfos: [{ ...source }],
			},
			source,
			inputMode: "omni_reference",
			modeConfig: videoModeConfig,
		})

		expect(result.applied).toBe(true)
		expect(result.draft.prompt).toBe("@current.mp4")
		expect(result.draft.referenceAssetInfos).toHaveLength(1)
	})

	it("does not pretend to carry the source into a mode without reference videos", () => {
		const result = projectQuickEditSourceIntoModeDraft({
			draft: emptyDraft,
			source,
			inputMode: "image_reference",
			modeConfig: { supported_fields: ["reference_images"] },
		})

		expect(result.applied).toBe(false)
		expect(result.reason).toBe("unsupported-mode")
		expect(result.draft.referenceAssetInfos).toEqual([])
	})

	it("reports capacity instead of silently dropping the source", () => {
		const result = projectQuickEditSourceIntoModeDraft({
			draft: {
				...emptyDraft,
				referenceAssetInfos: [
					{
						path: "./videos/other.mp4",
						src: "./videos/other.mp4",
						fileName: "other.mp4",
						assetType: "video",
					},
				],
			},
			source,
			inputMode: "video_edit",
			modeConfig: { supported_fields: ["reference_videos"], max_count: 1 },
		})

		expect(result.applied).toBe(false)
		expect(result.reason).toBe("capacity")
	})

	it("removes the source from every mode draft after an explicit removal", () => {
		const cache = mergeCurrentUiIntoModeDraftCache(
			mergeCurrentUiIntoModeDraftCache(
				{},
				"omni_reference",
				"@current.mp4",
				"reference",
				[],
				[source],
				[],
			),
			"video_edit",
			"target @current.mp4",
			"reference",
			[],
			[source],
			[],
		)

		const result = removeQuickEditSourceFromModeDraftCache(cache, source)

		expect(result.omni_reference?.prompt).toBe("")
		expect(result.video_edit?.prompt).toBe("target")
		expect(result.omni_reference?.referenceAssetInfos).toEqual([])
		expect(result.video_edit?.referenceAssetInfos).toEqual([])
	})

	it("replaces the source in every projected mode draft", () => {
		const nextSource: VideoReferenceAssetInfo = {
			path: "./videos/next.mp4",
			src: "./videos/next.mp4",
			fileName: "next.mp4",
			assetType: "video",
		}
		const cache = mergeCurrentUiIntoModeDraftCache(
			{},
			"video_edit",
			"@current.mp4",
			"reference",
			[],
			[source],
			[],
		)

		const result = replaceQuickEditSourceInModeDraftCache(cache, source, nextSource)

		expect(result.video_edit?.prompt).toBe("@next.mp4")
		expect(result.video_edit?.referenceAssetInfos).toEqual([nextSource])
	})
})
