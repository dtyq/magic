import { describe, expect, it } from "vitest"
import type {
	FrameElement,
	ImageElement,
	ImageElementContent,
	VideoElement,
	VideoElementContent,
} from "../../document/types"
import { ImageGenerationTaskTypeMap } from "../../../public/magic-types"
import {
	addClipboardResourceAliasMappings,
	collectElementResourceReferences,
	rewriteElementResourceReferences,
} from "../clipboard/clipboardResourceReferences"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"

function imageElement(
	contents: ImageElementContent[],
	activeContentId = contents[0]?.contentId ?? null,
	mainContentId = contents[0]?.contentId ?? null,
): ImageElement {
	return { id: "image-1", type: "image", contents, activeContentId, mainContentId }
}

function videoElement(contents: VideoElementContent[]): VideoElement {
	const contentId = contents[0]?.contentId ?? null
	return {
		id: "video-1",
		type: "video",
		contents,
		activeContentId: contentId,
		mainContentId: contentId,
	}
}

describe("clipboardResourceReferences", () => {
	it("collects and rewrites resources from every image Content", () => {
		const image = imageElement(
			[
				{
					contentId: "v1",
					src: "./images/one.png",
					generateImageRequest: { reference_images: ["./images/ref-one.png"] },
				},
				{
					contentId: "v2",
					src: "./images/two.png",
					imageGenerationTaskMeta: {
						type: ImageGenerationTaskTypeMap.High,
						file_path: "./images/base-two.png",
					},
				},
			],
			"v2",
			"v1",
		)

		expect(collectElementResourceReferences([image]).map((ref) => ref.path)).toEqual([
			"./images/one.png",
			"./images/ref-one.png",
			"./images/two.png",
			"./images/base-two.png",
		])

		rewriteElementResourceReferences(
			image,
			new Map([
				["./images/one.png", "./images/copied-one.png"],
				["./images/ref-one.png", "./images/copied-ref-one.png"],
				["./images/two.png", "./images/copied-two.png"],
				["./images/base-two.png", "./images/copied-base-two.png"],
			]),
		)

		expect(image.contents).toEqual([
			expect.objectContaining({
				contentId: "v1",
				src: "./images/copied-one.png",
				generateImageRequest: expect.objectContaining({
					reference_images: ["./images/copied-ref-one.png"],
				}),
			}),
			expect.objectContaining({
				contentId: "v2",
				src: "./images/copied-two.png",
				imageGenerationTaskMeta: expect.objectContaining({
					file_path: "./images/copied-base-two.png",
				}),
			}),
		])
		expect(image.activeContentId).toBe("v2")
		expect(image.mainContentId).toBe("v1")
	})

	it("collects resource references recursively and skips remote paths", () => {
		const image = imageElement([
			{
				contentId: "image-content",
				src: "./images/visible.png",
				generateImageRequest: {
					prompt: "plain text source/ref.png should not matter",
					reference_images: ["source/ref.png", "https://example.test/remote.png"],
					reference_image_options: [{ path: "source/ref.png" }],
				},
				imageGenerationTaskMeta: {
					type: ImageGenerationTaskTypeMap.Eraser,
					file_path: "./images/visible.png",
					mask_path: "source/mask.png",
					mark_path: "data:image/png;base64,aaaa",
				},
			},
		])
		const video = videoElement([
			{
				contentId: "video-content",
				src: "source/video.mp4",
				generateVideoRequest: {
					inputs: {
						frames: [{ role: "start", uri: "source/start.png" }],
						reference_videos: [{ uri: "source/ref.mp4" }],
						reference_audios: [{ uri: "blob:https://example.test/audio" }],
						video: { uri: "source/video.mp4" },
					},
				},
			},
		])
		const frame: FrameElement = {
			id: "frame-1",
			type: "frame",
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			contents: [{ contentId: "frame-content" }],
			children: [image, video],
		}

		expect(
			collectElementResourceReferences([frame]).map((ref) => ({
				path: ref.path,
				isSelfReferenceOnly: ref.isSelfReferenceOnly,
			})),
		).toEqual([
			{ path: "./images/visible.png", isSelfReferenceOnly: true },
			{ path: "source/ref.png", isSelfReferenceOnly: false },
			{ path: "source/video.mp4", isSelfReferenceOnly: true },
			{ path: "source/start.png", isSelfReferenceOnly: false },
			{ path: "source/ref.mp4", isSelfReferenceOnly: false },
		])
	})

	it("rewrites only schema resource fields", () => {
		const image = imageElement([
			{
				contentId: "image-content",
				generateImageRequest: {
					project_id: "source-project",
					file_dir: "/source/images/",
					prompt: "keep source/ref.png in prompt text",
					reference_images: ["source/ref.png"],
					reference_image_options: [{ path: "source/ref.png" }],
				},
				imageGenerationTaskMeta: {
					type: ImageGenerationTaskTypeMap.Expand,
					file_path: "source/base.png",
					canvas_path: "source/canvas.png",
					mask_path: "source/mask.png",
					mark_path: "source/mark.png",
				},
			},
		])
		const content = image.contents[0]

		const changed = rewriteElementResourceReferences(
			image,
			new Map([
				["source/ref.png", "target/ref.png"],
				["source/base.png", "target/base.png"],
				["source/canvas.png", "target/canvas.png"],
				["source/mask.png", "target/mask.png"],
				["source/mark.png", "target/mark.png"],
			]),
		)

		expect(changed).toBe(true)
		expect(content.generateImageRequest?.prompt).toBe("keep source/ref.png in prompt text")
		expect(content.generateImageRequest?.reference_images).toEqual(["target/ref.png"])
		expect(content.generateImageRequest?.reference_image_options).toEqual([
			expect.objectContaining({ path: "target/ref.png" }),
		])
		expect(content.generateImageRequest?.project_id).toBeUndefined()
		expect(content.generateImageRequest?.file_dir).toBeUndefined()
		expect(content.imageGenerationTaskMeta).toEqual(
			expect.objectContaining({
				file_path: "target/base.png",
				canvas_path: "source/canvas.png",
				mask_path: "source/mask.png",
				mark_path: "source/mark.png",
			}),
		)
	})

	it("collects and rewrites only the uri fallback of a draft task", () => {
		const video = videoElement([
			{
				contentId: "video-content",
				src: "./videos/final.mp4",
				generateVideoRequest: {
					input_mode: "draft_task",
					inputs: {
						draft_task: {
							video_id: "draft-video-id",
							uri: "./videos/draft.mp4",
						},
					},
				},
			},
		])

		expect(collectElementResourceReferences([video]).map((ref) => ref.path)).toEqual([
			"./videos/final.mp4",
			"./videos/draft.mp4",
		])
		rewriteElementResourceReferences(
			video,
			new Map([
				["./videos/final.mp4", "./videos/copied-final.mp4"],
				["./videos/draft.mp4", "./videos/copied-draft.mp4"],
			]),
		)

		expect(video.contents[0].generateVideoRequest?.inputs?.draft_task).toEqual({
			video_id: "draft-video-id",
			uri: "./videos/copied-draft.mp4",
		})
	})

	it("dedupes and rewrites aliases without crossing workspace roots", () => {
		const resolveResourceReference = createTestResourceReferenceResolver()
		const image = imageElement([
			{
				contentId: "image-content",
				src: "./images/owner.png",
				generateImageRequest: {
					reference_images: ["./images/x.png", "/画布A/images/x.png", "/images/x.png"],
				},
			},
		])

		expect(collectElementResourceReferences([image], resolveResourceReference)).toEqual([
			{
				path: "./images/owner.png",
				identity: "workspace:/画布A/images/owner.png",
				aliases: ["./images/owner.png"],
				isSelfReferenceOnly: true,
			},
			{
				path: "./images/x.png",
				identity: "workspace:/画布A/images/x.png",
				aliases: ["./images/x.png", "/画布A/images/x.png"],
				isSelfReferenceOnly: false,
			},
			{
				path: "/images/x.png",
				identity: "workspace:/images/x.png",
				aliases: ["/images/x.png"],
				isSelfReferenceOnly: false,
			},
		])

		rewriteElementResourceReferences(
			image,
			new Map([["./images/x.png", "./images/copied.png"]]),
			resolveResourceReference,
		)

		expect(image.contents[0].generateImageRequest?.reference_images).toEqual([
			"./images/copied.png",
			"./images/copied.png",
			"/images/x.png",
		])
	})

	it("rewrites source-canvas aliases without interpreting them through the target resolver", () => {
		const sourceResolver = createTestResourceReferenceResolver({
			currentCanvasWorkspacePath: "/画布A",
		})
		const targetResolver = createTestResourceReferenceResolver({
			currentCanvasWorkspacePath: "/画布B",
		})
		const image = imageElement([
			{
				contentId: "image-content",
				generateImageRequest: {
					reference_images: ["./images/x.png", "/画布A/images/x.png"],
				},
			},
		])
		const [reference] = collectElementResourceReferences([image], sourceResolver)
		const pathMap = new Map<string, string>()
		addClipboardResourceAliasMappings(
			pathMap,
			reference.path,
			reference.aliases,
			"./images/copied.png",
		)

		rewriteElementResourceReferences(image, pathMap, targetResolver)

		expect(image.contents[0].generateImageRequest?.reference_images).toEqual([
			"./images/copied.png",
			"./images/copied.png",
		])
	})
})
