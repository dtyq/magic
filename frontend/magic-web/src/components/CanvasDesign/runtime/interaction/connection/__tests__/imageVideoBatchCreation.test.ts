import { afterEach, describe, expect, it, vi } from "vitest"
import type { VideoModelItem } from "../../../../public/magic-types"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum } from "../../../document/types"
import type { SelectionContentSnapshot } from "../../selection/selectionContentCollector"
import {
	canCreateBatchImageVideos,
	createBatchImageVideos,
	createStoryboardVideosFromConnection,
} from "../imageVideoBatchCreation"

const referenceModel: VideoModelItem = {
	id: "model-1",
	group_id: "group-1",
	model_id: "model-1",
	model_name: "Reference",
	provider_model_id: "provider-model-1",
	model_description: "",
	model_icon: "",
	model_status: "normal",
	sort: 0,
	video_generation_config: {
		input_modes: {
			image_reference: {
				supported_fields: ["reference_images"],
				reference_images: { max_count: 4 },
			},
		},
	},
}

const standardOnlyModel: VideoModelItem = {
	...referenceModel,
	model_id: "standard-only",
	video_generation_config: {
		input_modes: {
			standard: { supported_fields: [] },
		},
	},
}

function createSnapshot(
	overrides: Partial<SelectionContentSnapshot> = {},
): SelectionContentSnapshot {
	return {
		rootElementIds: ["image-1", "image-2"],
		items: [],
		imageSequence: ["image-1", "image-2"],
		videoSequence: [],
		mainVideoSequence: [],
		audioSequence: [],
		counts: { image: 2, video: 0, audio: 0, text: 0 },
		boundingRect: { x: 0, y: 0, width: 400, height: 300 },
		selectionRevision: "image-1\u0000image-2",
		allRootsCanConnect: true,
		...overrides,
	}
}

function createBatchCanvas(
	connectionStatus: "created" | "invalid",
	options?: {
		imageBounds?: Record<string, { x: number; y: number; width: number; height: number }>
	},
) {
	let videoSeq = 0
	const createdVideoIds: string[] = []
	const createVideoAtCanvasPoint = vi.fn(() => {
		videoSeq += 1
		const id = `video-${videoSeq}`
		createdVideoIds.push(id)
		return id
	})
	const remove = vi.fn((elementId: string) => {
		const index = createdVideoIds.indexOf(elementId)
		if (index >= 0) createdVideoIds.splice(index, 1)
	})
	const connectElementsBatch = vi.fn(({ edges }) =>
		connectionStatus === "created"
			? {
					status: "created" as const,
					connectionIds: edges.map((_: unknown, index: number) => `c-${index}`),
				}
			: { status: "invalid" as const, reason: "already-connected" as const },
	)
	const register = vi.fn()
	const selectMultiple = vi.fn()
	const getElementBounds = vi.fn((elementId: string) => {
		if (elementId === "frame-1") {
			return { x: 10, y: 20, width: 300, height: 400 }
		}
		const configuredBounds = options?.imageBounds?.[elementId]
		if (configuredBounds) return configuredBounds
		const index = elementId === "image-2" ? 1 : 0
		return { x: 0, y: index * 200, width: 160, height: 160 }
	})

	const canvas = {
		t: vi.fn((key: string, fallback: string) => fallback),
		historyManager: {
			runTransaction: vi.fn((callback: () => unknown) => callback()),
		},
		elementManager: {
			hasElement: vi.fn((elementId: string) =>
				["image-1", "image-2", "image-3", "frame-1", ...createdVideoIds].includes(
					elementId,
				),
			),
			delete: remove,
			getAllElementIds: vi.fn(() => ["image-1", "image-2", "image-3", "frame-1"]),
			isElementVisibleInDataTree: vi.fn(() => true),
			getElementInstance: vi.fn(() => null),
			getElementData: vi.fn((elementId: string) => {
				if (elementId === "frame-1") {
					return {
						id: "frame-1",
						type: ElementTypeEnum.Frame,
						x: 10,
						y: 20,
						width: 300,
						height: 400,
						children: [],
					}
				}
				return {
					id: elementId,
					type: ElementTypeEnum.Image,
					x: 0,
					y: 0,
					width: 160,
					height: 160,
				}
			}),
			getAllElements: vi.fn(() => []),
			getNextZIndexInLevel: vi.fn(() => 5),
			create: vi.fn((element: { id: string; children?: Array<{ id: string }> }) => {
				createdVideoIds.push(element.id)
				for (const child of element.children ?? []) createdVideoIds.push(child.id)
				return { elementId: element.id, element }
			}),
		},
		connectionManager: {
			connectElementsBatch,
			getDownstreamConnections: vi.fn(() => []),
			getUpstreamConnections: vi.fn(() => []),
		},
		toolManager: {
			switchToSelection: vi.fn(),
			getVideoGeneratorTool: vi.fn(() => ({
				getVideoElementSizeForModelList: vi.fn(() => ({ width: 320, height: 180 })),
				createVideoAtCanvasPoint,
			})),
		},
		selectionManager: {
			select: vi.fn(),
			selectMultiple,
		},
		viewportController: {
			isElementInViewport: vi.fn(() => true),
			moveElementToViewport: vi.fn(),
		},
		geometryCacheManager: { getElementBounds },
		connectionAssociationSeedManager: { register },
		magicConfigManager: {
			config: {
				methods: {
					getRootStorage: vi.fn(() => ({
						defaultGenerateVideoConfig: { model_id: "model-1" },
					})),
				},
			},
		},
	} as unknown as Canvas

	return {
		canvas,
		createVideoAtCanvasPoint,
		remove,
		connectElementsBatch,
		register,
		selectMultiple,
		createdVideoIds,
	}
}

