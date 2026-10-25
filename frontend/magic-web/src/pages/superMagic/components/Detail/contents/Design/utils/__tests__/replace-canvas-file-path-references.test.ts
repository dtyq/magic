import { describe, expect, it } from "vitest"
import type { ResolveCanvasResourceReference } from "@/components/CanvasDesign/public/resource-reference"
import {
	ElementTypeEnum,
	type CanvasDocument,
} from "@/components/CanvasDesign/runtime/document/types"
import {
	getCanvasFilePathReplacementResult,
	replaceCanvasFilePathReferences,
} from "../replace-canvas-file-path-references"
import { resolveDesignResourceReference } from "../designResourceReferenceResolver"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { buildDesignAttachmentIndex } from "../designAttachmentIndex"

function attachment(fileId: string, path: string): FileItem {
	return {
		file_id: fileId,
		file_name: path.split("/").pop() || path,
		relative_file_path: path,
		is_directory: false,
	} as FileItem
}

function createResolver(files: FileItem[]): ResolveCanvasResourceReference {
	return (input, options) =>
		resolveDesignResourceReference(
			input,
			{
				designProjectBasePath: "画布A",
				flatAttachments: files,
				attachmentIndex: buildDesignAttachmentIndex(files),
				attachmentsReady: true,
			},
			options,
		)
}

