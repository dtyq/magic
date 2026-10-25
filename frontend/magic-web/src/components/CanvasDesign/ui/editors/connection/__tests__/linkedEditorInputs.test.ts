import { describe, expect, it } from "vitest"
import type { Canvas } from "../../../../runtime/core/Canvas"
import type { VideoInputModeConfig } from "../../../../public/magic-types"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import {
	type CanvasConnection,
	type AudioElement,
	ElementTypeEnum,
	type FrameElement,
	type GroupElement,
	type ImageElement as ImageElementData,
	type LayerElement,
	type RectangleElement,
	type TextElement,
	type VideoElement,
} from "../../../../runtime/document/types"
import {
	collectLinkedFrameSourceElements,
	collectLinkedEditorSourceElements,
	createLinkedFrameSourceId,
	createLinkedUpstreamSourceId,
	dedupeLinkedMediaItemsByPath,
	getLinkedMediaReferenceIdentity,
	mergeLinkedMediaPathsWithResolver,
	mergeLinkedMediaReferences,
	resolveLinkedMediaDisplay,
	resolveLinkedMediaAssociation,
	resolveLinkedMediaItems,
	resolveLinkedMediaPolicySelection,
	resolveLinkedMediaSelectionDisplay,
	resolveLinkedEditorInputs,
	type LinkedEditorMediaCandidate,
	type ResolveLinkedMediaAssociationOptions,
} from "../linkedEditorInputs"
import { validateReferenceAssetsByLimits } from "../../../../runtime/media-editors/video/reference-asset-limits"

const resolveDesignAResourceReference = createTestResourceReferenceResolver()

function textElement(id: string, text: string, zIndex = 0): TextElement {
	return {
		id,
		type: ElementTypeEnum.Text,
		zIndex,
		activeContentId: `${id}-content-1`,
		mainContentId: `${id}-content-1`,
		contents: [
			{ contentId: `${id}-content-1`, content: [{ children: [{ type: "text", text }] }] },
		],
	}
}

function imageElement(id: string, src: string, zIndex = 0): ImageElementData {
	return {
		id,
		type: ElementTypeEnum.Image,
		zIndex,
		activeContentId: `${id}-content-1`,
		mainContentId: `${id}-content-1`,
		contents: [{ contentId: `${id}-content-1`, src }],
	}
}

function videoElement(id: string, src: string, zIndex = 0): VideoElement {
	return {
		id,
		type: ElementTypeEnum.Video,
		zIndex,
		activeContentId: `${id}-content-1`,
		mainContentId: `${id}-content-1`,
		contents: [{ contentId: `${id}-content-1`, src }],
	}
}

function audioElement(id: string, src?: string, zIndex = 0): AudioElement {
	return {
		id,
		type: ElementTypeEnum.Audio,
		zIndex,
		activeContentId: `${id}-content-1`,
		mainContentId: `${id}-content-1`,
		contents: [{ contentId: `${id}-content-1`, ...(src ? { src } : {}) }],
	}
}

function createCanvasStub(elements: LayerElement[], connections: CanvasConnection[]): Canvas {
	const elementById = new Map<string, LayerElement>()
	const register = (element: LayerElement) => {
		elementById.set(element.id, element)
		if ("children" in element && Array.isArray(element.children)) {
			element.children.forEach(register)
		}
	}
	elements.forEach(register)
	return {
		connectionManager: {
			getUpstreamConnections: (elementId: string) =>
				connections.filter((connection) => connection.targetElementId === elementId),
		},
		elementManager: {
			getElementData: (elementId: string) => elementById.get(elementId),
		},
	} as unknown as Canvas
}

