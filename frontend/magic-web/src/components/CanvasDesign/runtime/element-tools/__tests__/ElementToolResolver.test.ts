import { describe, expect, it, vi } from "vitest"
import { ElementToolTypeEnum } from "../../../public/props"
import { resolveCanvasAccessContext } from "../../core/CanvasAccessPolicy"
import {
	ElementTypeEnum,
	type ImageElement,
	type LayerElement,
	type VideoElement,
} from "../../document/types"
import { createElementToolContext } from "../model/ElementToolContext"
import { resolveElementTools } from "../resolver/ElementToolResolver"

function createImage(overrides: Partial<ImageElement> = {}): ImageElement {
	return {
		id: "image-1",
		type: ElementTypeEnum.Image,
		activeContentId: "content-a",
		mainContentId: "content-a",
		contents: [{ contentId: "content-a", src: "a.png", status: "completed" }],
		...overrides,
	}
}

function createVideo(overrides: Partial<VideoElement> = {}): VideoElement {
	return {
		id: "video-1",
		type: ElementTypeEnum.Video,
		activeContentId: "content-a",
		mainContentId: "content-a",
		contents: [{ contentId: "content-a", src: "a.mp4", status: "completed" }],
		...overrides,
	}
}

function resolve(
	image: ImageElement,
	options?: Omit<Parameters<typeof createElementToolContext>[0], "selectedElements">,
) {
	const context = createElementToolContext({
		selectedElements: [image],
		...options,
	})
	if (!context) throw new Error("expected a tool context")
	return {
		context,
		top: resolveElementTools(context, "top"),
		bottom: resolveElementTools(context, "bottom"),
	}
}

function resolveTopForSelection(
	elements: LayerElement[],
	parentIds: ReadonlyMap<string, string | null> = new Map(),
	parents: readonly LayerElement[] = [],
) {
	const parentById = new Map(parents.map((parent) => [parent.id, parent]))
	const context = createElementToolContext({
		selectedElements: elements,
		canvas: {
			elementManager: {
				findParentIdForElement: (id: string) => parentIds.get(id) ?? undefined,
				getElementData: (id: string) => parentById.get(id),
			},
		} as never,
	})
	if (!context) throw new Error("expected a tool context")
	return resolveElementTools(context, "top")
}

