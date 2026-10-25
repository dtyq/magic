import { describe, expect, it, vi } from "vitest"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import { ElementTypeEnum, type LayerElement } from "../../../document/types"
import {
	collectCanvasAssetIds,
	findCanvasAssetMediaBinding,
	findCanvasWorkspaceMediaFile,
} from "../assetMediaBinding"

function createCanvas(
	elements: LayerElement[],
	pendingPaths: string[] = [],
	resolverOptions: {
		attachmentPathsByFileId?: Record<string, string>
		attachmentsReady?: boolean
	} = {},
) {
	const elementsById = new Map(elements.map((element) => [element.id, element]))
	return {
		elementManager: {
			getAllElementIds: () => [...elementsById.keys()],
			getElementData: (elementId: string) => elementsById.get(elementId),
		},
		canvasFileUploadManager: {
			isPendingResourcePath: vi.fn((path: string) => pendingPaths.includes(path)),
		},
		magicConfigManager: {
			config: {
				methods: {
					resolveResourceReference: createTestResourceReferenceResolver({
						attachmentPathsByFileId: resolverOptions.attachmentPathsByFileId ?? {
							image: "./images/active.png",
							main: "./images/main.png",
							video: "./videos/reference.mp4",
						},
						attachmentsReady: resolverOptions.attachmentsReady ?? true,
					}),
				},
			},
		},
	}
}

describe("findCanvasAssetMediaBinding", () => {
	it("collects explicit and legacy asset ids from nested media elements", () => {
		const document = {
			elements: [
				{
					id: "image-1",
					type: ElementTypeEnum.Image,
					contents: [
						{ contentId: "image-content", src: "./images/a.png", assetId: " 100 " },
						{ contentId: "legacy-content", src: "asset://200" },
					],
					children: [
						{
							id: "video-1",
							type: ElementTypeEnum.Video,
							contents: [{ contentId: "video-content", src: "asset://300" }],
						},
					],
				},
			],
		} as never

		expect(collectCanvasAssetIds(document)).toEqual(["100", "200", "300"])
	})

	it("prefers active, then main, then historical Contents", () => {
		const canvas = createCanvas([
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				width: 640,
				height: 360,
				activeContentId: "active",
				mainContentId: "main",
				contents: [
					{ contentId: "history", src: "./images/main.png", assetId: "asset-1" },
					{ contentId: "main", src: "./images/main.png", assetId: "asset-1" },
					{ contentId: "active", src: "./images/active.png", assetId: "asset-1" },
				],
			},
		] as LayerElement[])

		expect(
			findCanvasAssetMediaBinding(canvas as never, {
				assetId: "asset-1",
				allowedMediaTypes: ["image"],
			}),
		).toMatchObject({
			workspacePath: "./images/active.png",
			contentId: "active",
			dimensions: { width: 640, height: 360 },
		})
	})

	it("scans nested runtime elements and accepts registered pending paths", () => {
		const canvas = createCanvas(
			[
				{
					id: "nested-audio",
					type: ElementTypeEnum.Audio,
					activeContentId: "audio-content",
					mainContentId: "audio-content",
					contents: [
						{
							contentId: "audio-content",
							src: "./audios/pending.mp3",
							assetId: "asset-audio",
						},
					],
				},
			] as LayerElement[],
			["./audios/pending.mp3"],
		)

		expect(
			findCanvasAssetMediaBinding(canvas as never, {
				assetId: "asset-audio",
				allowedMediaTypes: ["audio"],
			}),
		).toMatchObject({ mediaType: "audio", workspacePath: "./audios/pending.mp3" })
	})

	it("rejects legacy asset URIs, external URLs, missing files and disallowed types", () => {
		const canvas = createCanvas([
			{
				id: "legacy-image",
				type: ElementTypeEnum.Image,
				activeContentId: "legacy",
				mainContentId: "legacy",
				contents: [{ contentId: "legacy", src: "asset://asset-1", assetId: "asset-1" }],
			},
			{
				id: "external-image",
				type: ElementTypeEnum.Image,
				activeContentId: "external",
				mainContentId: "external",
				contents: [
					{
						contentId: "external",
						src: "https://example.test/image.png",
						assetId: "asset-1",
					},
				],
			},
			{
				id: "missing-image",
				type: ElementTypeEnum.Image,
				activeContentId: "missing",
				mainContentId: "missing",
				contents: [
					{ contentId: "missing", src: "./images/missing.png", assetId: "asset-1" },
				],
			},
			{
				id: "video-1",
				type: ElementTypeEnum.Video,
				activeContentId: "video",
				mainContentId: "video",
				contents: [
					{ contentId: "video", src: "./videos/reference.mp4", assetId: "asset-1" },
				],
			},
		] as LayerElement[])

		expect(
			findCanvasAssetMediaBinding(canvas as never, {
				assetId: "asset-1",
				allowedMediaTypes: ["image"],
			}),
		).toBeNull()
	})

	it("reuses only a unique same-name file in the authoritative media directory", () => {
		const canvas = createCanvas([], [], {
			attachmentPathsByFileId: {
				image: "./images/portrait.png",
				wrongDirectory: "./videos/voice.mp3",
			},
		})

		expect(
			findCanvasWorkspaceMediaFile(canvas as never, {
				mediaType: "image",
				fileName: "portrait.png",
			}),
		).toEqual({
			mediaType: "image",
			workspacePath: "./images/portrait.png",
			fileName: "portrait.png",
		})
		expect(
			findCanvasWorkspaceMediaFile(canvas as never, {
				mediaType: "audio",
				fileName: "voice.mp3",
			}),
		).toBeNull()
	})

	it("does not reuse ambiguous, pending, or nested same-name candidates", () => {
		const ambiguousCanvas = createCanvas([], [], {
			attachmentPathsByFileId: {
				first: "./images/portrait.png",
				second: "./images/portrait.png",
			},
		})
		const pendingCanvas = createCanvas([], [], {
			attachmentPathsByFileId: {},
			attachmentsReady: false,
		})

		expect(
			findCanvasWorkspaceMediaFile(ambiguousCanvas as never, {
				mediaType: "image",
				fileName: "portrait.png",
			}),
		).toBeNull()
		expect(
			findCanvasWorkspaceMediaFile(pendingCanvas as never, {
				mediaType: "image",
				fileName: "portrait.png",
			}),
		).toBeNull()
		expect(
			findCanvasWorkspaceMediaFile(ambiguousCanvas as never, {
				mediaType: "image",
				fileName: "nested/portrait.png",
			}),
		).toBeNull()
	})
})