describe("linked frame source collection", () => {
	it("resolves linked image inputs from the main Content", () => {
		const source: ImageElementData = {
			id: "source-image",
			type: ElementTypeEnum.Image,
			activeContentId: "dsl-active",
			mainContentId: "associated-content",
			contents: [
				{ contentId: "dsl-active", src: "./images/dsl-active.png" },
				{
					contentId: "associated-content",
					src: "./images/associated.png",
					crop: { x: 10, y: 20, width: 300, height: 200 },
				},
			],
		}
		const target = videoElement("target", "./videos/target.mp4")
		const canvas = createCanvasStub(
			[source, target],
			[{ id: "image-video", sourceElementId: source.id, targetElementId: target.id }],
		)

		const [item] = resolveLinkedEditorInputs({
			canvas,
			targetElementId: target.id,
			targetKind: "video",
		}).mediaItems

		expect(item).toMatchObject({
			path: "./images/associated.png",
			sourceCrop: { x: 10, y: 20, width: 300, height: 200 },
			sourceContentId: "associated-content",
		})
	})

	it("resolves text, video, and audio downstream inputs from their main Contents", () => {
		const text = textElement("source-text", "active prompt")
		text.contents.push({
			contentId: "source-text-main",
			content: [{ children: [{ type: "text", text: "main prompt" }] }],
		})
		text.mainContentId = "source-text-main"

		const video = videoElement("source-video", "./videos/active.mp4")
		video.contents.push({ contentId: "source-video-main", src: "./videos/main.mp4" })
		video.mainContentId = "source-video-main"

		const audio = audioElement("source-audio", "./audios/active.mp3")
		audio.contents.push({ contentId: "source-audio-main", src: "./audios/main.mp3" })
		audio.mainContentId = "source-audio-main"

		const target = videoElement("target", "./videos/target.mp4")
		const canvas = createCanvasStub(
			[text, video, audio, target],
			[text, video, audio].map((source) => ({
				id: `${source.id}-connection`,
				sourceElementId: source.id,
				targetElementId: target.id,
			})),
		)

		const result = resolveLinkedEditorInputs({
			canvas,
			targetElementId: target.id,
			targetKind: "video",
			mediaPolicy: { supportedKinds: ["video", "audio"] },
		})

		expect(result.connectedSourceElementIds).toEqual([text.id, video.id, audio.id])
		expect(result.textPrompt).toContain("main prompt")
		expect(result.textPrompt).not.toContain("active prompt")
		expect(result.mediaItems).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sourceElementId: video.id,
					path: "./videos/main.mp4",
					sourceContentId: "source-video-main",
				}),
				expect.objectContaining({
					sourceElementId: audio.id,
					path: "./audios/main.mp3",
					sourceContentId: "source-audio-main",
				}),
			]),
		)
	})

	it("collects direct and framed audio candidates for video targets", () => {
		const directAudio = audioElement("direct-audio", "./audios/direct.mp3")
		const framedAudio = audioElement("framed-audio", "./audios/framed.wav")
		const frame: FrameElement = {
			id: "audio-frame",
			type: ElementTypeEnum.Frame,
			activeContentId: "audio-frame-content-1",
			mainContentId: "audio-frame-content-1",
			contents: [{ contentId: "audio-frame-content-1" }],
			children: [framedAudio],
		}
		const target = videoElement("target", "./videos/target.mp4")
		const canvas = createCanvasStub(
			[directAudio, framedAudio, frame, target],
			[
				{
					id: "direct-audio-connection",
					sourceElementId: directAudio.id,
					targetElementId: target.id,
				},
				{
					id: "frame-connection",
					sourceElementId: frame.id,
					targetElementId: target.id,
				},
			],
		)

		const result = resolveLinkedEditorInputs({
			canvas,
			targetElementId: target.id,
			targetKind: "video",
			mediaPolicy: { supportedKinds: ["audio"], maxCountByKind: { audio: 2 } },
		})

		expect(result.mediaItems).toEqual([
			expect.objectContaining({
				connectionId: "direct-audio-connection",
				kind: "audio",
				path: "./audios/direct.mp3",
				status: "inactive",
			}),
			expect.objectContaining({
				connectionId: createLinkedFrameSourceId("frame-connection", "framed-audio"),
				kind: "audio",
				path: "./audios/framed.wav",
				status: "inactive",
			}),
		])
	})

	it("marks audio without src as missing and keeps it unsupported for image targets", () => {
		const source = audioElement("audio-source")
		const target = imageElement("target", "./images/target.png")
		const canvas = createCanvasStub(
			[source, target],
			[{ id: "audio-image", sourceElementId: source.id, targetElementId: target.id }],
		)

		const [item] = resolveLinkedEditorInputs({
			canvas,
			targetElementId: target.id,
			targetKind: "image",
			mediaPolicy: { supportedKinds: ["audio"] },
		}).mediaItems

		expect(item).toMatchObject({
			kind: "audio",
			status: "inactive",
			reason: "unsupported-type",
		})
	})

	it("recursively collects consumable visible descendants in stable z-index order", () => {
		const frame: FrameElement = {
			id: "frame-source",
			type: ElementTypeEnum.Frame,
			activeContentId: "frame-source-content-1",
			mainContentId: "frame-source-content-1",
			contents: [{ contentId: "frame-source-content-1" }],
			children: [
				textElement("text-top", "top", 20),
				<GroupElement>{
					id: "nested-group",
					type: ElementTypeEnum.Group,
					zIndex: 10,
					activeContentId: "nested-group-content-1",
					mainContentId: "nested-group-content-1",
					contents: [{ contentId: "nested-group-content-1" }],
					children: [imageElement("image", "/images/a.png", 1)],
				},
				<RectangleElement>{
					id: "shape",
					type: ElementTypeEnum.Rectangle,
					zIndex: 15,
					activeContentId: "shape-content-1",
					mainContentId: "shape-content-1",
					contents: [{ contentId: "shape-content-1" }],
				},
				{ ...videoElement("hidden-video", "/videos/a.mp4", 30), visible: false },
			],
		}

		expect(
			collectLinkedFrameSourceElements("frame-connection", frame).map((item) => ({
				connectionId: item.connectionId,
				sourceElementId: item.sourceElementId,
			})),
		).toEqual([
			{
				connectionId: createLinkedFrameSourceId("frame-connection", "image"),
				sourceElementId: "image",
			},
			{
				connectionId: createLinkedFrameSourceId("frame-connection", "text-top"),
				sourceElementId: "text-top",
			},
		])
	})

	it("expands a directly connected Group root into image inputs", () => {
		const group: GroupElement = {
			id: "group-source",
			type: ElementTypeEnum.Group,
			activeContentId: "group-source-content-1",
			mainContentId: "group-source-content-1",
			contents: [{ contentId: "group-source-content-1" }],
			children: [imageElement("group-image", "/images/group.png")],
		}
		const target = videoElement("target", "/videos/target.mp4")
		const canvas = createCanvasStub(
			[group, target],
			[
				{
					id: "group-connection",
					sourceElementId: group.id,
					targetElementId: target.id,
				},
			],
		)

		expect(
			resolveLinkedEditorInputs({
				canvas,
				targetElementId: target.id,
				targetKind: "video",
				mediaPolicy: { supportedKinds: ["image"] },
			}).mediaItems,
		).toEqual([
			expect.objectContaining({
				connectionId: createLinkedFrameSourceId("group-connection", "group-image"),
				sourceElementId: "group-image",
				rootSourceElementId: "group-source",
				path: "/images/group.png",
			}),
		])
	})

	it("expands an upstream frame and lets a direct element connection win deduplication", () => {
		const sharedImage = imageElement("shared-image", "/images/shared.png", 1)
		const frame: FrameElement = {
			id: "frame-source",
			type: ElementTypeEnum.Frame,
			activeContentId: "frame-source-content-1",
			mainContentId: "frame-source-content-1",
			contents: [{ contentId: "frame-source-content-1" }],
			children: [
				textElement("frame-text", "frame prompt", 0),
				sharedImage,
				videoElement("target", "/videos/target.mp4", 2),
			],
		}
		const canvas = createCanvasStub(
			[frame, sharedImage],
			[
				{
					id: "frame-connection",
					sourceElementId: frame.id,
					targetElementId: "target",
				},
				{
					id: "direct-image-connection",
					sourceElementId: sharedImage.id,
					targetElementId: "target",
				},
			],
		)

		const result = resolveLinkedEditorInputs({
			canvas,
			targetElementId: "target",
			targetKind: "video",
			mediaPolicy: { supportedKinds: ["image", "video"] },
		})

		expect(result.textConnections).toEqual([
			{
				connectionId: createLinkedFrameSourceId("frame-connection", "frame-text"),
				sourceElementId: "frame-text",
				text: "frame prompt",
			},
		])
		expect(result.mediaItems).toEqual([
			expect.objectContaining({
				connectionId: "direct-image-connection",
				sourceElementId: "shared-image",
				path: "/images/shared.png",
			}),
		])
	})
})

