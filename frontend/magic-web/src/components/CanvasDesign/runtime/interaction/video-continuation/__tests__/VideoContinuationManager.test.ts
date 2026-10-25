import { beforeEach, describe, expect, it, vi } from "vitest"
import type { VideoModelItem } from "../../../../public/magic-types"
import type { Canvas } from "../../../core/Canvas"
import { VideoElement } from "../../../elements/video/VideoElement"

const extractVideoTailFrame = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({
	loading: vi.fn(() => "toast-id"),
	dismiss: vi.fn(),
	success: vi.fn(),
	error: vi.fn(),
	warning: vi.fn(),
}))

vi.mock("../../../resources/video/VideoFrameExtractor", () => ({ extractVideoTailFrame }))
vi.mock("sonner", () => ({ toast }))

import { VideoContinuationManager } from "../VideoContinuationManager"

const model: VideoModelItem = {
	id: "model-1",
	group_id: "group-1",
	model_id: "model-1",
	model_name: "Keyframe",
	provider_model_id: "provider-model-1",
	model_description: "",
	model_icon: "",
	model_status: "normal",
	sort: 0,
	video_generation_config: {
		input_modes: {
			keyframe_guided: {
				supported_fields: ["frames"],
				frame_roles: ["start"],
			},
		},
	},
}

function sourceElement(id: string, path = `./videos/${id}.mp4`): Record<string, unknown> {
	return {
		id,
		type: "video",
		x: 0,
		y: 0,
		width: 320,
		height: 180,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content`, src: path, status: "completed" }],
	}
}

function createCanvas(
	sourceIds: string[],
	options: { createdVideoHasNoContent?: boolean } = {},
): {
	canvas: Canvas
	createdIds: string[]
	createdPoints: Array<{ x: number; y: number }>
	connectionManager: {
		connectElementsBatch: ReturnType<typeof vi.fn>
	}
	runTransaction: ReturnType<typeof vi.fn>
} {
	const elements = new Map(sourceIds.map((id) => [id, sourceElement(id, `./videos/${id}.mp4`)]))
	const instances = new Map<string, VideoElement>()
	const createdIds: string[] = []
	const createdPoints: Array<{ x: number; y: number }> = []
	let sequence = 0
	const eventEmitter = {
		on: vi.fn(() => vi.fn()),
	}
	const runTransaction = vi.fn(
		(callback: () => string[], shouldRecord?: (result: string[]) => boolean) => {
			const result = callback()
			shouldRecord?.(result)
			return result
		},
	)
	const connectionManager = {
		connectElementsBatch: vi.fn(
			({
				edges,
			}: {
				edges: Array<{ sourceElementId: string; targetElementId: string }>
			}) => ({
				status: "created" as const,
				connectionIds: edges.map((_, index) => `connection-${index + 1}`),
			}),
		),
		getDownstreamConnections: vi.fn(() => []),
		getUpstreamConnections: vi.fn(() => []),
	}
	const canvas = {
		id: "canvas-1",
		t: vi.fn((_key: string, fallback: string) => fallback),
		eventEmitter,
		magicConfigManager: {
			config: {
				methods: {
					getRootStorage: vi.fn(() => ({
						defaultGenerateVideoConfig: { model_id: model.model_id },
					})),
				},
			},
		},
		elementManager: {
			getElementData: vi.fn((id: string) => elements.get(id)),
			hasElement: vi.fn((id: string) => elements.has(id)),
			getAllElementIds: vi.fn(() => [...elements.keys()]),
			isElementVisibleInDataTree: vi.fn(() => true),
			getElementInstance: vi.fn((id: string) => instances.get(id)),
			delete: vi.fn((id: string) => elements.delete(id)),
		},
		videoResourceManager: {
			ensureFreshOssSrc: vi.fn(async (path: string) => `https://oss.test${path}`),
		},
		canvasFileUploadManager: {
			uploadDirect: vi.fn(async () => [{ path: "./images/tail-frame.jpg" }]),
		},
		connectionManager,
		toolManager: {
			getVideoGeneratorTool: vi.fn(() => ({
				getVideoElementSizeForModelList: vi.fn(() => ({ width: 320, height: 180 })),
				createVideoAtCanvasPoint: vi.fn((x: number, y: number) => {
					const id = `created-${++sequence}`
					elements.set(id, {
						id,
						type: "video",
						x: x - 160,
						y: y - 90,
						width: 320,
						height: 180,
						contents: options.createdVideoHasNoContent
							? []
							: [{ contentId: `${id}-content` }],
						activeContentId: options.createdVideoHasNoContent
							? undefined
							: `${id}-content`,
						mainContentId: options.createdVideoHasNoContent
							? undefined
							: `${id}-content`,
					})
					const instance = Object.create(VideoElement.prototype) as VideoElement
					instances.set(id, instance)
					createdIds.push(id)
					createdPoints.push({ x, y })
					return id
				}),
			})),
			switchToSelection: vi.fn(),
		},
		geometryCacheManager: {
			getElementBounds: vi.fn((id: string) => {
				const element = elements.get(id) as
					{ x: number; y: number; width: number; height: number } | undefined
				return element
					? { x: element.x, y: element.y, width: element.width, height: element.height }
					: null
			}),
		},
		mediaEditRecoveryManager: {
			saveDraft: vi.fn(),
			clear: vi.fn(),
			clearElement: vi.fn(),
			clearAll: vi.fn(),
		},
		historyManager: { runTransaction },
		selectionManager: {
			select: vi.fn(),
			selectMultiple: vi.fn(),
		},
		viewportController: {
			isElementInViewport: vi.fn(() => true),
			moveElementToViewport: vi.fn(),
		},
	} as unknown as Canvas

	return { canvas, createdIds, createdPoints, connectionManager, runTransaction }
}