describe("ElementToolResolver", () => {
	it("shows generate-final only when the selected video registers the runtime capability", () => {
		const video = createVideo()
		const withoutRuntime = createElementToolContext({ selectedElements: [video] })
		if (!withoutRuntime) throw new Error("expected a tool context")
		expect(resolveElementTools(withoutRuntime, "bottom").map((tool) => tool.id)).not.toContain(
			ElementToolTypeEnum.GenerationGenerateFinal,
		)

		const withRuntime = createElementToolContext({
			selectedElements: [video],
			toolRuntimeStates: new Map([
				[
					ElementToolTypeEnum.GenerationGenerateFinal,
					{
						available: true,
						data: {
							videoGenerationEstimate: { resolution: "1080P", points: 3190 },
						},
					},
				],
			]),
		})
		if (!withRuntime) throw new Error("expected a tool context")
		const generateFinal = resolveElementTools(withRuntime, "bottom").find(
			(tool) => tool.id === ElementToolTypeEnum.GenerationGenerateFinal,
		)
		expect(generateFinal?.data).toEqual({
			videoGenerationEstimate: { resolution: "1080P", points: 3190 },
		})
	})

	it("hides re-edit for a draft-task final even before runtime commands register", () => {
		const video = createVideo({
			contents: [
				{
					contentId: "content-a",
					src: "final.mp4",
					status: "completed",
					generateVideoRequest: {
						model_id: "video-model",
						input_mode: "draft_task",
						inputs: { draft_task: { video_id: "draft-task" } },
					},
				},
			],
		})
		const context = createElementToolContext({ selectedElements: [video] })
		if (!context) throw new Error("expected a tool context")
		const toolIds = resolveElementTools(context, "bottom").map((tool) => tool.id)

		expect(toolIds).not.toContain(ElementToolTypeEnum.GenerationReEdit)
		expect(toolIds).toContain(ElementToolTypeEnum.GenerationQuickEdit)
		expect(toolIds).toContain(ElementToolTypeEnum.GenerationGenerateAgain)
	})

	it("keeps the completed active Content operable while a sibling is processing", () => {
		const { context, top, bottom } = resolve(
			createImage({
				contents: [
					{ contentId: "content-a", src: "a.png", status: "completed" },
					{ contentId: "content-b", src: "b.png", status: "processing" },
				],
			}),
		)

		expect(context.generation.activeContentIsGenerating).toBe(false)
		expect(context.generation.siblingGeneratingContentIds).toEqual(["content-b"])
		expect(top.map((tool) => tool.id)).toEqual(
			expect.arrayContaining([
				ElementToolTypeEnum.ContentCrop,
				ElementToolTypeEnum.ContentReplace,
				ElementToolTypeEnum.ContentDownload,
			]),
		)
		expect(bottom.map((tool) => tool.id)).toEqual(
			expect.arrayContaining([
				ElementToolTypeEnum.GenerationQuickEdit,
				ElementToolTypeEnum.GenerationReEdit,
				ElementToolTypeEnum.GenerationGenerateAgain,
			]),
		)
		expect(bottom.some((tool) => tool.id === ElementToolTypeEnum.VersionDelete)).toBe(true)
		const generationToolIds = new Set<string>([
			ElementToolTypeEnum.GenerationQuickEdit,
			ElementToolTypeEnum.GenerationReEdit,
			ElementToolTypeEnum.GenerationGenerateAgain,
		])
		for (const tool of bottom.filter((item) => generationToolIds.has(item.id))) {
			expect(tool.target.contentId).toBe("content-a")
		}
	})

	it("hides generation actions while the active Content is preparing", () => {
		const { context, bottom } = resolve(createImage(), {
			canvas: {
				generationRuntimeManager: {
					getTargetStates: () => [],
					getSubmissionState: () => ({
						elementId: "image-1",
						contentId: "content-a",
						submissionId: "submission-1",
						phase: "preparing",
						startedAt: Date.now(),
					}),
				},
			} as never,
		})

		expect(context.generation.activeContentIsGenerating).toBe(true)
		expect(bottom.map((tool) => tool.id)).not.toContain(
			ElementToolTypeEnum.GenerationGenerateAgain,
		)
		expect(bottom.map((tool) => tool.id)).not.toContain(ElementToolTypeEnum.GenerationReEdit)
	})

	it("allows deleting an active processing Content while keeping other unsafe operations hidden", () => {
		const { context, top, bottom } = resolve(
			createImage({
				activeContentId: "content-b",
				contents: [
					{ contentId: "content-a", src: "a.png", status: "completed" },
					{ contentId: "content-b", src: "b.png", status: "processing" },
				],
			}),
		)

		expect(context.generation.activeContentIsGenerating).toBe(true)
		expect(top.map((tool) => tool.id)).toEqual([ElementToolTypeEnum.ContentDownload])
		expect(bottom.map((tool) => tool.id)).not.toContain(
			ElementToolTypeEnum.GenerationGenerateAgain,
		)
		expect(bottom.map((tool) => tool.id)).toContain(ElementToolTypeEnum.VersionPrevious)
		expect(bottom.map((tool) => tool.id)).toContain(ElementToolTypeEnum.VersionNext)
		expect(bottom.map((tool) => tool.id)).toContain(ElementToolTypeEnum.VersionDelete)
	})

	it("allows deleting an active failed Content", () => {
		const { bottom } = resolve(
			createImage({
				activeContentId: "content-b",
				contents: [
					{ contentId: "content-a", src: "a.png", status: "completed" },
					{ contentId: "content-b", status: "failed", errorMessage: "generation failed" },
				],
			}),
		)

		expect(bottom.map((tool) => tool.id)).toContain(ElementToolTypeEnum.VersionDelete)
	})

	it("hides AI image editing tools when their abilities are disabled", () => {
		const { top } = resolve(createImage(), {
			removeBackgroundSupported: false,
			eraserSupported: false,
			expandSupported: false,
		})

		expect(top.map((tool) => tool.id)).not.toContain(
			ElementToolTypeEnum.ContentRemoveBackground,
		)
		expect(top.map((tool) => tool.id)).not.toContain(ElementToolTypeEnum.ContentEraser)
		expect(top.map((tool) => tool.id)).not.toContain(ElementToolTypeEnum.ContentExtend)
	})

	it("keeps share mode limited to readonly-safe version browsing by default", () => {
		const { top, bottom } = resolve(
			createImage({
				contents: [
					{ contentId: "content-a", src: "a.png", status: "completed" },
					{ contentId: "content-b", src: "b.png", status: "completed" },
				],
			}),
			{
				canvas: {
					permissionManager: {
						getContext: () => resolveCanvasAccessContext({ mode: "share" }),
					},
				} as never,
			},
		)

		expect(top).toEqual([])
		expect(bottom.map((tool) => tool.id)).toEqual([
			ElementToolTypeEnum.VersionPrevious,
			ElementToolTypeEnum.VersionNext,
			ElementToolTypeEnum.VersionCount,
		])
	})

	it("allows the host to add download capability without enabling document edits", () => {
		const { top, bottom } = resolve(
			createImage({
				contents: [
					{ contentId: "content-a", src: "a.png", status: "completed" },
					{ contentId: "content-b", src: "b.png", status: "completed" },
				],
			}),
			{
				canvas: {
					permissionManager: {
						getContext: () =>
							resolveCanvasAccessContext({
								mode: "share",
								capabilities: { "sideEffect.download": true },
							}),
					},
				} as never,
			},
		)

		expect(top.map((tool) => tool.id)).toEqual([ElementToolTypeEnum.ContentDownload])
		expect(bottom.map((tool) => tool.id)).toEqual([
			ElementToolTypeEnum.VersionPrevious,
			ElementToolTypeEnum.VersionNext,
			ElementToolTypeEnum.VersionCount,
		])
	})

	it("hides generation tools when document write is denied", () => {
		const { bottom } = resolve(createImage(), {
			canvas: {
				permissionManager: {
					getContext: () =>
						resolveCanvasAccessContext({
							mode: "edit",
							capabilities: {
								"document.write": false,
								"sideEffect.generate": true,
							},
						}),
				},
			} as never,
		})

		expect(bottom.map((tool) => tool.id)).not.toEqual(
			expect.arrayContaining([
				ElementToolTypeEnum.GenerationQuickEdit,
				ElementToolTypeEnum.GenerationReEdit,
				ElementToolTypeEnum.GenerationGenerateAgain,
			]),
		)
	})

	it("captures the active Content target instead of re-reading it later", () => {
		const image = createImage({
			contents: [
				{ contentId: "content-a", src: "a.png", status: "completed" },
				{ contentId: "content-b", src: "b.png", status: "completed" },
			],
		})
		const context = createElementToolContext({ selectedElements: [image] })
		if (!context) throw new Error("expected a tool context")
		const tool = resolveElementTools(context, "top").find(
			(item) => item.id === ElementToolTypeEnum.ContentCrop,
		)
		if (!tool) throw new Error("expected crop tool")

		image.activeContentId = "content-b"
		expect(tool.target).toEqual({ elementId: "image-1", contentId: "content-a" })
	})

	it("uses the legacy image groups and global order", () => {
		const { top } = resolve(createImage(), { convertHightSupported: true })
		const imageToolIds = new Set<string>([
			ElementToolTypeEnum.ElementResize,
			ElementToolTypeEnum.ContentCrop,
			ElementToolTypeEnum.ContentExtend,
			ElementToolTypeEnum.ContentRemoveBackground,
			ElementToolTypeEnum.ContentEraser,
			ElementToolTypeEnum.ContentEnhance,
			ElementToolTypeEnum.ContentPromptExtraction,
			ElementToolTypeEnum.ContentReplace,
			ElementToolTypeEnum.ContentDownload,
		])
		const imageTools = top.filter((tool) => imageToolIds.has(tool.id))

		expect(imageTools.map((tool) => tool.id)).toEqual([
			ElementToolTypeEnum.ElementResize,
			ElementToolTypeEnum.ContentCrop,
			ElementToolTypeEnum.ContentExtend,
			ElementToolTypeEnum.ContentRemoveBackground,
			ElementToolTypeEnum.ContentEraser,
			ElementToolTypeEnum.ContentEnhance,
			ElementToolTypeEnum.ContentPromptExtraction,
			ElementToolTypeEnum.ContentReplace,
			ElementToolTypeEnum.ContentDownload,
		])
		expect(imageTools.map((tool) => tool.presentation.group)).toEqual([
			"element",
			"image-edit",
			"image-edit",
			"image-edit",
			"image-edit",
			"image-edit",
			"image-edit",
			"media",
			"media",
		])
	})

	it("exposes media original size for images and videos", () => {
		const video = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			activeContentId: "content-a",
			mainContentId: "content-a",
			contents: [{ contentId: "content-a", src: "a.mp4", status: "completed" }],
		} as never
		const { top } = resolve(video, { showMediaOriginalSize: true })
		const originalSize = top.find(
			(tool) => tool.id === ElementToolTypeEnum.ContentMediaOriginalSize,
		)
		const replace = top.find((tool) => tool.id === ElementToolTypeEnum.ContentReplace)

		expect(originalSize?.presentation.group).toBe("element")
		expect(replace?.presentation.group).toBe("media")

		const image = createImage()
		const imageTools = resolve(image, { showMediaOriginalSize: true }).top
		const imageResize = imageTools.find((tool) => tool.id === ElementToolTypeEnum.ElementResize)
		const imageOriginalSize = imageTools.find(
			(tool) => tool.id === ElementToolTypeEnum.ContentMediaOriginalSize,
		)
		expect(imageOriginalSize?.presentation.group).toBe(imageResize?.presentation.group)
		expect(imageOriginalSize?.presentation.order).toBeGreaterThan(
			imageResize?.presentation.order ?? Number.MAX_SAFE_INTEGER,
		)
	})

	it("does not attach a Content target to element-scoped tools", () => {
		const frame = {
			id: "frame-1",
			type: ElementTypeEnum.Frame,
			contents: [],
		} as never
		const context = createElementToolContext({ selectedElements: [frame] })
		if (!context) throw new Error("expected a tool context")
		const resize = resolveElementTools(context, "top").find(
			(item) => item.id === ElementToolTypeEnum.ElementResize,
		)
		expect(resize?.target).toEqual({ elementId: "frame-1" })
	})

	it("exposes layout tools for a single Group", () => {
		const group = {
			id: "group-1",
			type: ElementTypeEnum.Group,
			contents: [{ contentId: "group-content" }],
			activeContentId: "group-content",
			mainContentId: "group-content",
			children: [],
		} as LayerElement

		const toolIds = resolveTopForSelection([group]).map((tool) => tool.id)

		expect(toolIds).toEqual(
			expect.arrayContaining([
				ElementToolTypeEnum.ElementAlign,
				ElementToolTypeEnum.ElementDistribute,
			]),
		)
	})

	it("exposes layout tools for ordinary nodes with the same parent", () => {
		const first = createImage({ id: "image-1" })
		const second = createImage({ id: "image-2" })
		const parentIds = new Map([
			[first.id, "frame-1"],
			[second.id, "frame-1"],
		])

		const toolIds = resolveTopForSelection([first, second], parentIds).map((tool) => tool.id)

		expect(toolIds).toEqual(
			expect.arrayContaining([
				ElementToolTypeEnum.ElementAlign,
				ElementToolTypeEnum.ElementDistribute,
			]),
		)
		expect(toolIds).not.toContain(ElementToolTypeEnum.FrameCreate)
	})

	it("hides layout tools for ordinary nodes from different parents", () => {
		const first = createImage({ id: "image-1" })
		const second = createImage({ id: "image-2" })
		const parentIds = new Map([
			[first.id, "frame-1"],
			[second.id, "frame-2"],
		])

		const toolIds = resolveTopForSelection([first, second], parentIds).map((tool) => tool.id)

		expect(toolIds).not.toContain(ElementToolTypeEnum.ElementAlign)
		expect(toolIds).not.toContain(ElementToolTypeEnum.ElementDistribute)
	})

	it("hides layout tools when the shared parent is locked", () => {
		const first = createImage({ id: "image-1" })
		const second = createImage({ id: "image-2" })
		const parent = {
			id: "frame-1",
			type: ElementTypeEnum.Frame,
			locked: true,
		} as LayerElement
		const parentIds = new Map([
			[first.id, parent.id],
			[second.id, parent.id],
		])

		const toolIds = resolveTopForSelection([first, second], parentIds, [parent]).map(
			(tool) => tool.id,
		)

		expect(toolIds).not.toContain(ElementToolTypeEnum.ElementAlign)
		expect(toolIds).not.toContain(ElementToolTypeEnum.ElementDistribute)
	})

	it("does not expose unsafe tools while the element is being replaced", () => {
		const { top, bottom } = resolve(createImage(), { isReplacing: true })
		expect(top).toEqual([])
		expect(bottom).toEqual([])
	})

	it("hides the bottom surface during an active Content tool session", () => {
		const { bottom } = resolve(createImage(), {
			activeToolSession: {
				toolId: ElementToolTypeEnum.ContentEnhance,
				elementId: "image-1",
				contentId: "content-a",
				operationId: "operation-1",
			},
		})

		expect(bottom).toEqual([])
	})

	it("keeps the complete version set while an image editor is mounted", () => {
		const { bottom } = resolve(
			createImage({
				contents: [
					{ contentId: "content-a", src: "a.png", status: "completed" },
					{ contentId: "content-b", src: "b.png", status: "completed" },
				],
			}),
			{ isEditing: true },
		)

		expect(bottom.map((tool) => tool.id)).toEqual([
			ElementToolTypeEnum.VersionPrevious,
			ElementToolTypeEnum.VersionNext,
			ElementToolTypeEnum.VersionCount,
			ElementToolTypeEnum.VersionSetMain,
			ElementToolTypeEnum.VersionDelete,
		])
	})

	it("keeps the complete version set while a video editor is mounted", () => {
		const { bottom } = resolve(
			{
				id: "video-1",
				type: ElementTypeEnum.Video,
				activeContentId: "content-a",
				mainContentId: "content-a",
				contents: [
					{ contentId: "content-a", src: "a.mp4", status: "completed" },
					{ contentId: "content-b", src: "b.mp4", status: "completed" },
				],
			} as never,
			{ isEditing: true },
		)

		expect(bottom.map((tool) => tool.id)).toEqual([
			ElementToolTypeEnum.VersionPrevious,
			ElementToolTypeEnum.VersionNext,
			ElementToolTypeEnum.VersionCount,
			ElementToolTypeEnum.VersionSetMain,
			ElementToolTypeEnum.VersionDelete,
		])
	})

	it("keeps the existing empty bottom surface for audio editors", () => {
		const audio = {
			id: "audio-1",
			type: ElementTypeEnum.Audio,
			activeContentId: "content-a",
			mainContentId: "content-a",
			contents: [
				{ contentId: "content-a", src: "a.mp3", status: "completed" },
				{ contentId: "content-b", src: "b.mp3", status: "completed" },
			],
		} as never

		const { bottom } = resolve(audio, { isEditing: true })
		expect(bottom).toEqual([])
	})

	it("includes runtime-only generation targets in version capabilities", () => {
		const image = createImage({
			contents: [
				{ contentId: "content-a", src: "a.png", status: "completed" },
				{ contentId: "content-b", src: "b.png", status: "completed" },
			],
		})
		const { bottom } = resolve(image, {
			canvas: {
				generationRuntimeManager: {
					getTargetStates: () => [
						{
							elementId: image.id,
							contentId: "content-b",
							attemptId: "attempt-b",
							operation: "image-generate",
							phase: "processing",
						},
					],
				},
			} as never,
		})

		expect(bottom.some((tool) => tool.id === ElementToolTypeEnum.VersionDelete)).toBe(true)
		expect(bottom.some((tool) => tool.id === ElementToolTypeEnum.VersionSetMain)).toBe(true)
	})

	it("blocks setting the main version when the active target is runtime-generating", () => {
		const image = createImage({
			contents: [
				{ contentId: "content-a", src: "a.png", status: "completed" },
				{ contentId: "content-b", src: "b.png", status: "completed" },
			],
		})
		const { bottom } = resolve(image, {
			canvas: {
				generationRuntimeManager: {
					getTargetStates: () => [
						{
							elementId: image.id,
							contentId: "content-a",
							attemptId: "attempt-a",
							operation: "image-generate",
							phase: "processing",
						},
					],
				},
			} as never,
		})

		expect(bottom.some((tool) => tool.id === ElementToolTypeEnum.VersionSetMain)).toBe(false)
	})
})

describe("ElementToolResolver command targets", () => {
	it("keeps command targets independent from active version changes", () => {
		const image = createImage()
		const context = createElementToolContext({ selectedElements: [image] })
		if (!context) throw new Error("expected a tool context")
		const tool = resolveElementTools(context, "top").find(
			(item) => item.id === ElementToolTypeEnum.ContentDownload,
		)
		const execute = vi.fn()
		if (!tool) throw new Error("expected download tool")
		tool.execute = execute
		image.activeContentId = "content-b"
		tool.execute()
		expect(tool.target.contentId).toBe("content-a")
	})
})