describe("linked upstream source collection", () => {
	it("keeps the current direct-only behavior when the static mode is direct", () => {
		const elementA = textElement("A", "A")
		const elementB = textElement("B", "B")
		const elementC = videoElement("C", "/videos/c.mp4")
		const canvas = createCanvasStub(
			[elementA, elementB, elementC],
			[
				{ id: "A-B", sourceElementId: "A", targetElementId: "B" },
				{ id: "B-C", sourceElementId: "B", targetElementId: "C" },
			],
		)

		expect(
			collectLinkedEditorSourceElements(canvas, "C", {
				mode: "direct",
				maxDepth: 2,
			}).map((item) => ({
				connectionId: item.connectionId,
				sourceElementId: item.sourceElementId,
			})),
		).toEqual([{ connectionId: "B-C", sourceElementId: "B" }])
	})

	it("collects upstream elements breadth-first up to the configured depth", () => {
		const elementA = textElement("A", "A")
		const elementB = textElement("B", "B")
		const elementC = videoElement("C", "/videos/c.mp4")
		const canvas = createCanvasStub(
			[elementA, elementB, elementC],
			[
				{ id: "A-B", sourceElementId: "A", targetElementId: "B" },
				{ id: "B-C", sourceElementId: "B", targetElementId: "C" },
			],
		)

		expect(
			collectLinkedEditorSourceElements(canvas, "C", {
				mode: "upstream",
				maxDepth: 2,
			}).map((item) => ({
				connectionId: item.connectionId,
				sourceElementId: item.sourceElementId,
			})),
		).toEqual([
			{ connectionId: "B-C", sourceElementId: "B" },
			{
				connectionId: createLinkedUpstreamSourceId("C", "A"),
				sourceElementId: "A",
			},
		])
	})

	it("continues through non-consumable graph nodes", () => {
		const elementA = textElement("A", "A")
		const elementB: RectangleElement = {
			id: "B",
			type: ElementTypeEnum.Rectangle,
			activeContentId: "B-content-1",
			mainContentId: "B-content-1",
			contents: [{ contentId: "B-content-1" }],
		}
		const elementC = videoElement("C", "/videos/c.mp4")
		const canvas = createCanvasStub(
			[elementA, elementB, elementC],
			[
				{ id: "A-B", sourceElementId: "A", targetElementId: "B" },
				{ id: "B-C", sourceElementId: "B", targetElementId: "C" },
			],
		)

		expect(
			collectLinkedEditorSourceElements(canvas, "C", {
				mode: "upstream",
				maxDepth: 2,
			}).map((item) => item.sourceElementId),
		).toEqual(["A"])
	})

	it("deduplicates diamond paths and stops when a cycle reaches the target again", () => {
		const elementA = textElement("A", "A")
		const elementB1 = textElement("B1", "B1")
		const elementB2 = textElement("B2", "B2")
		const elementC = videoElement("C", "/videos/c.mp4")
		const canvas = createCanvasStub(
			[elementA, elementB1, elementB2, elementC],
			[
				{ id: "A-B1", sourceElementId: "A", targetElementId: "B1" },
				{ id: "A-B2", sourceElementId: "A", targetElementId: "B2" },
				{ id: "B1-C", sourceElementId: "B1", targetElementId: "C" },
				{ id: "B2-C", sourceElementId: "B2", targetElementId: "C" },
				{ id: "C-A", sourceElementId: "C", targetElementId: "A" },
			],
		)

		expect(
			collectLinkedEditorSourceElements(canvas, "C", {
				mode: "upstream",
				maxDepth: 4,
			}).map((item) => item.sourceElementId),
		).toEqual(["B1", "B2", "A"])
	})

	it("supports unlimited upstream depth without looping through a cycle", () => {
		const elementA = textElement("A", "A")
		const elementB = textElement("B", "B")
		const elementC = videoElement("C", "/videos/c.mp4")
		const canvas = createCanvasStub(
			[elementA, elementB, elementC],
			[
				{ id: "A-B", sourceElementId: "A", targetElementId: "B" },
				{ id: "B-C", sourceElementId: "B", targetElementId: "C" },
				{ id: "C-A", sourceElementId: "C", targetElementId: "A" },
			],
		)

		expect(
			collectLinkedEditorSourceElements(canvas, "C", {
				mode: "upstream",
				maxDepth: Number.POSITIVE_INFINITY,
			}).map((item) => item.sourceElementId),
		).toEqual(["B", "A"])
	})

	it("uses the static unlimited mode in the editor input resolver", () => {
		const elementA = textElement("A", "A")
		const elementB = textElement("B", "B")
		const elementC = videoElement("C", "/videos/c.mp4")
		const canvas = createCanvasStub(
			[elementA, elementB, elementC],
			[
				{ id: "A-B", sourceElementId: "A", targetElementId: "B" },
				{ id: "B-C", sourceElementId: "B", targetElementId: "C" },
			],
		)

		expect(
			resolveLinkedEditorInputs({
				canvas,
				targetElementId: "C",
				targetKind: "video",
			}).textConnections.map((connection) => connection.sourceElementId),
		).toEqual(["B", "A"])
	})
})