vi.mock("../../selection/selectionContentCollector", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../../selection/selectionContentCollector")>()
	return {
		...actual,
		collectSelectionContentSnapshot: vi.fn(actual.collectSelectionContentSnapshot),
	}
})

describe("imageVideoBatchCreation", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("creates one video per image and registers association seeds", () => {
		const { canvas, createVideoAtCanvasPoint, connectElementsBatch, register, selectMultiple } =
			createBatchCanvas("created")

		const created = createBatchImageVideos({
			canvas,
			snapshot: createSnapshot(),
			videoModelList: [referenceModel],
		})

		expect(created).toHaveLength(2)
		expect(createVideoAtCanvasPoint).toHaveBeenCalledTimes(2)
		expect(connectElementsBatch).toHaveBeenCalledWith({
			edges: [
				{ sourceElementId: "image-1", targetElementId: "video-1" },
				{ sourceElementId: "image-2", targetElementId: "video-2" },
			],
		})
		expect(register).toHaveBeenCalledTimes(2)
		expect(selectMultiple).toHaveBeenCalledWith(["video-1", "video-2"])
	})

	it("rolls back created videos when the connection batch is rejected", () => {
		const { canvas, remove, register, selectMultiple, createdVideoIds } =
			createBatchCanvas("invalid")

		const created = createBatchImageVideos({
			canvas,
			snapshot: createSnapshot(),
			videoModelList: [referenceModel],
		})

		expect(created).toEqual([])
		expect(remove).toHaveBeenCalledWith("video-1")
		expect(remove).toHaveBeenCalledWith("video-2")
		expect(createdVideoIds).toEqual([])
		expect(register).not.toHaveBeenCalled()
		expect(selectMultiple).not.toHaveBeenCalled()
	})

	it("does nothing when the default video model cannot take reference images", () => {
		const { canvas, createVideoAtCanvasPoint } = createBatchCanvas("created")

		expect(canCreateBatchImageVideos(canvas, createSnapshot(), [standardOnlyModel])).toBe(false)
		expect(
			createBatchImageVideos({
				canvas,
				snapshot: createSnapshot(),
				videoModelList: [standardOnlyModel],
			}),
		).toEqual([])
		expect(createVideoAtCanvasPoint).not.toHaveBeenCalled()
	})

	it("creates a storyboard video frame from a frame origin and reconnects images", async () => {
		const { collectSelectionContentSnapshot } =
			await import("../../selection/selectionContentCollector")
		const { canvas, connectElementsBatch, register } = createBatchCanvas("created")
		vi.mocked(collectSelectionContentSnapshot).mockReturnValue(
			createSnapshot({
				rootElementIds: ["frame-1"],
				imageSequence: ["image-1", "image-2"],
				selectionRevision: "frame-1",
			}),
		)

		const frameId = createStoryboardVideosFromConnection({
			canvas,
			origin: { kind: "element", elementId: "frame-1", side: "right" },
			videoModelList: [referenceModel],
		})

		expect(frameId).toEqual(expect.any(String))
		expect(canvas.elementManager.create).toHaveBeenCalledWith(
			expect.objectContaining({
				id: frameId,
				type: ElementTypeEnum.Frame,
				name: "分镜视频组合",
				x: 1334,
				y: -11,
				width: 372,
				height: 462,
				children: expect.arrayContaining([
					expect.objectContaining({ type: ElementTypeEnum.Video }),
					expect.objectContaining({ type: ElementTypeEnum.Video }),
				]),
			}),
		)
		expect(connectElementsBatch).toHaveBeenCalledWith({
			edges: expect.arrayContaining([
				expect.objectContaining({ sourceElementId: "image-1" }),
				expect.objectContaining({ sourceElementId: "image-2" }),
			]),
		})
		expect(register).toHaveBeenCalledTimes(2)
	})

	it("re-collects frame images at click time instead of trusting the menu-open snapshot", async () => {
		const { collectSelectionContentSnapshot } =
			await import("../../selection/selectionContentCollector")
		const { canvas, connectElementsBatch } = createBatchCanvas("created")
		vi.mocked(collectSelectionContentSnapshot).mockImplementation(() =>
			createSnapshot({
				rootElementIds: ["frame-1"],
				imageSequence: ["image-1", "image-3"],
				selectionRevision: "frame-1",
			}),
		)

		createStoryboardVideosFromConnection({
			canvas,
			origin: { kind: "element", elementId: "frame-1", side: "right" },
			videoModelList: [referenceModel],
		})

		expect(collectSelectionContentSnapshot).toHaveBeenCalledWith(canvas, ["frame-1"])
		expect(connectElementsBatch).toHaveBeenCalledWith({
			edges: [
				expect.objectContaining({ sourceElementId: "image-1" }),
				expect.objectContaining({ sourceElementId: "image-3" }),
			],
		})
	})

	it("orders storyboard video children by source visual position to avoid crossed connections", async () => {
		const { collectSelectionContentSnapshot } =
			await import("../../selection/selectionContentCollector")
		const { canvas, connectElementsBatch } = createBatchCanvas("created", {
			imageBounds: {
				"image-1": { x: 0, y: 300, width: 160, height: 160 },
				"image-2": { x: 0, y: 0, width: 160, height: 160 },
			},
		})
		vi.mocked(collectSelectionContentSnapshot).mockReturnValue(
			createSnapshot({
				rootElementIds: ["frame-1"],
				imageSequence: ["image-1", "image-2"],
				selectionRevision: "frame-1",
			}),
		)

		const frameId = createStoryboardVideosFromConnection({
			canvas,
			origin: { kind: "element", elementId: "frame-1", side: "right" },
			videoModelList: [referenceModel],
		})

		expect(frameId).toEqual(expect.any(String))
		const createdFrame = vi.mocked(canvas.elementManager.create).mock.calls[0]?.[0] as {
			children?: Array<{ id: string; y?: number }>
		}
		expect(createdFrame.children?.[0]?.y).toBeLessThan(createdFrame.children?.[1]?.y ?? 0)
		expect(connectElementsBatch).toHaveBeenCalledWith({
			edges: [
				{ sourceElementId: "image-2", targetElementId: expect.any(String) },
				{ sourceElementId: "image-1", targetElementId: expect.any(String) },
			],
		})
	})

	it("rolls back the storyboard frame when image connections fail", async () => {
		const { collectSelectionContentSnapshot } =
			await import("../../selection/selectionContentCollector")
		const { canvas, remove, register } = createBatchCanvas("invalid")
		vi.mocked(collectSelectionContentSnapshot).mockReturnValue(
			createSnapshot({
				rootElementIds: ["frame-1"],
				imageSequence: ["image-1", "image-2"],
				selectionRevision: "frame-1",
			}),
		)

		const frameId = createStoryboardVideosFromConnection({
			canvas,
			origin: { kind: "element", elementId: "frame-1", side: "right" },
			videoModelList: [referenceModel],
		})

		expect(frameId).toBeNull()
		expect(remove).toHaveBeenCalledWith(expect.any(String))
		expect(register).not.toHaveBeenCalled()
	})
})
