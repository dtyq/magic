import { describe, expect, it } from "vitest"
import { ElementTypeEnum } from "@/components/CanvasDesign/runtime/document/types"
import { upgradeDesignDataToV3, validateV3CanvasDocument } from "../designDataCodec"
import { MAGIC_PROJECT_VERSION_V3 } from "../magicProjectCompression"

describe("designDataCodec", () => {
	it("migrates flat media and text fields into the first Content", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "legacy",
			version: "1.0.0",
			canvas: {
				elements: [
					{
						id: "image-1",
						type: ElementTypeEnum.Image,
						src: "./images/a.png",
						status: "completed",
						visualUnderstanding: { summary: "legacy image" },
					},
					{
						id: "text-1",
						type: ElementTypeEnum.Text,
						content: [{ children: [{ type: "text", text: "hello" }] }],
					},
				],
			},
		})

		expect(result.version).toBe(MAGIC_PROJECT_VERSION_V3)
		expect(result.canvas?.elements?.[0]).toMatchObject({
			activeContentId: "image-1-content-1",
			mainContentId: "image-1-content-1",
			contents: [
				{
					contentId: "image-1-content-1",
					src: "./images/a.png",
					status: "completed",
					visualUnderstanding: { summary: "legacy image" },
				},
			],
		})
		expect(result.canvas?.elements?.[1]).toMatchObject({
			contents: [
				{ contentId: "text-1-content-1", content: [{ children: [{ text: "hello" }] }] },
			],
		})
		validateV3CanvasDocument(result.canvas)
	})

	it("normalizes nullable media error messages during migration", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "nullable-media-error",
			version: MAGIC_PROJECT_VERSION_V3,
			canvas: {
				elements: [
					{
						id: "image-1",
						type: ElementTypeEnum.Image,
						contents: [
							{
								contentId: "image-1-content-1",
								src: "./images/a.png",
								status: "completed",
								errorMessage: null,
							},
						],
						activeContentId: "image-1-content-1",
						mainContentId: "image-1-content-1",
					},
					{
						id: "video-1",
						type: ElementTypeEnum.Video,
						contents: [
							{
								contentId: "video-1-content-1",
								src: "./videos/a.mp4",
								status: "completed",
								errorMessage: null,
							},
						],
						activeContentId: "video-1-content-1",
						mainContentId: "video-1-content-1",
					},
				],
			},
		})

		expect(result.canvas?.elements?.[0]?.contents[0]).not.toHaveProperty("errorMessage")
		expect(result.canvas?.elements?.[1]?.contents[0]).not.toHaveProperty("errorMessage")
		validateV3CanvasDocument(result.canvas)
	})

	it("preserves valid media asset bindings and removes invalid ones during migration", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "image-asset-bindings",
			version: MAGIC_PROJECT_VERSION_V3,
			canvas: {
				elements: [
					{
						id: "image-valid",
						type: ElementTypeEnum.Image,
						contents: [
							{
								contentId: "image-valid-content-1",
								src: "./images/valid.png",
								assetId: "960212772906762240",
							},
						],
						activeContentId: "image-valid-content-1",
						mainContentId: "image-valid-content-1",
					},
					{
						id: "image-invalid",
						type: ElementTypeEnum.Image,
						contents: [
							{
								contentId: "image-invalid-content-1",
								src: "./images/invalid.png",
								assetId: 960212772906762240,
							},
						],
						activeContentId: "image-invalid-content-1",
						mainContentId: "image-invalid-content-1",
					},
					{
						id: "video-valid",
						type: ElementTypeEnum.Video,
						contents: [
							{
								contentId: "video-valid-content-1",
								src: "./videos/valid.mp4",
								assetId: "asset-video",
							},
						],
						activeContentId: "video-valid-content-1",
						mainContentId: "video-valid-content-1",
					},
					{
						id: "audio-valid",
						type: ElementTypeEnum.Audio,
						contents: [
							{
								contentId: "audio-valid-content-1",
								src: "./audios/valid.mp3",
								assetId: "asset-audio",
							},
						],
						activeContentId: "audio-valid-content-1",
						mainContentId: "audio-valid-content-1",
					},
				],
			},
		})

		expect(result.canvas?.elements?.[0]).toMatchObject({
			contents: [{ assetId: "960212772906762240" }],
		})
		expect(result.canvas?.elements?.[1]?.contents[0]).not.toHaveProperty("assetId")
		expect(result.canvas?.elements?.[2]).toMatchObject({
			contents: [{ assetId: "asset-video" }],
		})
		expect(result.canvas?.elements?.[3]).toMatchObject({
			contents: [{ assetId: "asset-audio" }],
		})
		validateV3CanvasDocument(result.canvas)
	})

	it("preserves video generation runtime metadata during V2 to V3 migration", () => {
		const videoGenerationResultMeta = {
			runtime: {
				started_at: "2026-09-14 14:00:14",
				finished_at: "2026-09-14 14:12:11",
				elapsed_seconds: 717,
			},
		}
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "legacy-video",
			version: "2.0.0",
			canvas: {
				elements: [
					{
						id: "video-1",
						type: ElementTypeEnum.Video,
						videoGenerationResultMeta,
					},
				],
			},
		})

		expect(result.canvas?.elements?.[0]).toMatchObject({
			activeContentId: "video-1-content-1",
			mainContentId: "video-1-content-1",
			contents: [
				{
					contentId: "video-1-content-1",
					videoGenerationResultMeta,
				},
			],
		})
	})

	it("drops visual understanding from non-media legacy and Content data", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "non-media-visual-understanding",
			canvas: {
				elements: [
					{
						id: "text-legacy",
						type: ElementTypeEnum.Text,
						content: [{ children: [{ type: "text", text: "legacy" }] }],
						visualUnderstanding: { summary: "should drop" },
					},
					{
						id: "text-v3",
						type: ElementTypeEnum.Text,
						contents: [
							{
								contentId: "text-v3-content-1",
								content: [{ children: [{ type: "text", text: "v3" }] }],
								visualUnderstanding: { summary: "should drop" },
							},
						],
						activeContentId: "text-v3-content-1",
						mainContentId: "text-v3-content-1",
					},
				],
			},
		})

		for (const element of result.canvas?.elements ?? []) {
			expect(element).not.toHaveProperty("visualUnderstanding")
			expect(element.contents[0]).not.toHaveProperty("visualUnderstanding")
		}
		validateV3CanvasDocument(result.canvas)
	})

	it("migrates nested Frame/Group children and keeps node identity stable", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "nested",
			version: "2.0.0",
			canvas: {
				elements: [
					{
						id: "frame-1",
						type: ElementTypeEnum.Frame,
						children: [
							{
								id: "video-1",
								type: ElementTypeEnum.Video,
								src: "./videos/a.mp4",
							},
						],
					},
				],
			},
		})

		const frame = result.canvas?.elements?.[0]
		const child = frame && "children" in frame ? frame.children?.[0] : undefined
		expect(frame).toMatchObject({ id: "frame-1", type: ElementTypeEnum.Frame })
		expect(child).toMatchObject({
			id: "video-1",
			type: ElementTypeEnum.Video,
			contents: [{ contentId: "video-1-content-1", src: "./videos/a.mp4" }],
		})
	})

	it("strips nulls, unknown keys, and invalid optional values during v3 migration", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "legacy-dirty-frame-child",
			version: "2.0.0",
			canvas: {
				elements: [
					{
						id: "frame-1",
						type: ElementTypeEnum.Frame,
						legacyPluginField: true,
						children: [
							{
								id: "image-1",
								type: ElementTypeEnum.Image,
								visible: null,
								locked: null,
								opacity: null,
								scaleX: null,
								scaleY: null,
								x: null,
								rotation: 15,
								src: "./images/a.png",
								status: null,
								selected: true,
							},
						],
					},
				],
			},
		})

		const child =
			result.canvas?.elements?.[0] && "children" in result.canvas.elements[0]
				? result.canvas.elements[0].children?.[0]
				: undefined
		expect(result.canvas?.elements?.[0]).not.toHaveProperty("legacyPluginField")
		expect(child).toMatchObject({
			id: "image-1",
			type: ElementTypeEnum.Image,
			contents: [{ contentId: "image-1-content-1", src: "./images/a.png" }],
		})
		expect(child).not.toHaveProperty("visible")
		expect(child).not.toHaveProperty("x")
		expect(child).not.toHaveProperty("rotation")
		expect(child).not.toHaveProperty("selected")
		expect(child).not.toHaveProperty("status")
		validateV3CanvasDocument(result.canvas)
	})

	it("drops the legacy high-image request when task metadata already exists", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "legacy-high-image",
			version: "1.0.0",
			canvas: {
				elements: [
					{
						id: "image-1",
						type: ElementTypeEnum.Image,
						imageGenerationTaskMeta: {
							type: "high",
							image_id: "new-task",
							file_path: "./images/new.png",
						},
						generateHightImageRequest: {
							image_id: "legacy-task",
							file_path: "./images/legacy.png",
						},
					},
				],
			},
		})

		const content = result.canvas?.elements?.[0]?.contents[0]
		expect(content).toMatchObject({
			imageGenerationTaskMeta: {
				image_id: "new-task",
				file_path: "./images/new.png",
			},
		})
		expect(content).not.toHaveProperty("generateHightImageRequest")
		validateV3CanvasDocument(result.canvas)
	})

	it("removes deprecated storyboard duration fields while preserving output mappings", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "legacy-storyboard",
			version: MAGIC_PROJECT_VERSION_V3,
			canvas: {
				elements: [
					{
						id: "storyboard-1",
						type: ElementTypeEnum.Storyboard,
						contents: [
							{
								contentId: "storyboard-1-content-1",
								shots: [
									{
										id: "shot-1",
										durationSeconds: 3,
										description: "抱在一起",
										outputImageElementId: "image-1",
									},
								],
							},
						],
						activeContentId: "storyboard-1-content-1",
						mainContentId: "storyboard-1-content-1",
					},
				],
				connections: [
					{
						id: "storyboard-output",
						sourceElementId: "storyboard-1",
						targetElementId: "image-1",
						locked: true,
						legacyField: "remove-me",
					},
				],
			},
		})

		expect(result.canvas?.elements?.[0]?.contents[0]?.shots).toEqual([
			{ id: "shot-1", description: "抱在一起", outputImageElementId: "image-1" },
		])
		expect(result.canvas?.connections).toEqual([
			{
				id: "storyboard-output",
				sourceElementId: "storyboard-1",
				targetElementId: "image-1",
			},
		])
		validateV3CanvasDocument(result.canvas)
	})

	it("preserves an explicitly incomplete empty Content container", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "incomplete",
			version: MAGIC_PROJECT_VERSION_V3,
			canvas: {
				elements: [
					{
						id: "image-1",
						type: ElementTypeEnum.Image,
						contents: [],
						activeContentId: null,
						mainContentId: null,
					},
				],
			},
		})

		expect(result.canvas?.elements?.[0]).toMatchObject({
			contents: [],
			activeContentId: null,
			mainContentId: null,
		})
	})

	it("migrates unpublished video-edit sequences into connections", () => {
		const result = upgradeDesignDataToV3({
			type: "design",
			name: "legacy-video-edit",
			version: MAGIC_PROJECT_VERSION_V3,
			canvas: {
				elements: [
					{
						id: "video-edit-1",
						type: ElementTypeEnum.VideoEdit,
						contents: [
							{
								contentId: "video-edit-1-content-1",
								videoSequence: ["video-1", "video-2"],
								audioSequence: ["audio-1"],
								output: { format: "mp4", aspectRatio: "1:1", resolution: "1080P" },
							},
						],
						activeContentId: "video-edit-1-content-1",
						mainContentId: "video-edit-1-content-1",
					},
				],
			},
		})

		expect(result.canvas?.elements?.[0]?.contents[0]).toEqual({
			contentId: "video-edit-1-content-1",
			videoSequence: ["video-1", "video-2"],
			audioSequence: ["audio-1"],
		})
		expect(result.canvas?.connections).toEqual([
			{
				id: "video-edit-1-legacy-video-1",
				sourceElementId: "video-1",
				targetElementId: "video-edit-1",
			},
			{
				id: "video-edit-1-legacy-video-2",
				sourceElementId: "video-2",
				targetElementId: "video-edit-1",
			},
			{
				id: "video-edit-1-legacy-audio-1",
				sourceElementId: "audio-1",
				targetElementId: "video-edit-1",
			},
		])
		validateV3CanvasDocument(result.canvas)
	})
})