describe("resolveLinkedMediaItems", () => {
	const imageCandidate: LinkedEditorMediaCandidate = {
		connectionId: "connection-image",
		sourceElementId: "image-source",
		kind: "image",
		path: "/images/source.png",
		fileName: "source.png",
	}
	const videoCandidate: LinkedEditorMediaCandidate = {
		connectionId: "connection-video",
		sourceElementId: "video-source",
		kind: "video",
		path: "/videos/source.mp4",
		fileName: "source.mp4",
	}

	it("marks supported linked media as active", () => {
		expect(
			resolveLinkedMediaItems([imageCandidate], {
				targetKind: "image",
				mediaPolicy: {
					supportedKinds: ["image"],
					maxTotalCount: 1,
				},
			}),
		).toEqual([expect.objectContaining({ status: "active" })])
	})

	it("allows linked media to build a variant incrementally", () => {
		const modeConfig: VideoInputModeConfig = {
			supported_fields: ["reference_images", "reference_videos"],
			variants: [
				{
					code: "image-and-video",
					limits: {
						reference_images: { min: 1, max: 1 },
						reference_videos: { min: 1, max: 1 },
					},
				},
			],
		}

		const result = resolveLinkedMediaItems([imageCandidate, videoCandidate], {
			targetKind: "video",
			mediaPolicy: {
				supportedKinds: ["image", "video"],
				validateActiveReferences: (references) => {
					const hasMaxIssue = validateReferenceAssetsByLimits(
						modeConfig,
						references.map((reference) => ({ assetType: reference.kind })),
					).some((issue) => issue.rule === "max" && issue.reason !== "variant")
					return hasMaxIssue ? "over-limit" : null
				},
			},
		})

		expect(result.map((item) => item.status)).toEqual(["active", "active"])
	})

	it("keeps source crop on active linked media", () => {
		const sourceCrop = {
			x: 10,
			y: 20,
			width: 300,
			height: 200,
		}

		expect(
			resolveLinkedMediaItems([{ ...imageCandidate, sourceCrop }], {
				targetKind: "image",
				mediaPolicy: {
					supportedKinds: ["image"],
					maxTotalCount: 1,
				},
			}),
		).toEqual([expect.objectContaining({ status: "active", sourceCrop })])
	})

	it("keeps manual references before linked media when enforcing total limits", () => {
		expect(
			resolveLinkedMediaItems([imageCandidate], {
				targetKind: "image",
				mediaPolicy: {
					supportedKinds: ["image"],
					manualReferences: [{ kind: "image", path: "/images/manual.png" }],
					maxTotalCount: 1,
				},
			}),
		).toEqual([expect.objectContaining({ status: "inactive", reason: "over-limit" })])
	})

	it("normalizes only host-proven current-canvas aliases", () => {
		expect(
			getLinkedMediaReferenceIdentity("./images/source.png", resolveDesignAResourceReference),
		).toBe("workspace:/画布A/images/source.png")
		expect(
			mergeLinkedMediaPathsWithResolver(
				resolveDesignAResourceReference,
				["./images/source.png"],
				["/画布A/images/source.png"],
			),
		).toEqual(["./images/source.png"])
	})

	it("keeps workspace-root and current-canvas linked media separate with host identity", () => {
		expect(
			mergeLinkedMediaPathsWithResolver(
				resolveDesignAResourceReference,
				["./images/source.png"],
				["/images/source.png"],
			),
		).toEqual(["./images/source.png", "/images/source.png"])
		expect(
			mergeLinkedMediaPathsWithResolver(
				resolveDesignAResourceReference,
				["./images/source.png"],
				["/画布A/images/source.png"],
			),
		).toEqual(["./images/source.png"])
	})

	it("marks duplicate linked media as inactive", () => {
		expect(
			resolveLinkedMediaItems([imageCandidate], {
				targetKind: "image",
				mediaPolicy: {
					supportedKinds: ["image"],
					manualReferences: [{ kind: "image", path: "/images/source.png" }],
					maxTotalCount: 2,
				},
			}),
		).toEqual([expect.objectContaining({ status: "inactive", reason: "duplicate" })])
	})

	it("marks video sources as unsupported for image targets", () => {
		expect(
			resolveLinkedMediaItems(
				[
					{
						connectionId: "connection-video",
						sourceElementId: "video-source",
						kind: "video",
						path: "/videos/source.mp4",
					},
				],
				{
					targetKind: "image",
					mediaPolicy: {
						supportedKinds: ["image"],
						maxTotalCount: 1,
					},
				},
			),
		).toEqual([expect.objectContaining({ status: "inactive", reason: "unsupported-type" })])
	})

	it("marks unsupported current model or mode media as inactive", () => {
		expect(
			resolveLinkedMediaItems([imageCandidate], {
				targetKind: "video",
				mediaPolicy: {
					supportedKinds: ["video"],
					maxTotalCount: 1,
				},
			}),
		).toEqual([expect.objectContaining({ status: "inactive", reason: "unsupported-mode" })])
	})

	it("marks sources without a resource path as inactive", () => {
		expect(
			resolveLinkedMediaItems([{ ...imageCandidate, path: undefined }], {
				targetKind: "image",
				mediaPolicy: {
					supportedKinds: ["image"],
					maxTotalCount: 1,
				},
			}),
		).toEqual([expect.objectContaining({ status: "inactive", reason: "missing-resource" })])
	})

	it("enforces per-kind limits after manual references", () => {
		expect(
			resolveLinkedMediaItems([imageCandidate], {
				targetKind: "video",
				mediaPolicy: {
					supportedKinds: ["image", "video"],
					manualReferences: [{ kind: "image", path: "/images/manual.png" }],
					maxTotalCount: 3,
					maxCountByKind: { image: 1 },
				},
			}),
		).toEqual([expect.objectContaining({ status: "inactive", reason: "over-limit" })])
	})

	it("uses dynamic policy validation before accepting linked media", () => {
		expect(
			resolveLinkedMediaItems([imageCandidate], {
				targetKind: "video",
				mediaPolicy: {
					supportedKinds: ["image"],
					maxTotalCount: 2,
					validateActiveReferences: (references) =>
						references.length > 0 ? "over-limit" : null,
				},
			}),
		).toEqual([expect.objectContaining({ status: "inactive", reason: "over-limit" })])
	})
})