describe("replaceCanvasFilePathReferences", () => {
	it("rewrites every image Content without adding Element-level fields", () => {
		const canvas = {
			elements: [
				{
					id: "versioned-image",
					type: ElementTypeEnum.Image,
					activeContentId: "v2",
					mainContentId: "v1",
					contents: [
						{
							contentId: "v1",
							src: "./images/source.png",
							generateImageRequest: {
								reference_images: ["/画布A/images/source.png"],
							},
						},
						{
							contentId: "v2",
							src: "/画布A/images/source.png",
							imageGenerationTaskMeta: {
								type: "high",
								file_path: "./images/source.png",
							},
						},
					],
				},
			],
		} as CanvasDocument

		const next = replaceCanvasFilePathReferences(canvas, {
			oldWorkspaceRelativePath: "画布A/images/source.png",
			newCanvasPath: "./images/renamed.png",
			resolveResourceReference: createResolver([
				attachment("canvas-a", "画布A/images/source.png"),
			]),
		})
		const image = next.elements?.[0] as unknown as Record<string, unknown>

		expect(image.contents).toEqual([
			expect.objectContaining({
				contentId: "v1",
				src: "./images/renamed.png",
				generateImageRequest: expect.objectContaining({
					reference_images: ["./images/renamed.png"],
				}),
			}),
			expect.objectContaining({
				contentId: "v2",
				src: "./images/renamed.png",
				imageGenerationTaskMeta: expect.objectContaining({
					file_path: "./images/renamed.png",
				}),
			}),
		])
		expect(image).not.toHaveProperty("src")
		expect(image).not.toHaveProperty("generateImageRequest")
	})

	it("rewrites only resolver-proven aliases of the renamed resource", () => {
		const resolveDesignAResourceReference = createResolver([
			attachment("canvas-a", "画布A/images/source.png"),
			attachment("workspace-root", "images/source.png"),
			attachment("canvas-b", "画布B/images/source.png"),
		])
		const canvas = {
			elements: [
				{
					id: "image-current",
					type: ElementTypeEnum.Image,
					activeContentId: "image-current-content-1",
					mainContentId: "image-current-content-1",
					contents: [
						{
							contentId: "image-current-content-1",
							src: "./images/source.png",
							generateImageRequest: {
								reference_images: [
									"/画布A/images/source.png",
									"/images/source.png",
									"/画布B/images/source.png",
								],
								reference_image_options: [
									{ path: "./images/source.png" },
									{ path: "/images/source.png" },
								],
							},
							imageGenerationTaskMeta: {
								type: "expand",
								file_path: "/画布A/images/source.png",
								canvas_path: "/画布A/images/source.png",
								mask_path: "/画布A/images/source.png",
								mark_path: "/画布A/images/source.png",
							},
						},
					],
				},
				{
					id: "video-current",
					type: ElementTypeEnum.Video,
					activeContentId: "video-current-content-1",
					mainContentId: "video-current-content-1",
					contents: [
						{
							contentId: "video-current-content-1",
							src: "/画布A/images/source.png",
							generateVideoRequest: {
								inputs: {
									frames: [{ uri: "./images/source.png" }],
									reference_images: [{ uri: "/images/source.png" }],
									draft_task: {
										video_id: "draft-video-id",
										uri: "/画布A/images/source.png",
									},
								},
							},
						},
					],
				},
			],
		} as CanvasDocument

		const next = replaceCanvasFilePathReferences(canvas, {
			oldWorkspaceRelativePath: "画布A/images/source.png",
			newCanvasPath: "./images/renamed.png",
			resolveResourceReference: resolveDesignAResourceReference,
		})
		const image = next.elements?.[0] as unknown as {
			contents: Array<{
				src: string
				generateImageRequest: {
					reference_images: string[]
					reference_image_options: Array<{ path: string }>
				}
				imageGenerationTaskMeta: {
					file_path: string
					canvas_path: string
					mask_path: string
					mark_path: string
				}
			}>
		}
		const video = next.elements?.[1] as unknown as {
			contents: Array<{
				src: string
				generateVideoRequest: {
					inputs: {
						frames: Array<{ uri: string }>
						reference_images: Array<{ uri: string }>
						draft_task: { video_id: string; uri: string }
					}
				}
			}>
		}

		expect(next).not.toBe(canvas)
		expect(image.contents[0]?.src).toBe("./images/renamed.png")
		expect(image.contents[0]?.generateImageRequest.reference_images).toEqual([
			"./images/renamed.png",
			"/images/source.png",
			"/画布B/images/source.png",
		])
		expect(image.contents[0]?.generateImageRequest.reference_image_options).toEqual([
			{ path: "./images/renamed.png" },
			{ path: "/images/source.png" },
		])
		expect(image.contents[0]?.imageGenerationTaskMeta).toEqual({
			type: "expand",
			file_path: "./images/renamed.png",
			canvas_path: "/画布A/images/source.png",
			mask_path: "/画布A/images/source.png",
			mark_path: "/画布A/images/source.png",
		})
		expect(video.contents[0]?.src).toBe("./images/renamed.png")
		expect(video.contents[0]?.generateVideoRequest.inputs.frames).toEqual([
			{ uri: "./images/renamed.png" },
		])
		expect(video.contents[0]?.generateVideoRequest.inputs.reference_images).toEqual([
			{ uri: "/images/source.png" },
		])
		expect(video.contents[0]?.generateVideoRequest.inputs.draft_task).toEqual({
			video_id: "draft-video-id",
			uri: "./images/renamed.png",
		})
	})

	it("returns the original document when only another workspace resource matches by name", () => {
		const resolveDesignAResourceReference = createResolver([
			attachment("canvas-a", "画布A/images/source.png"),
			attachment("workspace-root", "images/source.png"),
		])
		const canvas = {
			elements: [
				{
					id: "workspace-root",
					type: ElementTypeEnum.Image,
					activeContentId: "workspace-root-content-1",
					mainContentId: "workspace-root-content-1",
					contents: [
						{ contentId: "workspace-root-content-1", src: "/images/source.png" },
					],
				},
			],
		} as CanvasDocument

		expect(
			replaceCanvasFilePathReferences(canvas, {
				oldWorkspaceRelativePath: "画布A/images/source.png",
				newCanvasPath: "./images/renamed.png",
				resolveResourceReference: resolveDesignAResourceReference,
			}),
		).toBe(canvas)
	})

	it("rewrites a legacy bare path when unique attachment evidence proves its identity", () => {
		const canvas = {
			elements: [
				{
					id: "legacy-current",
					type: ElementTypeEnum.Image,
					activeContentId: "legacy-current-content-1",
					mainContentId: "legacy-current-content-1",
					contents: [{ contentId: "legacy-current-content-1", src: "images/source.png" }],
				},
			],
		} as CanvasDocument
		const next = replaceCanvasFilePathReferences(canvas, {
			oldWorkspaceRelativePath: "画布A/images/source.png",
			newCanvasPath: "./images/renamed.png",
			resolveResourceReference: createResolver([
				attachment("canvas-a", "画布A/images/source.png"),
			]),
		})

		expect(next).not.toBe(canvas)
		expect(next.elements?.[0]).toEqual(
			expect.objectContaining({
				contents: [expect.objectContaining({ src: "./images/renamed.png" })],
			}),
		)
	})

	it("fails closed for a legacy bare path with current-canvas and workspace-root candidates", () => {
		const canvas = {
			elements: [
				{
					id: "legacy-ambiguous",
					type: ElementTypeEnum.Image,
					activeContentId: "legacy-ambiguous-content-1",
					mainContentId: "legacy-ambiguous-content-1",
					contents: [
						{ contentId: "legacy-ambiguous-content-1", src: "images/source.png" },
					],
				},
			],
		} as CanvasDocument

		const options = {
			oldWorkspaceRelativePath: "画布A/images/source.png",
			newCanvasPath: "./images/renamed.png",
			resolveResourceReference: createResolver([
				attachment("canvas-a", "画布A/images/source.png"),
				attachment("workspace-root", "images/source.png"),
			]),
		}
		expect(getCanvasFilePathReplacementResult(canvas, options)).toEqual({
			status: "unsafe",
			canvasData: canvas,
		})
		expect(replaceCanvasFilePathReferences(canvas, options)).toBe(canvas)
	})
})