describe("VideoContinuationManager", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		extractVideoTailFrame.mockResolvedValue({
			blob: new Blob(["tail"], { type: "image/jpeg" }),
			width: 1920,
			height: 1080,
		})
	})

	it("creates one empty video with a start-frame draft in one transaction", async () => {
		const { canvas, createdIds, createdPoints, connectionManager, runTransaction } =
			createCanvas(["video-1"])
		const manager = new VideoContinuationManager(canvas)

		const result = await manager.continueVideos({
			sourceVideoIds: ["video-1"],
			videoModelList: [model],
		})

		expect(result).toEqual({
			createdElementIds: ["created-1"],
			failedSourceIds: [],
			skippedSourceIds: [],
		})
		expect(runTransaction).toHaveBeenCalledTimes(1)
		expect(canvas.mediaEditRecoveryManager.saveDraft).toHaveBeenCalledWith(
			{
				elementId: "created-1",
				contentId: "created-1-content",
				intent: "generate",
			},
			"created-1-content:",
			{
				request: {
					model_id: "model-1",
					input_mode: "keyframe_guided",
					task: "generate",
					inputs: { frames: [{ role: "start", uri: "./images/tail-frame.jpg" }] },
				},
				modeDrafts: {},
			},
		)
		expect(createdIds).toEqual(["created-1"])
		expect(createdPoints).toEqual([{ x: 1504, y: 90 }])
		expect(connectionManager.connectElementsBatch).toHaveBeenCalledWith({
			edges: [{ sourceElementId: "video-1", targetElementId: "created-1" }],
		})
	})

	it("keeps successful sources when one tail-frame preparation fails", async () => {
		extractVideoTailFrame.mockImplementation(async (src: string) =>
			src.includes("video-1")
				? null
				: { blob: new Blob(["tail"], { type: "image/jpeg" }), width: 1, height: 1 },
		)
		const { canvas } = createCanvas(["video-1", "video-2"])
		const manager = new VideoContinuationManager(canvas)

		const result = await manager.continueVideos({
			sourceVideoIds: ["video-1", "video-2"],
			videoModelList: [model],
		})

		expect(result.createdElementIds).toHaveLength(1)
		expect(result.failedSourceIds).toEqual(["video-1"])
		expect(result.skippedSourceIds).toEqual([])
		expect(toast.warning).toHaveBeenCalled()
	})

	it("creates all successful videos and connects them in one batch", async () => {
		const { canvas, connectionManager, createdPoints } = createCanvas(["video-1", "video-2"])
		const manager = new VideoContinuationManager(canvas)

		const result = await manager.continueVideos({
			sourceVideoIds: ["video-1", "video-2"],
			videoModelList: [model],
		})

		expect(result.createdElementIds).toEqual(["created-1", "created-2"])
		expect(connectionManager.connectElementsBatch).toHaveBeenCalledTimes(1)
		expect(connectionManager.connectElementsBatch).toHaveBeenCalledWith({
			edges: [
				{ sourceElementId: "video-1", targetElementId: "created-1" },
				{ sourceElementId: "video-2", targetElementId: "created-2" },
			],
		})
		expect(createdPoints).toEqual([
			{ x: 1504, y: 90 },
			{ x: 1504, y: 390 },
		])
	})

	it("does not open a history transaction when every source fails", async () => {
		extractVideoTailFrame.mockResolvedValue(null)
		const { canvas, runTransaction } = createCanvas(["video-1", "video-2"])
		const manager = new VideoContinuationManager(canvas)

		const result = await manager.continueVideos({
			sourceVideoIds: ["video-1", "video-2"],
			videoModelList: [model],
		})

		expect(result.createdElementIds).toEqual([])
		expect(result.failedSourceIds).toEqual(["video-1", "video-2"])
		expect(runTransaction).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalled()
	})

	it("rolls back every created video when the connection batch is rejected", async () => {
		const { canvas, connectionManager } = createCanvas(["video-1", "video-2"])
		connectionManager.connectElementsBatch.mockReturnValue({
			status: "invalid",
			reason: "temporary-element",
		})
		const manager = new VideoContinuationManager(canvas)

		const result = await manager.continueVideos({
			sourceVideoIds: ["video-1", "video-2"],
			videoModelList: [model],
		})

		expect(result.createdElementIds).toEqual([])
		expect(result.skippedSourceIds).toEqual(["video-1", "video-2"])
		expect(canvas.elementManager.delete).toHaveBeenCalledWith("created-1")
		expect(canvas.elementManager.delete).toHaveBeenCalledWith("created-2")
		expect(toast.error).toHaveBeenCalled()
	})

	it("removes a created video when its content cannot be resolved", async () => {
		const { canvas, connectionManager } = createCanvas(["video-1"], {
			createdVideoHasNoContent: true,
		})
		const manager = new VideoContinuationManager(canvas)

		const result = await manager.continueVideos({
			sourceVideoIds: ["video-1"],
			videoModelList: [model],
		})

		expect(result).toEqual({
			createdElementIds: [],
			failedSourceIds: [],
			skippedSourceIds: ["video-1"],
		})
		expect(canvas.elementManager.delete).toHaveBeenCalledWith("created-1")
		expect(connectionManager.connectElementsBatch).not.toHaveBeenCalled()
	})
})