describe("mergeLinkedMediaReferences", () => {
	it("keeps manual references first and appends non-duplicate linked references", () => {
		expect(
			mergeLinkedMediaReferences(
				[{ kind: "image", path: "/images/manual.png" }],
				[
					{ kind: "image", path: "/images/manual.png" },
					{ kind: "video", path: "/videos/linked.mp4" },
				],
			),
		).toEqual([
			{ kind: "image", path: "/images/manual.png" },
			{ kind: "video", path: "/videos/linked.mp4" },
		])
	})

	it("prefers linked metadata when manual and linked references share a path", () => {
		const sourceCrop = { x: 1, y: 2, width: 300, height: 200 }
		expect(
			mergeLinkedMediaReferences(
				[{ kind: "image", path: "./images/source.png" }],
				[{ kind: "image", path: "/画布A/images/source.png", sourceCrop }],
				resolveDesignAResourceReference,
			),
		).toEqual([{ kind: "image", path: "/画布A/images/source.png", sourceCrop }])
	})
})

describe("dedupeLinkedMediaItemsByPath", () => {
	it("shows one item per resource and keeps the selected connection", () => {
		const items = dedupeLinkedMediaItemsByPath(
			[
				{
					connectionId: "connection-1",
					sourceElementId: "source-1",
					kind: "image",
					path: "./images/shared.png",
					status: "inactive",
					selected: false,
				},
				{
					connectionId: "connection-2",
					sourceElementId: "source-2",
					kind: "image",
					path: "/画布A/images/shared.png",
					status: "active",
					selected: true,
				},
			],
			resolveDesignAResourceReference,
		)

		expect(items).toHaveLength(1)
		expect(items[0]).toEqual(expect.objectContaining({ connectionId: "connection-2" }))
	})
})

describe("resolveLinkedMediaDisplay", () => {
	it("hides media rejected by the existing type or mode policy", () => {
		const unsupportedItems = [
			{
				connectionId: "unsupported-type",
				sourceElementId: "video-source",
				kind: "video" as const,
				path: "/videos/source.mp4",
				status: "inactive" as const,
				reason: "unsupported-type" as const,
			},
			{
				connectionId: "unsupported-mode",
				sourceElementId: "audio-source",
				kind: "audio" as const,
				path: "/audios/source.mp3",
				status: "inactive" as const,
				reason: "unsupported-mode" as const,
			},
		]

		expect(resolveLinkedMediaDisplay([], () => "", unsupportedItems)).toEqual({
			manualItems: [],
			linkedItems: [],
		})
	})

	it("uses the linked card as the single display item for a manually mentioned resource", () => {
		const linkedItem = {
			connectionId: "connection-image",
			sourceElementId: "image-source",
			kind: "image" as const,
			path: "/画布A/images/shared.png",
			status: "inactive" as const,
			selected: false,
		}
		const result = resolveLinkedMediaDisplay(
			[{ path: "./images/shared.png", fileName: "shared.png" }],
			(item) => item.path,
			[linkedItem],
			resolveDesignAResourceReference,
		)

		expect(result.manualItems).toEqual([])
		expect(result.linkedItems).toEqual([linkedItem])
	})
})

describe("resolveLinkedMediaSelectionDisplay", () => {
	it("keeps a mentioned linked resource checked but allows removing it", () => {
		expect(
			resolveLinkedMediaSelectionDisplay({
				selected: true,
				selectionDisabledReason: "duplicate",
			}),
		).toEqual({ checked: true, disabled: false })
	})

	it("still disables an unavailable unselected resource", () => {
		expect(
			resolveLinkedMediaSelectionDisplay({
				selected: false,
				selectionDisabledReason: "over-limit",
			}),
		).toEqual({ checked: false, disabled: true })
	})
})

describe("resolveLinkedMediaAssociation", () => {
	it("derives candidate selection from canonical mention paths", () => {
		const result = resolveLinkedMediaAssociation({
			candidates: [
				{
					connectionId: "connection-image",
					sourceElementId: "image-source",
					kind: "image",
					path: "./images/source.png",
				},
			],
			mentionedPaths: ["/画布A/images/source.png"],
			targetKind: "image",
			mediaPolicy: { supportedKinds: ["image"] },
			resolveResourceReference: resolveDesignAResourceReference,
		})

		expect(result.items[0]?.selected).toBe(true)
		expect(result.activeMediaReferences).toEqual([
			{ kind: "image", path: "./images/source.png", sourceCrop: undefined },
		])
	})

	it("keeps unmatched manual references as ordinary active media", () => {
		const result = resolveLinkedMediaAssociation({
			candidates: [],
			mentionedPaths: ["./images/manual.png"],
			manualReferences: [{ kind: "image", path: "/images/manual.png" }],
			targetKind: "image",
			mediaPolicy: { supportedKinds: ["image"] },
		})

		expect(result.items).toEqual([])
		expect(result.unmatchedManualReferences).toEqual([
			{ kind: "image", path: "/images/manual.png" },
		])
		expect(result.activeMediaReferences).toEqual([
			{ kind: "image", path: "/images/manual.png" },
		])
	})

	it("keeps one stable candidate for duplicate canonical paths", () => {
		const result = resolveLinkedMediaAssociation({
			candidates: [
				{
					connectionId: "connection-first",
					sourceElementId: "image-first",
					kind: "image",
					path: "./images/source.png",
				},
				{
					connectionId: "connection-second",
					sourceElementId: "image-second",
					kind: "image",
					path: "/画布A/images/source.png",
				},
			],
			mentionedPaths: ["/画布A/images/source.png"],
			targetKind: "image",
			mediaPolicy: { supportedKinds: ["image"] },
			resolveResourceReference: resolveDesignAResourceReference,
		})

		expect(result.items).toHaveLength(1)
		expect(result.items[0]).toEqual(
			expect.objectContaining({ connectionId: "connection-first", selected: true }),
		)
	})

	it("keeps a mentioned candidate checked when media policy makes it inactive", () => {
		const result = resolveLinkedMediaAssociation({
			candidates: [
				{
					connectionId: "connection-image",
					sourceElementId: "image-source",
					kind: "image",
					path: "./images/source.png",
				},
			],
			mentionedPaths: ["/画布A/images/source.png"],
			targetKind: "video",
			mediaPolicy: { supportedKinds: ["video"] },
			resolveResourceReference: resolveDesignAResourceReference,
		})

		expect(result.items[0]).toEqual(
			expect.objectContaining({
				selected: true,
				status: "inactive",
				reason: "unsupported-mode",
				selectionDisabledReason: undefined,
			}),
		)
		expect(result.activeMediaReferences).toEqual([])
	})

	it("derives every checkbox from mentions while limits only constrain active media", () => {
		const result = resolveLinkedMediaAssociation({
			candidates: [
				{
					connectionId: "connection-first",
					sourceElementId: "image-first",
					kind: "image",
					path: "./images/first.png",
				},
				{
					connectionId: "connection-second",
					sourceElementId: "image-second",
					kind: "image",
					path: "./images/second.png",
				},
			],
			mentionedPaths: ["/画布A/images/first.png", "/画布A/images/second.png"],
			targetKind: "image",
			mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
			resolveResourceReference: resolveDesignAResourceReference,
		})

		expect(result.items).toEqual([
			expect.objectContaining({ connectionId: "connection-first", selected: true }),
			expect.objectContaining({
				connectionId: "connection-second",
				selected: true,
				status: "inactive",
				selectionDisabledReason: undefined,
			}),
		])
		expect(result.activeMediaReferences).toEqual([
			{ kind: "image", path: "./images/first.png", sourceCrop: undefined },
		])
	})

	it("allows a linked candidate to replace a same-path manual reference when checked", () => {
		const associationOptions = {
			candidates: [
				{
					connectionId: "connection-image",
					sourceElementId: "image-source",
					kind: "image",
					path: "./images/source.png",
					sourceCrop: { x: 1, y: 2, width: 100, height: 80 },
				},
			],
			targetKind: "image",
			mediaPolicy: {
				supportedKinds: ["image"],
				manualReferences: [{ kind: "image", path: "/画布A/images/source.png" }],
				maxTotalCount: 1,
			},
			resolveResourceReference: resolveDesignAResourceReference,
		} satisfies Omit<ResolveLinkedMediaAssociationOptions, "mentionedPaths">
		const result = resolveLinkedMediaAssociation({
			...associationOptions,
			mentionedPaths: [],
		})

		expect(result.items[0]).toEqual(
			expect.objectContaining({
				selected: false,
				status: "inactive",
				selectionDisabledReason: undefined,
			}),
		)

		const checkedResult = resolveLinkedMediaAssociation({
			...associationOptions,
			mentionedPaths: ["/画布A/images/source.png"],
		})
		expect(checkedResult.items[0]?.selected).toBe(true)
		expect(checkedResult.activeMediaReferences).toEqual([
			{
				kind: "image",
				path: "./images/source.png",
				sourceCrop: { x: 1, y: 2, width: 100, height: 80 },
			},
		])
	})

	it("keeps a same-path manual reference active while the linked candidate is unchecked", () => {
		const result = resolveLinkedMediaAssociation({
			candidates: [
				{
					connectionId: "connection-image",
					sourceElementId: "image-source",
					kind: "image",
					path: "./images/source.png",
					sourceCrop: { x: 1, y: 2, width: 100, height: 80 },
				},
			],
			mentionedPaths: [],
			manualReferences: [{ kind: "image", path: "/画布A/images/source.png" }],
			targetKind: "image",
			mediaPolicy: {
				supportedKinds: ["image"],
				maxTotalCount: 1,
			},
			resolveResourceReference: resolveDesignAResourceReference,
		})

		expect(result.items[0]).toEqual(
			expect.objectContaining({
				selected: false,
				status: "inactive",
				selectionDisabledReason: undefined,
			}),
		)
		expect(result.activeMediaReferences).toEqual([
			{ kind: "image", path: "/画布A/images/source.png" },
		])
	})
})

describe("resolveLinkedMediaPolicySelection", () => {
	const firstImageCandidate: LinkedEditorMediaCandidate = {
		connectionId: "connection-image-1",
		sourceElementId: "image-source-1",
		kind: "image",
		path: "/images/source-1.png",
		fileName: "source-1.png",
	}
	const secondImageCandidate: LinkedEditorMediaCandidate = {
		connectionId: "connection-image-2",
		sourceElementId: "image-source-2",
		kind: "image",
		path: "/images/source-2.png",
		fileName: "source-2.png",
	}

	it("keeps linked media unselected by default", () => {
		const result = resolveLinkedMediaPolicySelection([firstImageCandidate], [], {
			targetKind: "image",
			mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
		})

		expect(result.items).toEqual([
			expect.objectContaining({ selected: false, status: "inactive" }),
		])
		expect(result.activeMediaReferences).toEqual([])
	})

	it("keeps every candidate selectable while no media has been selected", () => {
		const result = resolveLinkedMediaPolicySelection(
			[firstImageCandidate, secondImageCandidate],
			[],
			{
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
			},
		)

		expect(result.items).toEqual([
			expect.objectContaining({
				connectionId: firstImageCandidate.connectionId,
				selected: false,
				selectionDisabledReason: undefined,
			}),
			expect.objectContaining({
				connectionId: secondImageCandidate.connectionId,
				selected: false,
				selectionDisabledReason: undefined,
			}),
		])
	})

	it("only includes media selected by the user", () => {
		const result = resolveLinkedMediaPolicySelection(
			[firstImageCandidate, secondImageCandidate],
			[secondImageCandidate.connectionId],
			{
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
			},
		)

		expect(result.items).toEqual([
			expect.objectContaining({
				connectionId: firstImageCandidate.connectionId,
				selected: false,
				selectionDisabledReason: "over-limit",
			}),
			expect.objectContaining({
				connectionId: secondImageCandidate.connectionId,
				selected: true,
				status: "active",
			}),
		])
		expect(result.activeMediaReferences).toEqual([
			{ kind: "image", path: secondImageCandidate.path, sourceCrop: undefined },
		])
	})

	it("keeps a selected linked resource active when it is also manually mentioned", () => {
		const sourceCrop = { x: 4, y: 8, width: 200, height: 120 }
		const canvasAbsoluteCandidate = {
			...firstImageCandidate,
			path: "/画布A/images/source-1.png",
			sourceCrop,
		}
		const result = resolveLinkedMediaPolicySelection(
			[canvasAbsoluteCandidate],
			[firstImageCandidate.connectionId],
			{
				targetKind: "image",
				mediaPolicy: {
					supportedKinds: ["image"],
					manualReferences: [{ kind: "image", path: "./images/source-1.png" }],
					maxTotalCount: 1,
				},
				resolveResourceReference: resolveDesignAResourceReference,
			},
		)

		expect(result.items).toEqual([
			expect.objectContaining({
				selected: true,
				status: "active",
				sourceCrop,
			}),
		])
		expect(result.activeMediaReferences).toEqual([
			{ kind: "image", path: canvasAbsoluteCandidate.path, sourceCrop },
		])
	})

	it("keeps workspace-root and current-canvas candidates separately selected", () => {
		const workspaceRootCandidate: LinkedEditorMediaCandidate = {
			...firstImageCandidate,
			path: "/images/shared.png",
		}
		const currentCanvasCandidate: LinkedEditorMediaCandidate = {
			...secondImageCandidate,
			path: "./images/shared.png",
		}
		const result = resolveLinkedMediaPolicySelection(
			[workspaceRootCandidate, currentCanvasCandidate],
			[workspaceRootCandidate.connectionId, currentCanvasCandidate.connectionId],
			{
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 2 },
				resolveResourceReference: resolveDesignAResourceReference,
			},
		)

		expect(result.items).toEqual([
			expect.objectContaining({
				connectionId: workspaceRootCandidate.connectionId,
				selected: true,
				status: "active",
			}),
			expect.objectContaining({
				connectionId: currentCanvasCandidate.connectionId,
				selected: true,
				status: "active",
			}),
		])
		expect(result.activeMediaReferences).toEqual([
			{ kind: "image", path: "/images/shared.png", sourceCrop: undefined },
			{ kind: "image", path: "./images/shared.png", sourceCrop: undefined },
		])
	})

	it("still deduplicates host-equivalent canvas paths", () => {
		const canvasAbsoluteCandidate: LinkedEditorMediaCandidate = {
			...firstImageCandidate,
			path: "/画布A/images/shared.png",
		}
		const currentCanvasCandidate: LinkedEditorMediaCandidate = {
			...secondImageCandidate,
			path: "./images/shared.png",
		}
		const result = resolveLinkedMediaPolicySelection(
			[canvasAbsoluteCandidate, currentCanvasCandidate],
			[canvasAbsoluteCandidate.connectionId, currentCanvasCandidate.connectionId],
			{
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 2 },
				resolveResourceReference: resolveDesignAResourceReference,
			},
		)

		expect(result.items).toEqual([
			expect.objectContaining({
				connectionId: canvasAbsoluteCandidate.connectionId,
				selected: true,
				status: "active",
			}),
			expect.objectContaining({
				connectionId: currentCanvasCandidate.connectionId,
				selected: false,
				selectionDisabledReason: "duplicate",
			}),
		])
		expect(result.activeMediaReferences).toEqual([
			{ kind: "image", path: "/画布A/images/shared.png", sourceCrop: undefined },
		])
	})

	it("restores a retained selection after the media kind becomes supported again", () => {
		const mentionedConnectionIds = [firstImageCandidate.connectionId]
		const unsupportedResult = resolveLinkedMediaPolicySelection(
			[firstImageCandidate],
			mentionedConnectionIds,
			{
				targetKind: "video",
				mediaPolicy: { supportedKinds: ["video"] },
			},
		)

		expect(unsupportedResult.activeMediaReferences).toEqual([])

		const restoredResult = resolveLinkedMediaPolicySelection(
			[firstImageCandidate],
			mentionedConnectionIds,
			{
				targetKind: "video",
				mediaPolicy: { supportedKinds: ["image"] },
			},
		)

		expect(restoredResult.items).toEqual([
			expect.objectContaining({ selected: true, status: "active" }),
		])
		expect(restoredResult.activeMediaReferences).toEqual([
			{ kind: "image", path: firstImageCandidate.path, sourceCrop: undefined },
		])
	})
})
